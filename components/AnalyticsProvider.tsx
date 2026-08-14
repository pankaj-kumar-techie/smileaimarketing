"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ensureVisitorId, ensureSessionId, captureFirstTouch, trackEvent } from "@/lib/analytics.client";

function AnalyticsProviderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    ensureVisitorId();
    ensureSessionId();
    captureFirstTouch();
    trackEvent("page_view", {});
    // Re-fires on every client-side route change, matching the "page_view on route change" spec.
  }, [pathname, searchParams]);

  return null;
}

/** Mounted once in app/layout.tsx — owns visitor/session cookies + page_view tracking site-wide. */
export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsProviderInner />
    </Suspense>
  );
}
