import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface LogEventParams {
  eventType: string;
  emailMessageId?: string;
  businessId?: string;
  auditId?: string;
  linkClicked?: string;
  ipAddress?: string;
  userAgent?: string;
  // Full-funnel attribution fields — all optional, populated by lib/analytics.ts's
  // trackEvent() for website-funnel events. Existing call sites can ignore these.
  eventId?: string;
  visitorId?: string;
  sessionId?: string;
  path?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  properties?: Record<string, string | number | boolean>;
}

export async function logEngagementEvent(params: LogEventParams) {
  try {
    const event = await prisma.engagementEvent.create({
      data: {
        eventType: params.eventType,
        emailMessageId: params.emailMessageId || null,
        businessId: params.businessId || null,
        auditId: params.auditId || null,
        linkClicked: params.linkClicked || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        eventId: params.eventId || null,
        visitorId: params.visitorId || null,
        sessionId: params.sessionId || null,
        path: params.path || null,
        referrer: params.referrer || null,
        utmSource: params.utmSource || null,
        utmMedium: params.utmMedium || null,
        utmCampaign: params.utmCampaign || null,
        utmContent: params.utmContent || null,
        utmTerm: params.utmTerm || null,
        properties: params.properties ? (params.properties as Prisma.InputJsonObject) : undefined,
      },
    });
    return event;
  } catch (err) {
    // A duplicate eventId (unique constraint) means this event was already recorded —
    // treat as a successful no-op dedupe, not an error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    console.error(`[Analytics Event Error] Failed to log event ${params.eventType}:`, err);
    return null;
  }
}
