"use client";

import { IconSearch, IconMapPin, IconMonitor, IconPhoneWave, IconChevronDown } from "@/components/icons";
import { Reveal, RevealGroup, revealItem, motion } from "@/components/ui/Reveal";
import { TARGET_CITY } from "@/lib/siteConfig";

const STEPS: { Icon: typeof IconSearch; title: string; detail: string; callout?: string }[] = [
  {
    Icon: IconSearch,
    title: "Searches nearby",
    detail: `A patient types "dentist near me" or "dentist in ${TARGET_CITY}."`,
  },
  {
    Icon: IconMapPin,
    title: "Compares a few options",
    detail: "They glance at the top few results on Google — ratings, reviews, distance.",
    callout: "Most patients only ever consider what they see first.",
  },
  {
    Icon: IconMonitor,
    title: "Checks the website",
    detail: "If a practice looks promising, they tap through to see if it feels trustworthy and easy to book with.",
    callout: "A slow or confusing site often ends the visit right here.",
  },
  {
    Icon: IconPhoneWave,
    title: "Calls or books",
    detail: "The patients who make it this far look for a phone number or booking button.",
    callout: "A hard-to-find number or booking step can cost the enquiry.",
  },
];

export default function PatientJourney() {
  return (
    <section id="patient-journey" className="border-t border-border bg-surface-muted/40">
      <div className="mx-auto max-w-[1200px] px-6 py-16 sm:py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-label text-xs tracking-wider text-primary">
            WHY THIS MATTERS
          </span>
          <h2 className="mt-4 text-heading-1 font-semibold text-foreground">
            How a patient actually finds a dentist.
          </h2>
          <p className="mt-4 text-body text-muted-foreground">
            Four steps, every time. Your audit checks each one — this is where practices quietly lose patients along the way.
          </p>
        </div>

        <RevealGroup
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-start lg:gap-4"
          stagger={0.1}
        >
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-stretch gap-2">
              <motion.div
                variants={revealItem}
                className="flex flex-1 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <step.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-body font-semibold text-foreground">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className="mt-1.5 text-body-small leading-relaxed text-muted-foreground">{step.detail}</p>
                {step.callout && (
                  <p className="badge-attention mt-3 rounded-lg border px-3 py-2 text-metadata font-semibold">
                    {step.callout}
                  </p>
                )}
              </motion.div>

              {/* Connector — down arrow between vertically stacked steps (mobile/tablet only) */}
              {i < STEPS.length - 1 && (
                <div
                  className="flex shrink-0 items-center justify-center text-border lg:hidden"
                  aria-hidden
                >
                  <IconChevronDown className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </RevealGroup>

        <Reveal delay={0.2} className="mx-auto mt-10 max-w-lg text-center">
          <p className="text-body-small text-muted-foreground">
            Your free checkup reviews exactly where {`${TARGET_CITY}`}-area patients are dropping off in this journey today.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
