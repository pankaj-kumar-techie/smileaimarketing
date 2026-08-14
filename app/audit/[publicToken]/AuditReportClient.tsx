"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import StatusBadge, { statusFromScore, type StatusLevel } from "@/components/ui/StatusBadge";
import { IconMapPin, IconCalendarCheck, IconSearch, IconStar, IconMonitor, IconPhoneWave, IconUsers } from "@/components/icons";

// Same status→accent-color mapping as the landing page's sample preview —
// used as a left-border "severity" indicator on each findings row, the way
// a lab/chart report flags a line item at a glance.
const STATUS_ACCENT: Record<StatusLevel, string> = {
  healthy: "var(--color-status-healthy-fg)",
  opportunity: "var(--color-status-opportunity-fg)",
  attention: "var(--color-status-attention-fg)",
};

type Finding = {
  category: string;
  score: number;
  title: string;
  detail: string;
  recommendation: string | null;
  findings: Record<string, unknown>;
};

// Same category → label/icon mapping as the landing page's sample preview
// (components/SampleAuditPreview.tsx), so the real report matches what was promised.
const CATEGORY_META: Record<string, { label: string; Icon: typeof IconSearch }> = {
  LOCAL_VISIBILITY: { label: "Patient Discovery", Icon: IconSearch },
  REPUTATION: { label: "Patient Trust", Icon: IconStar },
  WEBSITE_QUALITY: { label: "Website Experience", Icon: IconMonitor },
  CONVERSION: { label: "Booking Journey", Icon: IconPhoneWave },
  COMPETITOR_GAP: { label: "Competitive Position", Icon: IconUsers },
};
const CATEGORY_ORDER = ["LOCAL_VISIBILITY", "REPUTATION", "WEBSITE_QUALITY", "CONVERSION", "COMPETITOR_GAP"];

type Competitor = {
  name: string;
  rank: number;
  mapScore: number | null;
};

type Narrative = {
  headline: { line1: string; line2: string };
  dek: string;
  stats: Array<{ value: string; label: string; caption: string }>;
  fixCards: Array<{ title: string; detail: string; impact: string }>;
  quietLeaks: Array<{ title: string; detail: string }>;
};

type AuditData = {
  business: { name: string; website: string; city: string; opportunityScore: number };
  checkedAt: string;
  summary: string | null;
  narrative: Narrative;
  scorecard: {
    localVisibility: number;
    websiteQuality: number;
    conversionExperience: number;
    reviewsReputation: number;
    competitorGap: number;
  };
  findings: Finding[];
  competitors: Competitor[];
};

export default function AuditReportClient({ publicToken }: { publicToken: string }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Offline visit request state
  const [address, setAddress] = useState("");
  const [preferredWindow, setPreferredWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [visitSubmitted, setVisitSubmitted] = useState(false);
  const [visitLoading, setVisitLoading] = useState(false);
  const [visitError, setVisitError] = useState("");

  // Online booking state
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/audit/${publicToken}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load audit");
        }
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [publicToken]);

  const handleInPersonRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (visitLoading) return;
    setVisitLoading(true);
    setVisitError("");

    try {
      const res = await fetch(`/api/audit/${publicToken}/request-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, preferredWindow, notes }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to submit request");
      }
      setVisitSubmitted(true);
    } catch (err: unknown) {
      setVisitError(err instanceof Error ? err.message : "Error submitting visit request");
    } finally {
      setVisitLoading(false);
    }
  };

  const handleOnlineBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingLoading) return;
    if (!meetingTime || Number.isNaN(new Date(meetingTime).getTime())) {
      setBookingError("Please pick a date and time");
      return;
    }
    setBookingLoading(true);
    setBookingError("");

    try {
      const res = await fetch(`/api/audit/${publicToken}/book-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // meetingTime comes from a datetime-local input ("2026-08-08T23:56") —
        // no seconds or timezone, which fails the API's z.string().datetime()
        // validation. Convert to a real ISO string (UTC) before sending.
        body: JSON.stringify({ scheduledTime: new Date(meetingTime).toISOString(), notes: meetingNotes }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to schedule meeting");
      }
      setBookingSubmitted(true);
    } catch (err: unknown) {
      setBookingError(err instanceof Error ? err.message : "Error scheduling meeting");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-body-small font-semibold text-muted-foreground">Loading your audit report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
          <p className="text-heading-3 font-bold text-danger">Report Not Found</p>
          <p className="mt-3 text-body-small text-muted-foreground">
            {error || "Could not retrieve the specified audit report."}
          </p>
          <Link
            href="/free-dental-audit"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-body-small font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Run a New Audit
          </Link>
        </div>
      </div>
    );
  }

  const { business, checkedAt, summary, narrative, findings, competitors } = data;

  const orderedFindings = CATEGORY_ORDER
    .map((cat) => findings.find((f) => f.category === cat))
    .filter((f): f is Finding => Boolean(f));
  const strongest = orderedFindings.length > 0
    ? orderedFindings.reduce((a, b) => (a.score >= b.score ? a : b))
    : null;
  const biggestOpportunity = orderedFindings.length > 0
    ? orderedFindings.reduce((a, b) => (a.score <= b.score ? a : b))
    : null;
  const checkedAtLabel = new Date(checkedAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const localFinding = findings.find((f) => f.category === "LOCAL_VISIBILITY");
  const ownRank = localFinding?.findings.ownRank as number | null | undefined;
  const rankVerified = Boolean(localFinding?.findings.verified);
  const localScore = localFinding?.score ?? null;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground lg:pb-16">
      {/* Header — a letterhead-style metadata row first, like a chart a dentist already knows how to read */}
      <header className="border-b border-border bg-surface py-6 sm:py-8">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 border-b border-border pb-4 text-metadata">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                <span className="font-bold uppercase tracking-wider text-muted-foreground">Practice </span>
                <span className="font-semibold text-foreground">{business.name}</span>
              </span>
              <span>
                <span className="font-bold uppercase tracking-wider text-muted-foreground">Location </span>
                <span className="font-semibold text-foreground">{business.city}</span>
              </span>
            </div>
            <span>
              <span className="font-bold uppercase tracking-wider text-muted-foreground">Checked </span>
              <span className="font-semibold text-foreground">{checkedAtLabel}</span>
            </span>
          </div>

          <h1 className="mt-5 text-display font-extrabold leading-[1.05] tracking-tight text-foreground">
            {narrative.headline.line1}
            <br />
            <span className="inline-block rounded-lg bg-primary px-2 text-primary-foreground">{narrative.headline.line2}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">{narrative.dek}</p>

          {/* By the numbers */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {narrative.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-background p-3 sm:p-4">
                <span className="block text-heading-3 font-extrabold text-primary sm:text-heading-2">{s.value}</span>
                <span className="mt-1 block text-metadata font-bold uppercase tracking-wider text-foreground">{s.label}</span>
                <span className="block text-[11px] text-muted-foreground">{s.caption}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 grid max-w-[1200px] gap-8 px-6 sm:px-8 lg:grid-cols-[63%_37%]">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Practice Assessment — the real, plain-English synthesis of this audit */}
          {summary && (
            <div
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: "var(--color-primary)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-heading-3 font-semibold text-foreground">Practice Assessment</h2>
                <span className="shrink-0 text-right">
                  <span className="block text-heading-2 font-extrabold text-primary">
                    {business.opportunityScore}<span className="text-body-small font-normal text-muted-foreground">/100</span>
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opportunity</span>
                </span>
              </div>
              <p className="mt-3 text-body leading-relaxed text-foreground">{summary}</p>

              {strongest && biggestOpportunity && strongest.category !== biggestOpportunity.category && (
                <p className="mt-4 border-t border-border pt-4 text-body-small text-muted-foreground">
                  <span className="font-bold text-foreground">Strongest: </span>
                  {CATEGORY_META[strongest.category]?.label ?? strongest.category}
                  <span className="mx-2 text-border">·</span>
                  <span className="font-bold text-foreground">Biggest opportunity: </span>
                  {CATEGORY_META[biggestOpportunity.category]?.label ?? biggestOpportunity.category}
                </p>
              )}
            </div>
          )}

          {/* Findings by Area — the real per-category findings, same 5-area model as the sample preview */}
          {orderedFindings.length > 0 && (
            <div className="space-y-4">
              <h2 className="px-1 text-heading-3 font-semibold text-foreground">Findings by area</h2>
              <div className="space-y-3">
                {orderedFindings.map((f) => {
                  const meta = CATEGORY_META[f.category];
                  const Icon = meta?.Icon ?? IconMapPin;
                  const status = statusFromScore(f.score);
                  return (
                    <div
                      key={f.category}
                      className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                      style={{ borderLeftWidth: 4, borderLeftColor: STATUS_ACCENT[status] }}
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <div>
                              <p className="text-body font-semibold text-foreground">{meta?.label ?? f.category}</p>
                              <p className="text-metadata text-muted-foreground">{f.title}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-body font-bold text-foreground">
                                {f.score}<span className="text-metadata font-normal text-muted-foreground">/100</span>
                              </span>
                              <StatusBadge status={status} />
                            </div>
                          </div>
                          <p className="mt-2.5 text-body-small leading-relaxed text-foreground">{f.detail}</p>
                          {f.recommendation && (
                            <p className="mt-2.5 border-t border-border pt-2.5 text-body-small leading-relaxed text-muted-foreground">
                              <span className="font-bold text-foreground">Recommendation — </span>
                              {f.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fixes — only real, verified issues, each with a plain-language impact range */}
          <div className="space-y-4">
            <h2 className="px-1 text-heading-3 font-semibold text-foreground">Top priorities</h2>
            {narrative.fixCards.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-body-small leading-relaxed text-muted-foreground">
                  Nothing here scored low enough to call a real weak point — every category is holding up well.
                </p>
              </div>
            ) : (
              narrative.fixCards.map((item, idx) => (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="text-body font-bold text-foreground">{item.title}</h3>
                    <p className="text-body-small leading-relaxed text-muted-foreground">{item.detail}</p>
                    <p className="text-metadata font-bold text-primary">{item.impact}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quiet leaks — secondary issues worth knowing about */}
          {narrative.quietLeaks.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface-muted/30 p-6">
              <h2 className="text-heading-3 font-semibold text-foreground">Also noted</h2>
              <div className="mt-4 space-y-3">
                {narrative.quietLeaks.map((q) => (
                  <div key={q.title} className="border-l-2 border-primary/40 pl-4">
                    <p className="text-body-small font-bold text-foreground">{q.title}</p>
                    <p className="mt-0.5 text-body-small text-muted-foreground">{q.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Gap Panel */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-heading-3 font-semibold text-foreground">Who&apos;s winning the patients you&apos;re missing</h2>
            <p className="mt-1 mb-6 text-body-small text-muted-foreground">
              Your local search strength vs. nearby practices in {business.city}.
            </p>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-primary/30 bg-accent-soft/50 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-metadata font-bold text-primary-foreground">
                      {rankVerified && ownRank != null ? `#${ownRank}` : "You"}
                    </span>
                    <span className="truncate text-body-small font-bold text-foreground">{business.name}</span>
                  </div>
                  <span className="shrink-0 text-body-small font-bold text-primary">
                    {localScore != null ? `${localScore}/100` : "—"}
                  </span>
                </div>
                {localScore != null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${localScore}%` }} />
                  </div>
                )}
              </div>

              {competitors.map((c, index) => (
                <div key={index} className="rounded-xl border border-border p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-metadata font-bold text-muted-foreground">
                        #{c.rank}
                      </span>
                      <span className="truncate text-body-small font-medium text-foreground">{c.name}</span>
                    </div>
                    {c.mapScore != null && (
                      <span className="flex shrink-0 items-center gap-1 text-body-small font-semibold text-muted-foreground">
                        <IconStar className="h-3.5 w-3.5" />
                        {c.mapScore}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {competitors.length === 0 && (
              <p className="mt-4 text-body-small text-muted-foreground">
                We couldn&apos;t pull a verified competitor list for {business.city} this time — everything else in this report is still based on your real data.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Consultation actions */}
        <div id="consultation" className="scroll-mt-6 space-y-8">
          {/* Online consultation */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
              <IconCalendarCheck className="h-5 w-5" />
            </span>
            <h3 className="text-body font-bold text-foreground">Talk it through, 15 minutes on video</h3>
            <p className="mt-2 text-body-small leading-relaxed text-muted-foreground">
              We&apos;ll screen-share this report together and show you exactly what a patient sees when they search for a dentist near you — no pitch, just the facts.
            </p>

            {bookingSubmitted ? (
              <div className="mt-6 rounded-xl border border-primary/20 bg-accent-soft p-4 text-center text-body-small font-semibold text-primary">
                Meeting request sent! Calendar details are on their way to your email.
              </div>
            ) : (
              <form onSubmit={handleOnlineBooking} className="mt-6 space-y-4" noValidate>
                {bookingError && (
                  <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-center text-metadata font-semibold text-danger">
                    {bookingError}
                  </div>
                )}
                <FormField id="meeting-time" label="Select Date & Time" required optionalLabel={false}>
                  <Input
                    id="meeting-time"
                    type="datetime-local"
                    required
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                  />
                </FormField>
                <FormField id="meeting-notes" label="Notes / Special Requests">
                  <Textarea
                    id="meeting-notes"
                    rows={3}
                    placeholder="e.g. Discuss my maps ranking specifically..."
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                  />
                </FormField>
                <Button type="submit" fullWidth loading={bookingLoading} disabled={bookingLoading}>
                  Schedule My Video Review
                </Button>
              </form>
            )}
          </div>

          {/* In-person visit */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
              <IconMapPin className="h-5 w-5" />
            </span>
            <h3 className="text-body font-bold text-foreground">Or we&apos;ll come to you</h3>
            <p className="mt-2 text-body-small leading-relaxed text-muted-foreground">
              A local consultant visits your practice and walks your whole team through the findings in person.
            </p>

            {visitSubmitted ? (
              <div className="mt-6 rounded-xl border border-primary/20 bg-accent-soft p-4 text-center text-body-small font-semibold text-primary">
                Visit request received! We&apos;ll confirm a timing window shortly.
              </div>
            ) : (
              <form onSubmit={handleInPersonRequest} className="mt-6 space-y-4" noValidate>
                {visitError && (
                  <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-center text-metadata font-semibold text-danger">
                    {visitError}
                  </div>
                )}
                <FormField id="visit-address" label="Clinic Address" required optionalLabel={false}>
                  <Input
                    id="visit-address"
                    type="text"
                    required
                    autoComplete="street-address"
                    placeholder="e.g. 123 Main St, Suite 4"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </FormField>
                <FormField id="visit-window" label="Preferred Window" required optionalLabel={false}>
                  <Input
                    id="visit-window"
                    type="text"
                    required
                    placeholder="e.g. Tuesday morning, 9-11am"
                    value={preferredWindow}
                    onChange={(e) => setPreferredWindow(e.target.value)}
                  />
                </FormField>
                <FormField id="visit-notes" label="Notes">
                  <Textarea
                    id="visit-notes"
                    rows={2}
                    placeholder="Anything our consultant should know before visiting?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </FormField>
                <Button type="submit" variant="secondary" fullWidth loading={visitLoading} disabled={visitLoading}>
                  Submit Visit Request
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Mobile sticky CTA — the consultation forms sit at the bottom of a long report;
          give mobile readers a fast path without reordering the report itself. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 backdrop-blur-sm lg:hidden">
        <a
          href="#consultation"
          className="flex h-12 items-center justify-center rounded-full bg-primary text-body-small font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Talk To Us About This Report
        </a>
      </div>
    </div>
  );
}
