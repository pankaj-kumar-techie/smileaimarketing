"use client";

import { IconSearch, IconStar, IconMonitor, IconPhoneWave, IconUsers } from "@/components/icons";
import StatusBadge, { type StatusLevel, statusFromScore } from "@/components/ui/StatusBadge";
import { Reveal, RevealGroup, revealItem, motion } from "@/components/ui/Reveal";

const BAR_COLOR: Record<StatusLevel, string> = {
  healthy: "var(--color-status-healthy-fg)",
  opportunity: "var(--color-status-opportunity-fg)",
  attention: "var(--color-status-attention-fg)",
};

const CATEGORIES: {
  Icon: typeof IconSearch;
  label: string;
  score: number;
  explanation: string;
}[] = [
  {
    Icon: IconSearch,
    label: "Patient Discovery",
    score: 42,
    explanation: "Patients searching nearby aren't seeing your practice as often as they should.",
  },
  {
    Icon: IconStar,
    label: "Patient Trust",
    score: 78,
    explanation: "Your reviews and reputation are already working in your favor.",
  },
  {
    Icon: IconMonitor,
    label: "Website Experience",
    score: 61,
    explanation: "Your site is slower and harder to use on mobile than nearby competitors.",
  },
  {
    Icon: IconPhoneWave,
    label: "Booking Journey",
    score: 54,
    explanation: "It takes a few extra steps before a patient can request an appointment.",
  },
];

export default function SampleAuditPreview() {
  const handleScrollToHero = () => {
    const heroSection = document.getElementById("top");
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="sample-audit" className="border-t border-border bg-white scroll-mt-16">
      <div className="mx-auto max-w-[1200px] px-6 py-16 sm:py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-label text-xs tracking-wider text-primary">
            SAMPLE AUDIT PREVIEW
          </span>
          <h2 className="mt-4 text-heading-1 font-semibold text-foreground">
            Your practice, through a patient&apos;s eyes.
          </h2>
          <p className="mt-4 text-body text-muted-foreground">
            We review the same journey a prospective patient takes — from searching locally to choosing a practice and requesting an appointment.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-background shadow-md">
          {/* Header Panel */}
          <div className="flex flex-col gap-3 border-b border-border bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-body font-semibold text-foreground">Metro Dental Care</span>
                <span className="text-metadata">— Toronto, ON</span>
              </div>
            </div>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 font-label text-[10px] tracking-wider text-muted-foreground">
              Sample data
            </span>
          </div>

          {/* Category rows */}
          <RevealGroup className="divide-y divide-border" stagger={0.08}>
            {CATEGORIES.map((c) => {
              const status = statusFromScore(c.score);
              return (
              <motion.div
                key={c.label}
                variants={revealItem}
                className="grid grid-cols-1 gap-4 bg-surface p-6 sm:grid-cols-[1.4fr_1fr] sm:items-center sm:gap-8"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
                    <c.Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-body font-semibold text-foreground">{c.label}</p>
                    <p className="mt-1 text-body-small text-muted-foreground leading-relaxed">{c.explanation}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body font-bold text-foreground">{c.score}<span className="text-muted-foreground"> / 100</span></span>
                    <StatusBadge status={status} />
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: BAR_COLOR[status] }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${c.score}%` }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </motion.div>
              );
            })}

            {/* Competitive position - qualitative, no score */}
            <motion.div
              variants={revealItem}
              className="grid grid-cols-1 gap-4 bg-surface p-6 sm:grid-cols-[1.4fr_1fr] sm:items-center sm:gap-8"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
                  <IconUsers className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-body font-semibold text-foreground">Competitive Position</p>
                  <p className="mt-1 text-body-small text-muted-foreground leading-relaxed">
                    Nearby practices currently have an advantage in local search visibility.
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-body font-bold text-foreground">3 practices</span>
                <span className="text-muted-foreground"> currently ahead</span>
              </div>
            </motion.div>
          </RevealGroup>
        </div>

        <Reveal delay={0.15} className="mt-10 text-center">
          <button
            onClick={handleScrollToHero}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 font-body text-base font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Get My Free Practice Audit
          </button>
        </Reveal>
      </div>
    </section>
  );
}
