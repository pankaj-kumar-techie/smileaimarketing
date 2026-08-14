import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, EVENT_DEFINITIONS, readVisitorCookies, type EventName } from "@/lib/analytics";

function isKnownEvent(value: string): value is EventName {
  return Object.prototype.hasOwnProperty.call(EVENT_DEFINITIONS, value);
}

const trackSchema = z.object({
  eventName: z.string().refine(isKnownEvent, { message: "Unknown event name" }),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  path: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = trackSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const { eventName, properties, path } = result.data;
    // Identity/attribution is trusted from the request's own cookies, never
    // from the client-supplied body — cheap tamper resistance for free.
    const { visitorId, sessionId, firstTouch } = readVisitorCookies(request);

    await trackEvent({
      eventName,
      // sanitizeProperties() re-validates this against the per-event allowlist server-side.
      properties: properties as never,
      visitorId,
      sessionId,
      path,
      referrer: request.headers.get("referer") || undefined,
      utm: firstTouch
        ? {
            source: firstTouch.source,
            medium: firstTouch.medium,
            campaign: firstTouch.campaign,
            content: firstTouch.content,
            term: firstTouch.term,
          }
        : undefined,
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.error("Analytics track error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
