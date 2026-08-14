import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env.server";
import { trackEvent } from "@/lib/analytics";

/**
 * Generic inbound-reply webhook. Point your email provider's inbound-parse /
 * reply-tracking webhook here once one is configured — this project doesn't
 * assume a specific ESP, so it accepts a minimal, provider-agnostic payload:
 *
 *   POST /api/webhooks/email-reply?secret=<WEBHOOK_SECRET>
 *   { "fromEmail": "dr.smith@clinic.com", "providerMessageId"?: "..." }
 *
 * Resolution order: match by providerMessageId (the id we stored on send)
 * if given, otherwise fall back to the most recent non-replied message sent
 * to that contact's email address.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (secret !== env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fromEmail: string | undefined = body.fromEmail?.toLowerCase().trim();
    const providerMessageId: string | undefined = body.providerMessageId;

    if (!fromEmail && !providerMessageId) {
      return NextResponse.json({ error: "fromEmail or providerMessageId is required" }, { status: 400 });
    }

    const message = providerMessageId
      ? await prisma.emailMessage.findFirst({
          where: { messageId: providerMessageId },
          include: { contact: true },
        })
      : await prisma.emailMessage.findFirst({
          where: {
            contact: { email: fromEmail },
            status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] },
          },
          orderBy: { sentAt: "desc" },
          include: { contact: true },
        });

    if (!message) {
      return NextResponse.json({ error: "No matching outreach message found" }, { status: 404 });
    }

    await prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: "REPLIED" },
    });

    await trackEvent({
      eventName: "email_replied",
      emailMessageId: message.id,
      businessId: message.contact.businessId,
    });

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (error) {
    console.error("Email reply webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
