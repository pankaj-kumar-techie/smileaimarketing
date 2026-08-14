"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { trackEvent } from "@/lib/analytics.client";

export default function FinalCTA() {
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
    trackEvent("audit_form_start", { form_location: "final_cta" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

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

    if (!isValid) return;

    trackEvent("audit_form_submit", { form_location: "final_cta" });
    setIsSubmitting(true);
    let normalizedWebsite = trimmedWebsite.toLowerCase();
    if (!/^https?:\/\//i.test(normalizedWebsite)) {
      normalizedWebsite = `https://${normalizedWebsite}`;
    }

    const params = new URLSearchParams({ website: normalizedWebsite, city: trimmedCity });
    router.push(`/free-dental-audit?${params.toString()}`);
  };

  return (
    <section id="contact" className="relative overflow-hidden border-t border-border">
      <Image
        src="/images/dental-operatory-bright.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        quality={70}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 via-foreground/70 to-foreground/85" aria-hidden />
      <div className="relative mx-auto max-w-[1200px] px-6 py-16 sm:py-24 sm:px-8">
        <Reveal className="mx-auto max-w-xl rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-xl sm:py-14">
          <h2 className="text-heading-1 font-semibold text-foreground">
            See where your next patient opportunities may be.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-body text-muted-foreground">
            Enter your practice website and location and we&apos;ll prepare a clear, plain-English review.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="final-cta-website" label="Practice Website" required optionalLabel={false} error={websiteError}>
                <Input
                  id="final-cta-website"
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
                />
              </FormField>
              <FormField id="final-cta-city" label="City" required optionalLabel={false} error={cityError}>
                <Input
                  id="final-cta-city"
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
                />
              </FormField>
            </div>
            <Button type="submit" loading={isSubmitting} fullWidth>
              {isSubmitting ? "Preparing your audit..." : "Get My Free Practice Audit"}
            </Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
