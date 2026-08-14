import { randomUUID } from "crypto";
import { logEngagementEvent } from "./events";
import { env, integrationStatus } from "./env.server";

/**
 * Full-funnel event dictionary (docs/analytics-measurement-plan.md).
 *
 * Each event name maps to the only property keys it is allowed to carry.
 * trackEvent()'s type signature only accepts those keys for a given event —
 * this is what makes it structurally hard to accidentally attach PII (email,
 * phone, name, address) instead of auditing every call site by hand.
 * Internal IDs (business/audit/appointment) are fine and are opaque UUIDs.
 */
export const EVENT_DEFINITIONS = {
  // Website funnel — client-tracked, browser interaction
  page_view: [] as const,
  audit_form_start: ["form_location"] as const,
  audit_form_submit: ["form_location"] as const,
  audit_processing_view: [] as const,
  audit_preview_view: [] as const,
  report_unlock_start: [] as const,
  report_unlock_complete: [] as const,
  report_view: [] as const,
  pdf_download: [] as const,
  consultation_view: ["type"] as const,
  booking_start: ["type"] as const,
  booking_submit: ["type"] as const,
  booking_confirmed: ["type", "appointment_id"] as const,

  // Outbound funnel — server-tracked, from the route handler/worker that owns the transition
  business_discovered: [] as const,
  business_qualified: [] as const,
  business_disqualified: [] as const,
  audit_completed: ["score"] as const,
  contact_enriched: ["confidence"] as const,
  outreach_approved: [] as const,
  email_sent: ["step_day"] as const,
  email_delivered: [] as const,
  email_bounced: [] as const,
  email_replied: [] as const,
  report_opened: [] as const,
  meeting_requested: ["type"] as const,
  meeting_confirmed: ["type", "appointment_id"] as const,
  proposal_sent: [] as const,
  lead_won: ["deal_value_cents"] as const,
  lead_lost: [] as const,
} satisfies Record<string, readonly string[]>;

export type EventName = keyof typeof EVENT_DEFINITIONS;

type Primitive = string | number | boolean;
type AllowedKeys<E extends EventName> = (typeof EVENT_DEFINITIONS)[E][number];
type EventProperties<E extends EventName> = Partial<Record<AllowedKeys<E>, Primitive>>;

/** Internal event name → GA4 recommended lead-lifecycle event. */
const GA4_EVENT_MAP: Partial<Record<EventName, string>> = {
  report_unlock_complete: "generate_lead",
  business_qualified: "qualify_lead",
  business_disqualified: "disqualify_lead",
  outreach_approved: "working_lead",
  meeting_requested: "working_lead",
  lead_won: "close_convert_lead",
  lead_lost: "close_unconvert_lead",
};

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface TrackEventParams<E extends EventName> {
  eventName: E;
  properties?: EventProperties<E>;
  /** Caller-supplied UUID for cross-layer/GA4 dedupe. Generated if omitted. */
  eventId?: string;
  businessId?: string;
  auditId?: string;
  emailMessageId?: string;
  visitorId?: string;
  sessionId?: string;
  path?: string;
  referrer?: string;
  utm?: UtmParams;
}

function sanitizeProperties<E extends EventName>(
  eventName: E,
  properties?: EventProperties<E>
): Record<string, Primitive> {
  const allowed = new Set<string>(EVENT_DEFINITIONS[eventName]);
  const clean: Record<string, Primitive> = {};
  if (!properties) return clean;
  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Single entry point for the whole funnel dictionary — call directly from
 * route handlers/workers for server-owned transitions, or via
 * lib/analytics.client.ts -> app/api/analytics/track for browser events.
 * Never call gtag or write EngagementEvent rows directly from elsewhere.
 */
export async function trackEvent<E extends EventName>(params: TrackEventParams<E>) {
  if (!env.ANALYTICS_ENABLED) return null;

  const cleanProperties = sanitizeProperties(params.eventName, params.properties);
  const eventId = params.eventId || randomUUID();

  const stored = await logEngagementEvent({
    eventType: params.eventName,
    businessId: params.businessId,
    auditId: params.auditId,
    emailMessageId: params.emailMessageId,
    eventId,
    visitorId: params.visitorId,
    sessionId: params.sessionId,
    path: params.path,
    referrer: params.referrer,
    utmSource: params.utm?.source,
    utmMedium: params.utm?.medium,
    utmCampaign: params.utm?.campaign,
    utmContent: params.utm?.content,
    utmTerm: params.utm?.term,
    properties: cleanProperties,
  });

  if (env.ANALYTICS_DEBUG) {
    console.log(`[analytics] ${params.eventName}`, {
      eventId,
      businessId: params.businessId || null,
      auditId: params.auditId || null,
      visitorId: params.visitorId || null,
      properties: cleanProperties,
    });
  }

  // GA4 forwarding is best-effort and never blocks the caller — the internal
  // EngagementEvent row above is the source of truth regardless of GA4 state.
  void forwardToGA4(params.eventName, cleanProperties, params.visitorId || eventId);

  return stored;
}

/** Parses a request's raw Cookie header — same approach as getAdminSession in lib/auth.ts. */
export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf("=");
        return [c.slice(0, idx), decodeURIComponent(c.slice(idx + 1))];
      })
  );
}

export interface FirstTouch {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landingPage?: string;
  referrer?: string;
}

/** Reads the saim_vid / saim_sid / saim_first_touch cookies set by lib/analytics.client.ts. */
export function readVisitorCookies(request: Request): {
  visitorId?: string;
  sessionId?: string;
  firstTouch: FirstTouch | null;
} {
  const cookies = parseCookies(request);
  let firstTouch: FirstTouch | null = null;
  if (cookies["saim_first_touch"]) {
    try {
      firstTouch = JSON.parse(cookies["saim_first_touch"]);
    } catch {
      firstTouch = null;
    }
  }
  return {
    visitorId: cookies["saim_vid"] || undefined,
    sessionId: cookies["saim_sid"] || undefined,
    firstTouch,
  };
}

async function forwardToGA4(eventName: EventName, properties: Record<string, Primitive>, clientId: string) {
  if (!integrationStatus.ga4) return;
  const ga4EventName = GA4_EVENT_MAP[eventName];
  if (!ga4EventName) return;

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
    await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: ga4EventName, params: properties }],
      }),
    });
  } catch (err) {
    console.error(`[analytics] GA4 forward failed for ${eventName}:`, err);
  }
}
