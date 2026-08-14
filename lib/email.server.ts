import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "./prisma";
import { env, integrationStatus } from "./env.server";
import { trackEvent } from "./analytics";

export interface SendEmailParams {
  emailMessageId?: string;
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  mode: "test" | "live";
  recipient: string;
  messageId?: string;
  error?: string;
}

let gmailTransporter: Transporter | null = null;

function getGmailTransporter(): Transporter {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return gmailTransporter;
}

export async function sendOutreachEmail(params: SendEmailParams): Promise<EmailDispatchResult> {
  const sendMode = env.EMAIL_SEND_MODE;
  const testRecipients = env.EMAIL_TEST_RECIPIENTS;
  const goingLive = sendMode === "live" && integrationStatus.gmail;

  const targetRecipient = goingLive ? params.toEmail : testRecipients.split(",")[0].trim();

  console.log(
    `[Email Service] Mode: ${goingLive ? "LIVE" : "TEST"} | Intended: ${params.toEmail} -> Actual: ${targetRecipient}` +
      (sendMode === "live" && !integrationStatus.gmail
        ? " (EMAIL_SEND_MODE=live but GMAIL_USER/GMAIL_APP_PASSWORD are not configured — falling back to test dispatch)"
        : "")
  );

  try {
    // Check if recipient domain or email is in suppression table
    const suppressed = await prisma.suppressionRecord.findFirst({
      where: {
        OR: [
          { email: params.toEmail.toLowerCase() },
          { domain: params.toEmail.split("@")[1]?.toLowerCase() },
        ],
      },
    });

    if (suppressed) {
      console.warn(`[Email Service] Recipient ${params.toEmail} is SUPPRESSED. Skipping email dispatch.`);
      if (params.emailMessageId) {
        await prisma.emailMessage.update({
          where: { id: params.emailMessageId },
          data: { status: "BOUNCED" },
        });
      }
      return {
        success: false,
        mode: goingLive ? "live" : "test",
        recipient: targetRecipient,
        error: "Recipient address or domain is suppressed.",
      };
    }

    let messageId: string;

    if (goingLive) {
      const info = await getGmailTransporter().sendMail({
        from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS || env.GMAIL_USER}>`,
        to: `"${params.toName}" <${targetRecipient}>`,
        replyTo: env.EMAIL_REPLY_TO || env.EMAIL_FROM_ADDRESS,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      messageId = info.messageId;
    } else {
      // Safe simulator — no external call, used whenever EMAIL_SEND_MODE=test
      // or live credentials aren't configured yet.
      messageId = `msg_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    if (params.emailMessageId) {
      const sentMessage = await prisma.emailMessage.update({
        where: { id: params.emailMessageId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          messageId,
        },
        include: { step: { select: { stepDay: true } }, contact: { select: { businessId: true } } },
      });
      await trackEvent({
        eventName: "email_sent",
        businessId: sentMessage.contact.businessId,
        emailMessageId: sentMessage.id,
        properties: { step_day: sentMessage.step.stepDay },
      });
    }

    return {
      success: true,
      mode: goingLive ? "live" : "test",
      recipient: targetRecipient,
      messageId,
    };
  } catch (error) {
    console.error("[Email Service] Dispatch error:", error);
    if (params.emailMessageId) {
      await prisma.emailMessage.update({
        where: { id: params.emailMessageId },
        data: { status: "BOUNCED" },
      });
    }
    return {
      success: false,
      mode: goingLive ? "live" : "test",
      recipient: targetRecipient,
      error: error instanceof Error ? error.message : "Unknown email failure",
    };
  }
}
