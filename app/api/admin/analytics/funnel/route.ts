import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

/**
 * Visitor -> audit start -> submit -> report generated -> report viewed ->
 * lead captured -> booked -> meeting confirmed, per docs/analytics-measurement-plan.md.
 * "Won" + revenue are reported separately since they live on Business, not EngagementEvent.
 */
const FUNNEL_STAGES: { key: string; label: string; eventTypes: string[] }[] = [
  { key: "visitors", label: "Visitors", eventTypes: ["page_view"] },
  { key: "audit_starts", label: "Audit Started", eventTypes: ["audit_form_start"] },
  { key: "audit_submissions", label: "Audit Submitted", eventTypes: ["audit_form_submit", "business_discovered"] },
  { key: "reports_generated", label: "Report Generated", eventTypes: ["audit_completed"] },
  { key: "reports_viewed", label: "Report Viewed", eventTypes: ["report_view"] },
  { key: "leads_captured", label: "Lead Captured", eventTypes: ["report_unlock_complete"] },
  { key: "bookings", label: "Booked / Meeting Requested", eventTypes: ["booking_confirmed", "meeting_requested"] },
  { key: "meetings_confirmed", label: "Meeting Confirmed", eventTypes: ["booking_confirmed", "meeting_confirmed"] },
];

export async function GET(request: Request) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || undefined;
    const campaign = searchParams.get("campaign") || undefined;

    const eventWhere = (eventTypes: string[]) => ({
      eventType: { in: eventTypes },
      ...(source ? { utmSource: source } : {}),
      ...(campaign ? { utmCampaign: campaign } : {}),
    });

    const stages = await Promise.all(
      FUNNEL_STAGES.map(async (stage) => {
        let count: number;
        if (stage.key === "visitors") {
          const rows = await prisma.engagementEvent.findMany({
            where: { ...eventWhere(stage.eventTypes), visitorId: { not: null } },
            distinct: ["visitorId"],
            select: { visitorId: true },
          });
          count = rows.length;
        } else {
          count = await prisma.engagementEvent.count({ where: eventWhere(stage.eventTypes) });
        }
        return { key: stage.key, label: stage.label, count };
      })
    );

    const businessWhere = {
      ...(source ? { firstTouchSource: source } : {}),
      ...(campaign ? { firstTouchCampaign: campaign } : {}),
    };

    const wonBusinesses = await prisma.business.findMany({
      where: { ...businessWhere, wonAt: { not: null } },
      select: { dealValueCents: true },
    });
    const revenueCents = wonBusinesses.reduce((sum, b) => sum + (b.dealValueCents || 0), 0);

    const pdfDownloads = await prisma.engagementEvent.count({ where: eventWhere(["pdf_download"]) });

    // Segment picker options — every distinct source/campaign ever seen, regardless of current filter.
    const [sourceRows, campaignRows] = await Promise.all([
      prisma.engagementEvent.findMany({
        where: { utmSource: { not: null } },
        distinct: ["utmSource"],
        select: { utmSource: true },
        take: 50,
      }),
      prisma.engagementEvent.findMany({
        where: { utmCampaign: { not: null } },
        distinct: ["utmCampaign"],
        select: { utmCampaign: true },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      stages,
      won: { count: wonBusinesses.length, revenueCents },
      pdfDownloads,
      sources: sourceRows.map((r) => r.utmSource).filter((v): v is string => Boolean(v)),
      campaigns: campaignRows.map((r) => r.utmCampaign).filter((v): v is string => Boolean(v)),
    });
  } catch (error) {
    console.error("Admin analytics funnel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
