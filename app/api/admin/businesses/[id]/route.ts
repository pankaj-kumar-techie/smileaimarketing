import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { buildAuditNarrative } from "@/lib/auditNarrative";
import { trackEvent } from "@/lib/analytics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // rawProviderRef is deliberately not selected — internal-only per
    // docs/mvp-readiness.md #6 ("do not expose complete raw provider
    // responses to the public frontend"). This is an admin page, but
    // there's no reason to ship an opaque provider payload to the browser.
    const business = await prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        website: true,
        address: true,
        city: true,
        state: true,
        country: true,
        phone: true,
        category: true,
        status: true,
        opportunityScore: true,
        dealValueCents: true,
        wonAt: true,
        firstTouchSource: true,
        firstTouchMedium: true,
        firstTouchCampaign: true,
        providerSource: true,
        rating: true,
        reviewCount: true,
        googlePlaceId: true,
        lastCheckedAt: true,
        createdAt: true,
        campaign: { select: { id: true, name: true } },
        contacts: true,
        appointments: { orderBy: { createdAt: "desc" } },
        salesActivities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
        audits: {
          orderBy: { createdAt: "desc" },
          include: { results: true, competitorGaps: true },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Pitch-ready, non-technical narrative for whoever's calling this practice —
    // built only from real findingsJson already computed at audit time.
    const latestAudit = business.audits[0];
    const narrative = latestAudit
      ? buildAuditNarrative({
          businessName: business.name,
          city: business.city,
          category: business.category,
          findings: latestAudit.results.map((r) => ({
            category: r.category,
            score: r.score,
            findingsJson: (r.findingsJson as Record<string, unknown>) || {},
          })),
          competitors: latestAudit.competitorGaps,
        })
      : null;

    return NextResponse.json({ business, narrative });
  } catch (error) {
    console.error("Admin business detail GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const BUSINESS_STATUSES = [
  "DISCOVERED",
  "QUALIFIED",
  "AUDITING",
  "AUDITED",
  "OUTREACH_PENDING",
  "OUTREACH_ACTIVE",
  "CONVERTED",
  "DISQUALIFIED",
] as const;

const patchSchema = z.object({
  status: z.enum(BUSINESS_STATUSES).optional(),
  // Marking a business "won" is separate from `status` — it's the revenue
  // close-out step (docs/analytics-measurement-plan.md), settable regardless
  // of the lead-lifecycle status since there's no billing integration to
  // derive it from.
  markWon: z.boolean().optional(),
  dealValueCents: z.number().int().positive().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = patchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }
    const { status, markWon, dealValueCents } = result.data;

    const updated = await prisma.business.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(markWon ? { wonAt: new Date() } : {}),
        ...(dealValueCents !== undefined ? { dealValueCents } : {}),
      },
    });

    if (status === "QUALIFIED") {
      await trackEvent({ eventName: "business_qualified", businessId: id });
    } else if (status === "DISQUALIFIED") {
      await trackEvent({ eventName: "business_disqualified", businessId: id });
      await trackEvent({ eventName: "lead_lost", businessId: id });
    }
    if (markWon) {
      await trackEvent({
        eventName: "lead_won",
        businessId: id,
        properties: dealValueCents !== undefined ? { deal_value_cents: dealValueCents } : undefined,
      });
    }

    return NextResponse.json({ business: updated });
  } catch (error) {
    console.error("Admin business PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
