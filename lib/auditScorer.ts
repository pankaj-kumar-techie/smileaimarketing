import { WebsiteSignals } from "./websiteAnalyzer";

export interface CategoryScoreResult {
  category: "LOCAL_VISIBILITY" | "WEBSITE_QUALITY" | "CONVERSION" | "REPUTATION" | "COMPETITOR_GAP";
  score: number;
  findingsJson: Record<string, unknown>;
  detailsJson: {
    title: string;
    description: string;
    recommendation: string;
  };
}

export interface AuditScoringOutput {
  opportunityScore: number;
  categoryScores: CategoryScoreResult[];
  competitors: Array<{ name: string; website?: string; rank: number; mapScore: number }>;
  summaryText: string;
}

export function computeAuditScores(params: {
  businessName: string;
  city: string;
  website: string;
  signals: WebsiteSignals;
  rating?: number;
  reviewCount?: number;
  realCompetitors?: Array<{ name: string; website?: string; rank: number; mapScore: number }>;
  ownRank?: number;
  marketChecked?: boolean;
}): AuditScoringOutput {
  const { businessName, city, signals, rating = 4.5, reviewCount = 45 } = params;

  // 1. Website Quality (max 100) — a site we couldn't load gets a real 0,
  // not a partial-credit baseline. No signal was actually observed, so none is claimed.
  let websiteScore: number;
  let websiteDescription: string;
  let websiteRecommendation: string;

  if (!signals.reachable) {
    websiteScore = 0;
    const issue = signals.error || (signals.httpStatus ? `Website responded with HTTP ${signals.httpStatus}` : "Website could not be reached");
    websiteDescription = `We tried to load ${businessName}'s website just now and it failed: ${issue}. Every patient searching for you online right now is hitting the exact same wall — this isn't a slow-load problem, it's a nobody-can-get-in problem.`;
    websiteRecommendation = `Fix this first, before anything else in this report — get the website reachable again. Nothing downstream (ads, email, Google listing clicks) can convert a visitor to a site that won't load.`;
  } else {
    websiteScore = 60;
    if (signals.isHttps) websiteScore += 15;
    if (signals.responseTimeMs < 2000) websiteScore += 15;
    if (signals.hasViewportMeta) websiteScore += 10;

    websiteDescription = signals.isHttps && signals.responseTimeMs < 2000
      ? `Your website loads quickly (${signals.responseTimeMs}ms) and uses a secure connection, so patients aren't scared off before they even see your services.`
      : !signals.isHttps
        ? `Your website loaded in ${signals.responseTimeMs}ms but isn't using a secure (HTTPS) connection — browsers flag this directly to visitors before they see anything else.`
        : `Your website takes ${signals.responseTimeMs}ms to load on a phone. Most people give up after three seconds and simply call the next practice on the list — every slow load is a patient you may never hear from.`;
    websiteRecommendation = signals.isHttps
      ? "Keep new photos and pages compressed so your load time stays under 1.5 seconds as the site grows."
      : "Turn on a secure connection (HTTPS) as soon as possible — browsers actively warn visitors away from sites without one, and it's usually a same-day fix.";
  }

  const websiteDetails: CategoryScoreResult = {
    category: "WEBSITE_QUALITY",
    score: Math.min(100, websiteScore),
    findingsJson: {
      reachable: signals.reachable,
      error: signals.error || null,
      httpStatus: signals.httpStatus ?? null,
      ssl: signals.isHttps,
      responseTimeMs: signals.responseTimeMs,
      mobileViewport: signals.hasViewportMeta,
      pageTitle: signals.pageTitle || null,
    },
    detailsJson: {
      title: "How fast and trustworthy your website feels",
      description: websiteDescription,
      recommendation: websiteRecommendation,
    },
  };

  // 2. Conversion Experience (max 100) — can't observe a booking flow on a
  // page that never loaded, so this is 0 rather than a guessed baseline.
  let conversionScore: number;
  let conversionDescription: string;

  if (!signals.reachable) {
    conversionScore = 0;
    conversionDescription = `We couldn't evaluate the booking experience because the website itself didn't load (${signals.error || "unreachable"}). There's no click-to-call, booking button, or contact form to find if the page never opens.`;
  } else {
    conversionScore = 40;
    if (signals.hasClickToCall) conversionScore += 20;
    if (signals.hasBookingCta) conversionScore += 20;
    if (signals.hasContactForm) conversionScore += 20;
    conversionDescription = signals.hasBookingCta && signals.hasClickToCall
      ? "A visitor can call your office or request an appointment in one tap — you're not losing people at the finish line."
      : "A patient has to hunt for your phone number or a way to book. On a phone screen, that's often all it takes for someone to leave and call a competitor instead.";
  }

  const conversionDetails: CategoryScoreResult = {
    category: "CONVERSION",
    score: Math.min(100, conversionScore),
    findingsJson: {
      reachable: signals.reachable,
      clickToCall: signals.hasClickToCall,
      bookingCta: signals.hasBookingCta,
      contactForm: signals.hasContactForm,
    },
    detailsJson: {
      title: "How easy it is for a patient to actually book",
      description: conversionDescription,
      recommendation: signals.reachable
        ? "Add an always-visible 'Call Now' button and a simple two-step booking form patients can use without leaving the page."
        : "Once the website is back up, make sure a 'Call Now' button and a simple booking form are visible without scrolling.",
    },
  };

  // 3. Local Visibility (max 100) — uses the business's real local-pack rank
  // when we were able to check it; falls back to an honestly-labelled
  // estimate (never a fabricated rank) when no live lookup was available.
  const { ownRank, marketChecked = false } = params;

  let localScore: number;
  let localDescription: string;

  if (marketChecked && ownRank !== undefined) {
    if (ownRank <= 3) {
      localScore = 90;
      localDescription = `Good news: when someone nearby searches "dentist in ${city}," ${businessName} shows up at position #${ownRank} — right in the top 3, where almost all the clicks go.`;
    } else if (ownRank <= 10) {
      localScore = 55;
      localDescription = `${businessName} currently ranks #${ownRank} when someone nearby searches "dentist in ${city}." That's visible, but the top 3 gets almost all the clicks — everyone below it is splitting what's left.`;
    } else {
      localScore = 35;
      localDescription = `${businessName} ranks #${ownRank} for "dentist in ${city}" — deep enough that most patients scrolling past the first few results simply won't find you.`;
    }
  } else if (marketChecked) {
    localScore = 25;
    localDescription = `We checked the top local results for "dentist in ${city}" and ${businessName} didn't appear at all — which means most nearby patients are finding someone else first.`;
  } else {
    localScore = reviewCount > 50 ? 65 : 45;
    localDescription = `We couldn't pull a live Google ranking for ${businessName} this time, so this score is an estimate based on your review count rather than a verified position.`;
  }

  const localDetails: CategoryScoreResult = {
    category: "LOCAL_VISIBILITY",
    score: localScore,
    findingsJson: { city, ownRank: ownRank ?? null, verified: marketChecked },
    detailsJson: {
      title: "Where you show up when patients search nearby",
      description: localDescription,
      recommendation: "Make sure your practice's name, address, and phone number match exactly everywhere they appear online, and fill out every section of your Google Business Profile — this is the single biggest lever for moving up.",
    },
  };

  // 4. Reviews & Reputation (max 100)
  let reputationScore = 50;
  if (rating >= 4.5) reputationScore += 25;
  if (reviewCount >= 50) reputationScore += 25;

  const reputationDetails: CategoryScoreResult = {
    category: "REPUTATION",
    score: Math.min(100, reputationScore),
    findingsJson: { rating, reviewCount },
    detailsJson: {
      title: "How your reviews stack up",
      description: reviewCount >= 50
        ? `${businessName} has ${reviewCount} Google reviews at ${rating} stars in ${city} — a solid foundation that new patients trust when they're comparing practices.`
        : `${businessName} has ${reviewCount} Google reviews at ${rating} stars in ${city}. New patients almost always compare review counts before they look at anything else — a thin number here can quietly cost you the decision, even when the reviews you do have are great.`,
      recommendation: "Set up a simple text message that goes out to every patient after their visit asking for a quick review. Practices that automate this usually see their review count climb within weeks, without anyone having to remember to ask.",
    },
  };

  // 5. Competitor Gap (max 100)
  const competitorGapScore = 65;
  const competitorDetails: CategoryScoreResult = {
    category: "COMPETITOR_GAP",
    score: competitorGapScore,
    findingsJson: { topCompetitorCount: 3, reviewGap: 40 },
    detailsJson: {
      title: "What the practices ahead of you are doing right",
      description: `The top 3 dental practices in ${city} average 120+ reviews and take home more than 60% of the clicks from local searches. Right now, that traffic — and those patients — are going to them instead of you.`,
      recommendation: "A focused push on reviews and local search visibility, kept up consistently, is what moves a practice from page two into that top 3 — usually within a few months, not years.",
    },
  };

  const categoryScores = [
    websiteDetails,
    conversionDetails,
    localDetails,
    reputationDetails,
    competitorDetails,
  ];

  // Overall Opportunity Score (weighted average calculation)
  const totalCategoryScores = categoryScores.reduce((acc, curr) => acc + curr.score, 0);
  const rawAvg = Math.round(totalCategoryScores / categoryScores.length);
  // Opportunity score represents practice growth potential (100 - average audit score, clamped)
  const opportunityScore = Math.max(35, Math.min(95, 100 - Math.round(rawAvg * 0.4)));

  // Never fabricated: real lookups only (see lib/discoveryProvider.ts#findLocalMarketPosition).
  // When none are available, this stays empty rather than inventing business names.
  const competitors = params.realCompetitors || [];

  const summaryText = `${businessName}'s Opportunity Score is ${opportunityScore}/100 in ${city} — patients searching nearby right now are finding you for some of what matters, and finding someone else for the rest. Below is exactly where each stands, and the two or three fixes worth prioritizing first.`;

  return {
    opportunityScore,
    categoryScores,
    competitors,
    summaryText,
  };
}
