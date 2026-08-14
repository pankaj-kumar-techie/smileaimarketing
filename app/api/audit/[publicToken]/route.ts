import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAuditNarrative } from "@/lib/auditNarrative";
import { trackEvent } from "@/lib/analytics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicToken: string }> }
) {
  try {
    const { publicToken } = await params;

    const audit = await prisma.audit.findUnique({
      where: { publicToken },
      include: {
        business: true,
        results: true,
        competitorGaps: true,
      },
    });

    if (!audit) {
      return NextResponse.json({ error: "Audit report not found" }, { status: 404 });
    }

    // Record the view — best-effort, must not block/fail the response.
    prisma.audit
      .update({
        where: { id: audit.id },
        data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
      })
      .catch((err) => console.error("Failed to record audit view:", err));

    void trackEvent({ eventName: "report_view", businessId: audit.businessId, auditId: audit.id });

    // Format the response payload safely
    const scorecard = {
      localVisibility: audit.results.find((r) => r.category === "LOCAL_VISIBILITY")?.score || 0,
      websiteQuality: audit.results.find((r) => r.category === "WEBSITE_QUALITY")?.score || 0,
      conversionExperience: audit.results.find((r) => r.category === "CONVERSION")?.score || 0,
      reviewsReputation: audit.results.find((r) => r.category === "REPUTATION")?.score || 0,
      competitorGap: audit.results.find((r) => r.category === "COMPETITOR_GAP")?.score || 0,
    };

    const findings = audit.results.map((r) => {
      const details = (r.detailsJson as Record<string, unknown> | null) || {};
      return {
        category: r.category,
        score: r.score,
        title: typeof details.title === "string" ? details.title : r.category,
        detail: typeof details.description === "string" ? details.description : "No description provided.",
        recommendation: typeof details.recommendation === "string" ? details.recommendation : null,
        // Raw real facts behind the score (rating, review count, verified rank, etc.) —
        // lets the report state the exact SEO gap instead of just a number.
        findings: (r.findingsJson as Record<string, unknown> | null) || {},
      };
    });

    const competitors = audit.competitorGaps.map((c) => ({
      name: c.name,
      rank: c.rank,
      mapScore: c.mapScore,
    }));

    const narrative = buildAuditNarrative({
      businessName: audit.business.name,
      city: audit.business.city,
      category: audit.business.category,
      findings: audit.results.map((r) => ({
        category: r.category,
        score: r.score,
        findingsJson: (r.findingsJson as Record<string, unknown>) || {},
      })),
      competitors,
    });

    return NextResponse.json({
      business: {
        name: audit.business.name,
        website: audit.business.website,
        city: audit.business.city,
        opportunityScore: audit.score,
      },
      checkedAt: audit.createdAt,
      // The real, AI-written (or honest deterministic fallback) plain-English
      // synthesis of this specific audit — was computed at audit time but
      // never actually sent to the report page until now.
      summary: audit.summaryText,
      narrative,
      scorecard,
      findings,
      competitors,
    });
  } catch (error) {
    console.error("Fetch audit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
