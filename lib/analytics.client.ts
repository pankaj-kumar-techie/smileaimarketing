"use client";

// Type-only import — erased at compile time (tsconfig isolatedModules), so
// none of lib/analytics.ts's server code (prisma, env.server) ends up in
// the client bundle.
import type { EventName } from "./analytics";

const VISITOR_COOKIE = "saim_vid";
const SESSION_COOKIE = "saim_sid";
const FIRST_TOUCH_COOKIE = "saim_first_touch";

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const SESSION_SECONDS = 30 * 60;

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

/** Anonymous visitor id — persists across sessions (365d). */
export function ensureVisitorId(): string {
  let id = getCookie(VISITOR_COOKIE);
  if (!id) {
    id = crypto.randomUUID();
    setCookie(VISITOR_COOKIE, id, YEAR_SECONDS);
  }
  return id;
}

/** Session id with a 30-minute sliding window — refreshed on every call. */
export function ensureSessionId(): string {
  const id = getCookie(SESSION_COOKIE) || crypto.randomUUID();
  setCookie(SESSION_COOKIE, id, SESSION_SECONDS);
  return id;
}

/** Captures UTM params + referrer + landing page once, on true first touch. Never overwritten afterwards. */
export function captureFirstTouch() {
  if (typeof window === "undefined" || getCookie(FIRST_TOUCH_COOKIE)) return;

  const params = new URLSearchParams(window.location.search);
  const firstTouch = {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    content: params.get("utm_content") || undefined,
    term: params.get("utm_term") || undefined,
    landingPage: window.location.pathname,
    referrer: document.referrer || undefined,
  };
  setCookie(FIRST_TOUCH_COOKIE, JSON.stringify(firstTouch), YEAR_SECONDS);
}

type Primitive = string | number | boolean;

/**
 * The one client-side tracking call site — every component should call this,
 * never gtag/fetch analytics endpoints directly. Fire-and-forget: tracking
 * failures never surface to the user.
 */
export function trackEvent(eventName: EventName, properties?: Record<string, Primitive>) {
  if (typeof window === "undefined") return;

  ensureVisitorId();
  ensureSessionId();

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, properties, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {
    // Best-effort — never block or surface a tracking failure to the user.
  });
}
