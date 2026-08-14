import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { trackEvent } from "@/lib/analytics";

const visitSchema = z.object({
  address: z.string().min(5),
  preferredWindow: z.string().min(3),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicToken: string }> }
) {
  try {
    const { publicToken } = await params;
    const body = await request.json();
    const result = visitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { address, preferredWindow, notes } = result.data;

    // Find audit and contact
    const audit = await prisma.audit.findUnique({
      where: { publicToken },
      include: {
        business: {
          include: { contacts: true },
        },
      },
    });

    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const business = audit.business;
    const contact = business.contacts[0];

    if (!contact) {
      return NextResponse.json({ error: "Lead contact details missing" }, { status: 400 });
    }

    // Create Appointment as REQUESTED — an in-person visit must never appear
    // confirmed until an admin approves it (docs/mvp-readiness.md #26).
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        contactId: contact.id,
        type: "IN_PERSON",
        status: "REQUESTED",
        scheduledTime: new Date(), // Placeholder — admin sets the real time on approval
        durationMinutes: 30,
        address,
        preferredWindow,
        notes,
      },
    });

    // Business status is intentionally left unchanged here — it only moves
    // to CONVERTED once an admin approves the visit (see
    // app/api/admin/appointments/[id]/route.ts).

    // Create sales activity
    await prisma.salesActivity.create({
      data: {
        businessId: business.id,
        userId: (await prisma.user.findFirst())?.id || "unknown",
        type: "MEETING",
        content: `Offline clinic drop-off visit requested for ${address} during ${preferredWindow}.`,
      },
    });

    await trackEvent({
      eventName: "meeting_requested",
      businessId: business.id,
      auditId: audit.id,
      properties: { type: "in_person" },
    });

    return NextResponse.json({
      appointmentId: appointment.id,
      status: appointment.status,
    }, { status: 200 });
  } catch (error) {
    console.error("Request visit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
