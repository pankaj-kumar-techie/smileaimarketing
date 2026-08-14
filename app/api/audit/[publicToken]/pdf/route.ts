import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLightAuditPdf } from "@/lib/pdfGenerator";
import { trackEvent } from "@/lib/analytics";
import fs from "fs/promises";
import path from "path";

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

    let pdfRelativeUrl = audit.pdfUrl;

    // If PDF is not ready yet, generate it on demand
    if (!pdfRelativeUrl || audit.pdfStatus !== "READY") {
      const findings = audit.results.map((r) => {
        const details = (r.detailsJson as Record<string, unknown> | null) || {};
        return {
          category: r.category,
          score: r.score,
          title: typeof details.title === "string" ? details.title : r.category,
          detail: typeof details.description === "string" ? details.description : "Audit finding",
          findingsJson: (r.findingsJson as Record<string, unknown> | null) || {},
        };
      });

      const competitors = audit.competitorGaps.map((c) => ({
        name: c.name,
        rank: c.rank,
        mapScore: c.mapScore || undefined,
      }));

      pdfRelativeUrl = await generateLightAuditPdf({
        auditId: audit.id,
        publicToken: audit.publicToken,
        businessName: audit.business.name,
        city: audit.business.city,
        category: audit.business.category,
        website: audit.business.website,
        opportunityScore: audit.score,
        summaryText: audit.summaryText || `${audit.business.name} Audit Report`,
        findings,
        competitors,
      });
    }

    await trackEvent({ eventName: "pdf_download", businessId: audit.businessId, auditId: audit.id });

    // Stream file contents directly with proper headers
    const filePath = path.join(process.cwd(), "public", pdfRelativeUrl);
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${audit.business.name.replace(/[^a-zA-Z0-9]/g, "_")}_Audit.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF download error:", error);
    return NextResponse.json({ error: "Failed to download PDF report" }, { status: 500 });
  }
}
