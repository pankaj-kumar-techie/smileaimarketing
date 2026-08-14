import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { normalizeDomain, normalizeName } from "@/lib/normalize";
import { checkWebsite } from "@/lib/websiteCheck.server";
import { analysisQueue } from "@/lib/queue";
import { trackEvent, readVisitorCookies } from "@/lib/analytics";

const inboundSchema = z.object({
  website: z.string().url(),
  city: z.string().min(2),
  clinicName: z.string().min(2),
  country: z.string().default("US"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = inboundSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
    }

    const { website, city, clinicName, country } = result.data;
    const normalizedDomain = normalizeDomain(website);
    const normalizedName = normalizeName(clinicName);

    // Check if the business already exists — exact match first, then by
    // normalized domain (catches e.g. https://x.com vs https://www.x.com/).
    let business = await prisma.business.findUnique({
      where: {
        website_city: { website, city },
      },
    });

    if (!business) {
      business = await prisma.business.findFirst({
        where: { normalizedDomain, city },
      });
    }

    const isNewBusiness = !business;

    if (!business) {
      // First-touch attribution is captured once, here, at the moment this
      // anonymous visitor becomes a named lead — never overwritten afterwards.
      const { visitorId, firstTouch } = readVisitorCookies(request);
      business = await prisma.business.create({
        data: {
          name: clinicName,
          normalizedName,
          website,
          normalizedDomain,
          city,
          country,
          category: "Dental Clinic",
          status: "AUDITING",
          providerSource: "SELF_SERVE",
          lastCheckedAt: new Date(),
          visitorId,
          firstTouchSource: firstTouch?.source,
          firstTouchMedium: firstTouch?.medium,
          firstTouchCampaign: firstTouch?.campaign,
          firstTouchContent: firstTouch?.content,
          firstTouchTerm: firstTouch?.term,
          firstTouchLandingPage: firstTouch?.landingPage,
          firstTouchReferrer: firstTouch?.referrer,
        },
      });
    } else {
      business = await prisma.business.update({
        where: { id: business.id },
        data: { status: "AUDITING", lastCheckedAt: new Date() },
      });
    }

    if (isNewBusiness) {
      await trackEvent({ eventName: "business_discovered", businessId: business.id });
    }

    // Create a pending Audit record
    const audit = await prisma.audit.create({
      data: {
        businessId: business.id,
        status: "PENDING",
        score: 0,
      },
    });

    // Real, credential-free preliminary check — actually fetches the site.
    // (Just for the instant on-page feedback; the full real audit runs next.)
    const websiteCheck = await checkWebsite(website);

    // Hand off to the same real analysis pipeline campaigns use (website
    // check + DataForSEO local rank + AI summary) — this used to leave the
    // audit stuck at PENDING forever with only the preliminary check above.
    await analysisQueue.add(
      "analyze-business",
      { auditId: audit.id, businessId: business.id },
      { jobId: `analysis_${audit.id}` }
    );

    return NextResponse.json({
      pendingAuditId: audit.id,
      preliminaryFindings: {
        sslValid: websiteCheck.sslValid,
        pageSpeedEstimate:
          websiteCheck.responseTimeMs === null
            ? "UNKNOWN"
            : websiteCheck.responseTimeMs > 3500
              ? "MOBILE_SLOW"
              : websiteCheck.responseTimeMs > 1200
                ? "MOBILE_AVERAGE"
                : "MOBILE_FAST",
        mobileOptimized: websiteCheck.mobileViewport,
      },
    }, { status: 202 });
  } catch (error) {
    console.error("Inbound trigger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
