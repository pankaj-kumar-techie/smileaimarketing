import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

/**
 * Manual fallback for reply tracking: until a real ESP inbound-parse webhook
 * is wired to /api/webhooks/email-reply, an admin can mark a sent message as
 * replied-to after checking their inbox by hand.
 */
export async function POST(request: Request) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const messageId: string | undefined = body.messageId;
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    const message = await prisma.emailMessage.update({
      where: { id: messageId },
      data: { status: "REPLIED" },
      include: { contact: { include: { business: true } } },
    });

    await trackEvent({
      eventName: "email_replied",
      emailMessageId: message.id,
      businessId: message.contact.businessId,
    });

    await prisma.salesActivity.create({
      data: {
        businessId: message.contact.businessId,
        userId: admin.id,
        type: "EMAIL",
        content: `${message.contact.firstName} ${message.contact.lastName} replied to outreach email.`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin mark-replied error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
