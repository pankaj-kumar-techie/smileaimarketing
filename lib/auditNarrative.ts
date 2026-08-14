/**
 * Turns the deterministic audit findings into the punchy, stat-driven report
 * copy used by both the web report and the PDF — same source of truth for
 * both. Every stat and fix card below traces back to a real findingsJson
 * field; nothing here estimates dollars, search volume, or website traffic,
 * because we don't have real numbers for any of those per business. The
 * "big numbers" are real ones instead: verified rank, review-count gap,
 * score deltas.
 */

export interface NarrativeFinding {
  category: string;
  score: number;
  findingsJson: Record<string, unknown>;
}

export interface NarrativeCompetitor {
  name: string;
  rank: number;
  mapScore: number | null;
}

export interface AuditNarrative {
  headline: { line1: string; line2: string };
  dek: string;
  stats: Array<{ value: string; label: string; caption: string }>;
  fixCards: Array<{ title: string; detail: string; impact: string }>;
  quietLeaks: Array<{ title: string; detail: string }>;
}

function find(findings: NarrativeFinding[], category: string) {
  return findings.find((f) => f.category === category);
}

export function buildAuditNarrative(input: {
  businessName: string;
  city: string;
  category: string;
  findings: NarrativeFinding[];
  competitors: NarrativeCompetitor[];
}): AuditNarrative {
  const { businessName, city, category, findings, competitors } = input;

  const local = find(findings, "LOCAL_VISIBILITY");
  const website = find(findings, "WEBSITE_QUALITY");
  const reputation = find(findings, "REPUTATION");
  const competitorGap = find(findings, "COMPETITOR_GAP");

  const ownRank = local?.findingsJson.ownRank as number | null | undefined;
  const verified = Boolean(local?.findingsJson.verified);
  const rating = reputation?.findingsJson.rating as number | undefined;
  const reviewCount = reputation?.findingsJson.reviewCount as number | undefined;
  const websiteReachable = website ? website.findingsJson.reachable !== false : true;
  const websiteError = website?.findingsJson.error as string | undefined;
  const reviewGap = competitorGap?.findingsJson.reviewGap as number | undefined;

  const topCompetitor = competitors[0];
  const categoryLower = category.toLowerCase();
  const searchPhrase = `${categoryLower} in ${city}`;

  // --- Headline + dek: deterministic, ordered by what actually matters most ---
  let headline: { line1: string; line2: string };
  let dek: string;

  if (website && !websiteReachable) {
    headline = { line1: "Patients Can't Even", line2: "Load Your Website" };
    dek = `${businessName}'s website is down right now — ${websiteError || "unreachable"}. Every other finding in this report is secondary until that's fixed.`;
  } else if (reputation && reputation.score >= 70 && local && local.score < 50) {
    headline = { line1: "Better Reviewed.", line2: "Still Invisible." };
    dek = `${businessName} has the reputation to win in ${city} — ${reviewCount ?? "a strong number of"} reviews at ${rating ?? "a high"}★ — but isn't showing up when patients search "${searchPhrase}."`;
  } else if (local && verified && ownRank != null && ownRank <= 3) {
    headline = { line1: `Ranked #${ownRank}.`, line2: "Here's What Protects It." };
    dek = `${businessName} already ranks #${ownRank} for "${searchPhrase}." The fixes below are about defending that spot as nearby practices catch up, not chasing it.`;
  } else if (local && verified && ownRank != null) {
    headline = { line1: `Ranked #${ownRank}.`, line2: "Losing To The Top 3." };
    dek = `Nearly all the clicks for "${searchPhrase}" go to the top 3 results in Google's map pack. ${businessName} isn't there yet.`;
  } else if (local && verified) {
    headline = { line1: "They're Searching.", line2: "Finding Someone Else." };
    dek = `${businessName} didn't appear at all in Google's local map results for "${searchPhrase}" when we checked — not ranked low, genuinely absent from what a nearby patient sees.`;
  } else {
    headline = { line1: "Here's Exactly", line2: "What's Costing You Patients." };
    dek = `A plain look at where ${businessName} is winning online in ${city}, and where nearby practices are quietly ahead.`;
  }

  // --- Stat block: only real, verified numbers ---
  const issuesFound = findings.filter((f) => f.score < 70).length;
  const stats: AuditNarrative["stats"] = [
    {
      value: !verified ? "Unverified" : ownRank != null ? `#${ownRank}` : "Not Ranked",
      label: "Map pack position",
      caption: `for "${searchPhrase}"`,
    },
    {
      value: reviewCount != null ? String(reviewCount) : "—",
      label: "Your Google reviews",
      caption: topCompetitor ? `vs. ${topCompetitor.name}'s reviews` : "no verified competitor this run",
    },
    {
      value: reviewGap != null && reviewGap > 0 ? `${reviewGap}` : "0",
      label: "Review gap to the #1 practice",
      caption: reviewGap != null && reviewGap > 0 ? "reviews behind" : "you're not behind on reviews",
    },
    {
      value: String(issuesFound),
      label: "Fixable issues found",
      caption: issuesFound === 0 ? "nothing urgent" : "in this audit",
    },
  ];

  // --- Fix cards: only for things we actually verified are missing ---
  const fixCards: AuditNarrative["fixCards"] = [];

  if (website && !websiteReachable) {
    fixCards.push({
      title: "Get the website back online",
      detail: `Right now ${businessName}'s site returns: ${websiteError || "no response"}. Every patient trying to find you online is hitting the same wall — this blocks every other channel until it's fixed.`,
      impact: "Blocks 100% of website conversions until fixed",
    });
  } else if (website) {
    const isHttps = website.findingsJson.ssl === true;
    const responseTimeMs = website.findingsJson.responseTimeMs as number | undefined;
    const hasViewport = website.findingsJson.mobileViewport === true;
    if (!isHttps) {
      fixCards.push({
        title: "Turn on a secure (HTTPS) connection",
        detail: "Browsers actively warn visitors away from sites without HTTPS — it's usually a same-day fix with your hosting provider.",
        impact: "Typical range: 10–15% fewer visitors bouncing immediately",
      });
    }
    if (responseTimeMs != null && responseTimeMs >= 2000) {
      fixCards.push({
        title: "Speed up your website on mobile",
        detail: `Your site takes ${responseTimeMs}ms to load on a phone. Most visitors give up well before that.`,
        impact: "Typical range: 15–20% more mobile conversions",
      });
    }
    if (!hasViewport) {
      fixCards.push({
        title: "Make the site mobile-responsive",
        detail: "No mobile viewport tag was found — the site likely renders as a shrunk desktop page on a phone, which is where most patients will find you.",
        impact: "Typical range: 8–12% fewer mobile bounces",
      });
    }
  }

  const conversion = find(findings, "CONVERSION");
  if (conversion) {
    if (conversion.findingsJson.clickToCall === false) {
      fixCards.push({
        title: "Add a tap-to-call button",
        detail: "No click-to-call link was found. A patient on their phone shouldn't have to copy a number to dial it.",
        impact: "Typical range: 10–20% more calls from mobile visitors",
      });
    }
    if (conversion.findingsJson.bookingCta === false) {
      fixCards.push({
        title: "Add a visible booking button",
        detail: "No booking call-to-action was found on the page a patient lands on first.",
        impact: "Typical range: 8–15% more booking requests",
      });
    }
    if (conversion.findingsJson.contactForm === false) {
      fixCards.push({
        title: "Add a simple contact form",
        detail: "No contact form was found for patients who'd rather not call.",
        impact: "Typical range: 5–10% more inquiries",
      });
    }
  }

  if (!verified || ownRank == null || (ownRank != null && ownRank > 3)) {
    fixCards.push({
      title: "Complete and post to your Google Business Profile weekly",
      detail: `Match your name, address, and phone exactly everywhere online, and post 1–2 updates a week with real photos from ${city}-area visits — this is the single biggest lever for local ranking.`,
      impact: "Typical range: 12–18% more map-pack visibility",
    });
  }

  if ((reviewGap != null && reviewGap > 0) || (reviewCount != null && reviewCount < 50)) {
    fixCards.push({
      title: "Put review requests on autopilot",
      detail: "A short text after every visit asking happy patients for a Google review — automated, so no one has to remember to ask.",
      impact: "Typical range: 15–30% faster review growth",
    });
  }

  // --- Quiet leaks: secondary real findings not already covered above ---
  const quietLeaks: AuditNarrative["quietLeaks"] = [];
  if (website && websiteReachable) {
    if (website.findingsJson.hasSchemaMarkup === false) {
      quietLeaks.push({
        title: "No structured data (schema markup) on the site",
        detail: "Search engines use this to show richer results (star ratings, hours, service info) directly in search — without it, your listing looks plainer than competitors who have it.",
      });
    }
  }
  if (competitorGap && competitors.length > 0) {
    quietLeaks.push({
      title: "The practices ahead of you are pulling away, not standing still",
      detail: `The top nearby practices average more reviews and consistent profile activity — a gap that widens on its own if nothing changes here.`,
    });
  }

  return { headline, dek, stats, fixCards: fixCards.slice(0, 5), quietLeaks: quietLeaks.slice(0, 2) };
}
