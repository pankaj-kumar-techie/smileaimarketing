"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { IconStar, IconUsers, IconTrendingUp, IconCheck } from "@/components/icons";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Reveal, AnimatedCounter } from "@/components/ui/Reveal";
import { trackEvent } from "@/lib/analytics.client";
import { TARGET_CITY, TARGET_PROVINCE } from "@/lib/siteConfig";

const TRUST_STATS: { Icon: typeof IconUsers; value: string; label: string }[] = [
  { Icon: IconUsers, value: "100+", label: "Dental Practices Helped" },
  { Icon: IconTrendingUp, value: "2–5X", label: "More Qualified Leads" },
  { Icon: IconStar, value: "5-Star", label: "Client Rated" },
];

export default function Hero() {
  const router = useRouter();

  const [website, setWebsite] = useState("");
  const [city, setCity] = useState("");

  const [websiteError, setWebsiteError] = useState("");
  const [cityError, setCityError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasStartedForm = useRef(false);

  const handleFormStart = () => {
    if (hasStartedForm.current) return;
    hasStartedForm.current = true;
    trackEvent("audit_form_start", { form_location: "hero" });
  };

  const validateInputs = () => {
    let isValid = true;

    const trimmedWeb = website.trim();
    if (!trimmedWeb) {
      setWebsiteError("Website is required");
      isValid = false;
    } else {
      const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
      const urlPattern = /^https?:\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
      if (!domainPattern.test(trimmedWeb) && !urlPattern.test(trimmedWeb)) {
        setWebsiteError("Please enter a valid practice website (e.g., dentalclinic.com)");
        isValid = false;
      } else {
        setWebsiteError("");
      }
    }

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setCityError("City is required");
      isValid = false;
    } else if (trimmedCity.length < 2) {
      setCityError("Please enter a valid city name");
      isValid = false;
    } else {
      setCityError("");
    }

    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateInputs()) return;

    trackEvent("audit_form_submit", { form_location: "hero" });
    setIsSubmitting(true);

    let normalizedWebsite = website.trim().toLowerCase();
    if (!/^https?:\/\//i.test(normalizedWebsite)) {
      normalizedWebsite = `https://${normalizedWebsite}`;
    }

    const params = new URLSearchParams({
      website: normalizedWebsite,
      city: city.trim(),
    });

    router.push(`/free-dental-audit?${params.toString()}`);
  };

  const handleScrollToSample = () => {
    const sampleSection = document.getElementById("sample-audit");
    if (sampleSection) {
      sampleSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="top" className="relative overflow-hidden bg-background pt-10 pb-16 sm:pt-16 sm:pb-24">
      {/* Ambient depth — a real practice, kept as quiet atmosphere, not a competing focal image */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_75%_at_30%_35%,transparent,black)]" aria-hidden>
        <Image
          src="/images/dental-operatory-calm.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.16]"
          quality={60}
        />
      </div>
      <div className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[110px]" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[360px] w-[360px] rounded-full bg-accent-soft blur-[110px]" aria-hidden />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 sm:px-8 lg:grid-cols-[50%_50%] lg:gap-10">

        {/* Left Column: Headline and Form */}
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-label text-xs tracking-wider text-muted-foreground">
              <span aria-hidden>🍁</span> BUILT FOR DENTAL PRACTICES IN {TARGET_CITY.toUpperCase()}, {TARGET_PROVINCE.toUpperCase()}
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-5 font-sans text-display text-foreground">
              See where your dental practice is missing new patient opportunities.
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-xl text-body-large text-muted-foreground">
              A clear review of what&apos;s costing you new patients — and what to fix first.
            </p>
          </Reveal>

          {/* Primary Form */}
          <Reveal delay={0.18}>
            <form
              onSubmit={handleSubmit}
              className="mt-8 max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-md"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="hero-website" label="Practice Website" required optionalLabel={false} error={websiteError}>
                  <Input
                    id="hero-website"
                    type="url"
                    required
                    disabled={isSubmitting}
                    autoComplete="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="url"
                    value={website}
                    onChange={(e) => {
                      handleFormStart();
                      setWebsite(e.target.value);
                    }}
                    placeholder="clinic.com"
                    hasError={!!websiteError}
                    aria-describedby={websiteError ? "hero-website-error" : undefined}
                  />
                </FormField>

                <FormField id="hero-city" label="Practice Location / City" required optionalLabel={false} error={cityError}>
                  <Input
                    id="hero-city"
                    type="text"
                    required
                    disabled={isSubmitting}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => {
                      handleFormStart();
                      setCity(e.target.value);
                    }}
                    placeholder="Toronto"
                    hasError={!!cityError}
                    aria-describedby={cityError ? "hero-city-error" : undefined}
                  />
                </FormField>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button type="submit" loading={isSubmitting} fullWidth className="sm:flex-1">
                  {isSubmitting ? "Preparing your audit..." : "Get My Free Practice Audit"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleScrollToSample}>
                  View Sample Audit
                </Button>
              </div>
            </form>
          </Reveal>

          {/* Trust Stats */}
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-5 border-t border-border pt-6">
              {TRUST_STATS.map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                    <stat.Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-heading-3 font-bold text-foreground">
                      {stat.value === "100+" ? <AnimatedCounter value={100} suffix="+" /> : stat.value}
                    </p>
                    <p className="text-metadata text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Trust Microcopy */}
          <Reveal delay={0.3}>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-metadata text-muted-foreground">
              {["No Google account access required", "No obligation"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Right Column: Practice photo with floating result cards */}
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          {/* Decorative halo behind the photo */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="h-[85%] w-[85%] rounded-full bg-primary/10 blur-[90px]" />
          </div>

          <Reveal delay={0.15}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border shadow-xl">
              <Image
                src="/images/dental-operatory-bright.jpg"
                alt="A modern, welcoming dental practice interior"
                fill
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
                quality={80}
              />
            </div>
          </Reveal>

          {/* Floating result cards */}
          <Reveal
            delay={0.4}
            className="absolute -left-2 top-8 w-36 rounded-2xl border border-border bg-surface p-3.5 shadow-lg sm:-left-6 sm:w-40"
          >
            <p className="text-metadata font-semibold text-muted-foreground">Appointments Booked</p>
            <p className="mt-1 text-heading-3 font-bold text-primary">
              <AnimatedCounter value={120} prefix="+" suffix="%" />
            </p>
          </Reveal>

          <Reveal
            delay={0.5}
            className="absolute -right-2 top-1/3 w-36 rounded-2xl border border-border bg-surface p-3.5 shadow-lg sm:-right-6 sm:w-40"
          >
            <p className="text-metadata font-semibold text-muted-foreground">New Patients</p>
            <p className="mt-1 text-heading-3 font-bold text-success">
              <AnimatedCounter value={150} prefix="+" suffix="%" />
            </p>
          </Reveal>

          <Reveal
            delay={0.6}
            className="absolute -bottom-4 right-4 w-28 rounded-2xl border border-border bg-surface p-3.5 shadow-lg sm:-bottom-6 sm:right-8"
          >
            <p className="text-metadata font-semibold text-muted-foreground">ROI</p>
            <p className="mt-1 text-heading-3 font-bold text-foreground">2.7x</p>
          </Reveal>

          {/* Accent badge */}
          <div
            className="absolute -left-3 bottom-16 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg sm:-left-5"
            aria-hidden
          >
            <IconCheck className="h-5 w-5" />
          </div>
        </div>

      </div>
    </section>
  );
}
