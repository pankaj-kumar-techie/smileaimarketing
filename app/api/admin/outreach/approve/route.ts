import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { outreachQueue } from "@/lib/queue";
import { trackEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const messageIds: string[] | undefined = body.messageIds;

    const queued = await prisma.emailMessage.findMany({
      where: body.approveAll
        ? { status: "QUEUED" }
        : { status: "QUEUED", id: { in: messageIds || [] } },
      select: { id: true, contact: { select: { businessId: true } } },
    });

    for (const message of queued) {
      await outreachQueue.add(
        "send-outreach-email",
        { emailMessageId: message.id },
        { jobId: `outreach_${message.id}` }
      );
    }

    const businessIds = [...new Set(queued.map((m) => m.contact.businessId))];
    if (businessIds.length > 0) {
      await prisma.business.updateMany({
        where: { id: { in: businessIds }, status: "OUTREACH_PENDING" },
        data: { status: "OUTREACH_ACTIVE" },
      });
      await Promise.all(
        businessIds.map((businessId) => trackEvent({ eventName: "outreach_approved", businessId }))
      );
    }

    return NextResponse.json({ success: true, count: queued.length });
  } catch (error) {
    console.error("Admin outreach approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
