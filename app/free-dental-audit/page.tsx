"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ProgressSteps from "@/components/ui/ProgressSteps";
import { IconCheck } from "@/components/icons";
import { trackEvent } from "@/lib/analytics.client";

type WizardStep = "details" | "processing" | "preview" | "contact";

const STEP_LABELS = ["Practice Details", "Analyzing", "Preview", "Contact Details"];
const STEP_INDEX: Record<WizardStep, number> = {
  details: 1,
  processing: 2,
  preview: 3,
  contact: 4,
};

const SCAN_MESSAGES = [
  "Checking local search visibility...",
  "Testing website speed & mobile layout...",
  "Comparing nearby competitors...",
  "Compiling your opportunity score...",
];

type Preliminary = {
  sslValid: boolean;
  pageSpeedEstimate: string;
  mobileOptimized: boolean;
};

function ProcessingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, SCAN_MESSAGES.length - 1));
    }, 700);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in space-y-8 py-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/25 border-t-primary" />
      </div>
      <div>
        <h1 className="text-heading-2 font-semibold text-foreground">Running your free audit</h1>
        <p className="mt-2 text-body-small text-muted-foreground" aria-live="polite">
          {SCAN_MESSAGES[messageIndex]}
        </p>
      </div>
      <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${((messageIndex + 1) / SCAN_MESSAGES.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function AuditWizardForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scanInFlight = useRef(false);

  // Step 1: practice details
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("CA");
  const [websiteError, setWebsiteError] = useState("");
  const [cityError, setCityError] = useState("");

  // Results of the scan
  const [pendingAuditId, setPendingAuditId] = useState("");
  const [preliminary, setPreliminary] = useState<Preliminary | null>(null);

  // Step 4: contact details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const contactSubmitting = useRef(false);

  useEffect(() => {
    if (step === "processing") trackEvent("audit_processing_view", {});
    else if (step === "preview") trackEvent("audit_preview_view", {});
    else if (step === "contact") trackEvent("report_unlock_start", {});
  }, [step]);

  const runScan = async (siteUrl: string, targetCity: string) => {
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    setError("");
    setStep("processing");

    let formattedUrl = siteUrl;
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 2200));

    try {
      const res = await fetch("/api/audit/inbound-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: formattedUrl,
          city: targetCity,
          clinicName: "My Dental Practice",
          country,
        }),
      });
      const data = await res.json();
      await minDelay;

      if (!res.ok) {
        throw new Error(data.error || "We couldn't analyze that website. Please check the URL and try again.");
      }

      setPendingAuditId(data.pendingAuditId);
      setPreliminary(data.preliminaryFindings);
      setStep("preview");
    } catch (err: unknown) {
      await minDelay;
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("details");
    } finally {
      scanInFlight.current = false;
    }
  };

  // Auto-trigger when arriving from the homepage hero form
  useEffect(() => {
    const queryWebsite = searchParams.get("website");
    const queryCity = searchParams.get("city");

    if (queryWebsite && queryCity) {
      const decodedWebsite = decodeURIComponent(queryWebsite);
      const decodedCity = decodeURIComponent(queryCity);
      const timer = setTimeout(() => {
        setWebsite(decodedWebsite);
        setCity(decodedCity);
        runScan(decodedWebsite, decodedCity);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateDetails = () => {
    let isValid = true;
    const trimmedWebsite = website.trim();
    if (!trimmedWebsite) {
      setWebsiteError("Website is required");
      isValid = false;
    } else {
      setWebsiteError("");
    }

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setCityError("City is required");
      isValid = false;
    } else {
      setCityError("");
    }
    return isValid;
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;
    runScan(website.trim(), city.trim());
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!consent) {
      setConsentError("Please accept the communication consent to unlock your audit.");
      return;
    }
    setConsentError("");

    if (contactSubmitting.current) return;
    contactSubmitting.current = true;
    setLoading(true);

    try {
      const res = await fetch("/api/audit/unlock-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingAuditId,
          firstName,
          lastName,
          email,
          role,
          phone: phone || undefined,
          consent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unlock your report. Please try again.");
      }

      router.push(data.redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete the audit setup.");
      contactSubmitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
      {step !== "processing" && (
        <div className="mb-8">
          <ProgressSteps steps={STEP_LABELS} current={STEP_INDEX[step]} />
        </div>
      )}

      {/* STEP 1: Practice details */}
      {step === "details" && (
        <div className="animate-fade-in space-y-6">
          <div className="text-center">
            <Eyebrow>Free Practice Audit</Eyebrow>
            <h1 className="mt-4 text-heading-1 font-semibold text-foreground">
              Run My Free Dental Audit
            </h1>
            <p className="mt-2 text-body-small text-muted-foreground">
              Just your website and city — we&apos;ll handle the rest.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-center text-body-small font-semibold text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleDetailsSubmit} className="space-y-4" noValidate>
            <FormField id="website" label="Practice Website" required optionalLabel={false} error={websiteError}>
              <Input
                id="website"
                type="text"
                required
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="e.g. clinicwebsite.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                hasError={!!websiteError}
              />
            </FormField>

            <FormField id="city" label="City" required optionalLabel={false} error={cityError}>
              <Input
                id="city"
                type="text"
                required
                autoComplete="address-level2"
                placeholder="e.g. Toronto"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                hasError={!!cityError}
              />
            </FormField>

            <FormField id="country" label="Country" optionalLabel={false}>
              <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country">
                <option value="CA">Canada</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
              </Select>
            </FormField>

            <Button type="submit" fullWidth loading={loading} disabled={loading}>
              Run My Free Dental Audit
            </Button>
          </form>
        </div>
      )}

      {/* STEP 2: Processing */}
      {step === "processing" && <ProcessingScreen />}

      {/* STEP 3: Preview */}
      {step === "preview" && preliminary && (
        <div className="animate-fade-in space-y-6">
          <div className="text-center">
            <Eyebrow>Your quick look is ready</Eyebrow>
            <h1 className="mt-4 text-heading-1 font-semibold text-foreground">
              Patients are searching nearby right now.
            </h1>
            <p className="mt-2 text-body-small text-muted-foreground">
              Here&apos;s a first look. Unlock the full report to see your score, who&apos;s ranking ahead of you, and exactly what to fix first.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-4 text-center">
            <div>
              <span className="block text-metadata font-bold uppercase tracking-wider text-primary">SSL Security</span>
              <span className="mt-1 block text-body-small font-medium text-foreground">
                {preliminary.sslValid ? "Secure" : "Unsecured"}
              </span>
            </div>
            <div>
              <span className="block text-metadata font-bold uppercase tracking-wider text-primary">Speed</span>
              <span className="mt-1 block text-body-small font-medium text-foreground">
                {preliminary.pageSpeedEstimate.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <span className="block text-metadata font-bold uppercase tracking-wider text-primary">Mobile Layout</span>
              <span className="mt-1 block text-body-small font-medium text-foreground">
                {preliminary.mobileOptimized ? "Optimized" : "Needs Fixes"}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-background p-5">
            <div className="space-y-3 blur-[3px] select-none" aria-hidden="true">
              <div className="h-3 w-3/4 rounded bg-border" />
              <div className="h-3 w-full rounded bg-border" />
              <div className="h-3 w-2/3 rounded bg-border" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <span className="rounded-full bg-surface px-4 py-1.5 text-metadata font-semibold text-muted-foreground shadow-sm">
                Your score & the practice ahead of you — one step away
              </span>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-center text-body-small font-semibold text-danger">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("details")}>
              Back
            </Button>
            <Button type="button" fullWidth onClick={() => setStep("contact")}>
              See My Full Report
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Contact details */}
      {step === "contact" && (
        <div className="animate-fade-in space-y-6">
          <div className="text-center">
            <Eyebrow>One last step</Eyebrow>
            <h1 className="mt-4 text-heading-1 font-semibold text-foreground">
              Where should we send it?
            </h1>
            <p className="mt-2 text-body-small text-muted-foreground">
              We&apos;ll email your full report and a link you can come back to anytime.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-center text-body-small font-semibold text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleContactSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="firstName" label="First Name" required optionalLabel={false}>
                <Input
                  id="firstName"
                  type="text"
                  required
                  autoComplete="given-name"
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </FormField>
              <FormField id="lastName" label="Last Name" required optionalLabel={false}>
                <Input
                  id="lastName"
                  type="text"
                  required
                  autoComplete="family-name"
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </FormField>
            </div>

            <FormField id="email" label="Professional Email" required optionalLabel={false}>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="e.g. dr.john@clinicwebsite.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="role" label="Your Practice Role" required optionalLabel={false}>
                <Input
                  id="role"
                  type="text"
                  required
                  autoComplete="organization-title"
                  placeholder="e.g. Dentist / Owner"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </FormField>
              <FormField id="phone" label="Phone Number">
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="e.g. 312-555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </FormField>
            </div>

            <div>
              <label className="flex items-start gap-3">
                <input
                  id="consent"
                  type="checkbox"
                  required
                  className="mt-1 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (e.target.checked) setConsentError("");
                  }}
                />
                <span className="text-body-small leading-relaxed text-muted-foreground">
                  I&apos;m okay receiving my audit results and occasional practice growth tips by email. I can opt out anytime.
                </span>
              </label>
              {consentError && (
                <p role="alert" className="mt-1.5 text-metadata font-semibold text-danger">
                  {consentError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep("preview")} disabled={loading}>
                Back
              </Button>
              <Button type="submit" fullWidth loading={loading} disabled={loading}>
                Unlock My Detailed Report
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function FreeDentalAuditPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1200px] justify-between px-6 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <IconCheck className="h-3.5 w-3.5" />
          </span>
          Smile AI Marketing
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
        <Suspense
          fallback={
            <div className="space-y-4 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
              <p className="text-body-small font-semibold text-muted-foreground">Loading...</p>
            </div>
          }
        >
          <AuditWizardForm />
        </Suspense>
      </main>

      <footer className="border-t border-border py-6 text-center text-metadata text-muted-foreground">
        &copy; {new Date().getFullYear()} Smile AI Marketing. All rights reserved.
      </footer>
    </div>
  );
}
