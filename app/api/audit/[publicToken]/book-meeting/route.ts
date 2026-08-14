import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { trackEvent } from "@/lib/analytics";
import { createGoogleMeetEvent } from "@/lib/googleCalendar";

const bookSchema = z.object({
  scheduledTime: z.string().datetime(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicToken: string }> }
) {
  try {
    const { publicToken } = await params;
    const body = await request.json();
    const result = bookSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { scheduledTime, notes } = result.data;

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

    // Create Appointment with status REQUESTED
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        contactId: contact.id,
        type: "ONLINE",
        status: "REQUESTED",
        scheduledTime: new Date(scheduledTime),
        durationMinutes: 15,
        notes,
      },
    });

    await trackEvent({
      eventName: "booking_confirmed",
      businessId: business.id,
      auditId: audit.id,
      properties: { type: "online", appointment_id: appointment.id },
    });

    // Update business status
    await prisma.business.update({
      where: { id: business.id },
      data: { status: "CONVERTED" },
    });

    // Create sales activity
    await prisma.salesActivity.create({
      data: {
        businessId: business.id,
        userId: (await prisma.user.findFirst())?.id || "unknown",
        type: "MEETING",
        content: `Online 15-minute consultation booked via private audit link for ${scheduledTime}.`,
      },
    });

    const meetResult = await createGoogleMeetEvent({
      appointmentId: appointment.id,
      summary: `Smile AI Strategy Session with ${business.name}`,
      description: `Strategy consultation for ${business.name} (${business.website}) in ${business.city}.`,
      startTime: new Date(scheduledTime),
      durationMinutes: 15,
      attendeeEmail: contact.email,
    });

    if (meetResult.status === "CONFIRMED") {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleEventId: meetResult.eventId, meetLink: meetResult.meetUrl },
      });
    }

    return NextResponse.json({
      appointmentId: appointment.id,
      status: appointment.status,
      // Only ever a real, working link — never a placeholder that looks real.
      // When null, the confirmation copy should say a link is coming by email/admin, not show a broken one.
      joinUrl: meetResult.status === "CONFIRMED" ? meetResult.meetUrl : null,
    }, { status: 200 });
  } catch (error) {
    console.error("Book meeting error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
