import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { analyzeWebsite } from "@/lib/websiteAnalyzer";
import { computeAuditScores } from "@/lib/auditScorer";
import { findLocalMarketPosition } from "@/lib/discoveryProvider";
import { pdfQueue } from "@/lib/queue";
import { trackEvent } from "@/lib/analytics";

const leadSchema = z.object({
  pendingAuditId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  phone: z.string().optional(),
  consent: z.boolean().refine((val) => val === true, {
    message: "Consent is required",
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = leadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const { pendingAuditId, firstName, lastName, email, role, phone, consent } = result.data;

    // Fetch the pending audit
    const audit = await prisma.audit.findUnique({
      where: { id: pendingAuditId },
      include: { business: true },
    });

    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const business = audit.business;

    // Create or update contact
    const contact = await prisma.contact.upsert({
      where: {
        businessId_email: { businessId: business.id, email },
      },
      update: {
        firstName,
        lastName,
        role,
        phone,
      },
      create: {
        businessId: business.id,
        firstName,
        lastName,
        email,
        role,
        phone,
        source: "SELF_SERVE",
      },
    });

    // Create consent record
    await prisma.consentRecord.create({
      data: {
        contactId: contact.id,
        consentType: "MARKETING_EMAIL",
        consentGranted: consent,
      },
    });

    // Real, credential-free website check & deterministic scoring
    const signals = await analyzeWebsite(business.website);
    const localMarket = await findLocalMarketPosition({
      businessName: business.name,
      website: business.website,
      city: business.city,
      state: business.state || undefined,
      country: business.country,
      category: business.category,
      limit: 3,
    });
    const scoreOutput = computeAuditScores({
      businessName: business.name,
      city: business.city,
      website: business.website,
      signals,
      rating: business.rating || 4.5,
      reviewCount: business.reviewCount || 45,
      realCompetitors: localMarket.competitors,
      ownRank: localMarket.ownRank,
      marketChecked: localMarket.checked,
    });

    // Clear old audit results and competitors
    await prisma.auditResult.deleteMany({ where: { auditId: audit.id } });
    await prisma.competitor.deleteMany({ where: { auditId: audit.id } });

    for (const res of scoreOutput.categoryScores) {
      await prisma.auditResult.create({
        data: {
          auditId: audit.id,
          category: res.category,
          score: res.score,
          findingsJson: res.findingsJson as Prisma.InputJsonObject,
          detailsJson: res.detailsJson as Prisma.InputJsonObject,
        },
      });
    }

    for (const comp of scoreOutput.competitors) {
      await prisma.competitor.create({
        data: {
          auditId: audit.id,
          name: comp.name,
          website: comp.website || `https://${comp.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          rank: comp.rank,
          mapScore: comp.mapScore,
        },
      });
    }

    // Update business and audit statuses
    await prisma.business.update({
      where: { id: business.id },
      data: {
        status: "AUDITED",
        opportunityScore: scoreOutput.opportunityScore,
        lastCheckedAt: new Date(),
      },
    });

    const completedAudit = await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: "COMPLETED",
        score: scoreOutput.opportunityScore,
        summaryText: scoreOutput.summaryText,
      },
    });

    await trackEvent({
      eventName: "audit_completed",
      businessId: business.id,
      auditId: audit.id,
      properties: { score: scoreOutput.opportunityScore },
    });

    // The contact-unlock step is the real lead-generation moment — maps to
    // GA4's generate_lead.
    await trackEvent({
      eventName: "report_unlock_complete",
      businessId: business.id,
      auditId: audit.id,
    });

    // Queue PDF generation
    await pdfQueue.add(
      "generate-pdf",
      {
        auditId: completedAudit.id,
        publicToken: completedAudit.publicToken,
        businessName: business.name,
        city: business.city,
        website: business.website,
        opportunityScore: scoreOutput.opportunityScore,
        summaryText: scoreOutput.summaryText,
        findings: scoreOutput.categoryScores.map((c) => ({
          category: c.category,
          score: c.score,
          title: c.detailsJson.title,
          detail: c.detailsJson.description,
        })),
        competitors: scoreOutput.competitors,
      },
      { jobId: `pdf_${completedAudit.id}` }
    );

    return NextResponse.json(
      {
        publicToken: audit.publicToken,
        redirectUrl: `/audit/${audit.publicToken}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unlock lead error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
