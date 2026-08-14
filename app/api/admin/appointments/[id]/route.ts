import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { z } from "zod";
import { trackEvent } from "@/lib/analytics";

const approveSchema = z.object({
  action: z.literal("approve"),
  scheduledTime: z.string().datetime(),
});

const rejectSchema = z.object({
  action: z.literal("reject"),
  reason: z.string().optional(),
});

const patchSchema = z.discriminatedUnion("action", [approveSchema, rejectSchema]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = patchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    if (appointment.status !== "REQUESTED") {
      return NextResponse.json(
        { error: `Only REQUESTED appointments can be approved or rejected (current status: ${appointment.status})` },
        { status: 409 }
      );
    }

    if (result.data.action === "approve") {
      const updated = await prisma.appointment.update({
        where: { id },
        data: { status: "SCHEDULED", scheduledTime: new Date(result.data.scheduledTime) },
      });

      // Confirmation is the actual conversion signal — moved here from
      // request time (docs/mvp-readiness.md #26).
      await prisma.business.update({
        where: { id: appointment.businessId },
        data: { status: "CONVERTED" },
      });

      await prisma.salesActivity.create({
        data: {
          businessId: appointment.businessId,
          userId: admin.id,
          type: "MEETING",
          content: `In-person visit approved for ${updated.scheduledTime.toISOString()}.`,
        },
      });

      await trackEvent({
        eventName: "meeting_confirmed",
        businessId: appointment.businessId,
        properties: { type: "in_person", appointment_id: updated.id },
      });

      return NextResponse.json({ appointment: updated });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await prisma.salesActivity.create({
      data: {
        businessId: appointment.businessId,
        userId: admin.id,
        type: "MEETING",
        content: `In-person visit request rejected.${result.data.reason ? ` Reason: ${result.data.reason}` : ""}`,
      },
    });

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error("Admin appointment PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
