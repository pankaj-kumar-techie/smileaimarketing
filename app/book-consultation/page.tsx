"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics.client";

function BookConsultationForm() {
  const searchParams = useSearchParams();
  const isInPerson = searchParams.get("type") === "in-person";
  const consultationType = isInPerson ? "in_person" : "online";
  const publicToken = searchParams.get("publicToken");
  const router = useRouter();
  const hasStartedBooking = useRef(false);

  useEffect(() => {
    trackEvent("consultation_view", { type: consultationType });
  }, [consultationType]);

  const handleBookingStart = () => {
    if (hasStartedBooking.current) return;
    hasStartedBooking.current = true;
    trackEvent("booking_start", { type: consultationType });
  };

  // Cold-start fields — only needed when there's no existing audit to attach this booking to.
  const [website, setWebsite] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  // Scheduling fields — needed either way, this is the whole point of the page.
  const [scheduledTime, setScheduledTime] = useState("");
  const [address, setAddress] = useState("");
  const [preferredWindow, setPreferredWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const submitScheduling = async (token: string) => {
    const bookRes = await fetch(
      isInPerson ? `/api/audit/${token}/request-visit` : `/api/audit/${token}/book-meeting`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isInPerson
            ? { address, preferredWindow, notes }
            // scheduledTime comes from a datetime-local input — no seconds or
            // timezone, which fails the API's z.string().datetime() validation.
            : { scheduledTime: new Date(scheduledTime).toISOString(), notes }
        ),
      }
    );
    const bookData = await bookRes.json();
    if (!bookRes.ok) {
      throw new Error(bookData.error || "Failed to finalize your request.");
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!isInPerson && (!scheduledTime || Number.isNaN(new Date(scheduledTime).getTime()))) {
      setError("Please pick a date and time");
      return;
    }
    trackEvent("booking_submit", { type: consultationType });
    submitting.current = true;
    setLoading(true);
    setError("");

    try {
      // Fast path: this visitor already has an audit (came from their report or an email CTA) —
      // nothing to re-collect, just schedule.
      if (publicToken) {
        await submitScheduling(publicToken);
        router.push("/thank-you");
        return;
      }

      // Cold start: no existing audit, so we create one from the minimum needed to identify the practice.
      let formattedUrl = website.trim();
      if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = `https://${formattedUrl}`;
      }
      const derivedClinicName = website
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split(/[./]/)[0];

      const triggerRes = await fetch("/api/audit/inbound-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: formattedUrl,
          city: city.trim() || "Inbound Search",
          clinicName: derivedClinicName || "My Dental Practice",
        }),
      });

      const triggerData = await triggerRes.json();
      if (!triggerRes.ok) {
        throw new Error(triggerData.error || "Failed to initiate practice record.");
      }

      const { pendingAuditId } = triggerData;

      const [firstName, ...lastNames] = name.trim().split(" ");
      const lastName = lastNames.join(" ") || "Prospect";

      const unlockRes = await fetch("/api/audit/unlock-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingAuditId,
          firstName,
          lastName,
          email,
          role: "Owner / Inbound Direct",
          consent: true,
        }),
      });

      const unlockData = await unlockRes.json();
      if (!unlockRes.ok) {
        throw new Error(unlockData.error || "Failed to process lead contact.");
      }

      await submitScheduling(unlockData.publicToken);
      router.push("/thank-you");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while booking.");
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
      <div className="space-y-3 text-center">
        <Eyebrow>{isInPerson ? "In-Person Visit" : "Online Consultation"}</Eyebrow>
        <h1 className="text-heading-1 font-semibold text-foreground">
          {isInPerson ? "Request Your In-Person Visit" : "Book Your 15-Minute Review"}
        </h1>
        <p className="mx-auto max-w-md text-body-small text-muted-foreground">
          {isInPerson
            ? "A local consultant will confirm a time to walk your team through your visibility findings."
            : "We'll look at your Google Maps ranking live and identify your three biggest patient-acquisition gaps."}
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-danger/20 bg-danger/10 p-4 text-center text-body-small font-semibold text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleBooking} onChange={handleBookingStart} className="mt-8 space-y-4" noValidate>
        {!publicToken && (
          <>
            <FormField id="website" label="Clinic Website" required optionalLabel={false}>
              <Input
                id="website"
                type="text"
                required
                inputMode="url"
                autoComplete="url"
                placeholder="e.g. website.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </FormField>

            <FormField id="city" label="City" required optionalLabel={false}>
              <Input
                id="city"
                type="text"
                required
                autoComplete="address-level2"
                placeholder="e.g. Toronto"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </FormField>

            <FormField id="full-name" label="Your Name" required optionalLabel={false}>
              <Input
                id="full-name"
                type="text"
                required
                autoComplete="name"
                placeholder="e.g. Dr. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField id="email" label="Email" required optionalLabel={false}>
              <Input
                id="email"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder="e.g. owner@website.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
          </>
        )}

        {isInPerson ? (
          <>
            <FormField id="address" label="Clinic Address" required optionalLabel={false}>
              <Input
                id="address"
                type="text"
                required
                autoComplete="street-address"
                placeholder="e.g. 123 Main St, Suite 4"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </FormField>
            <FormField id="preferred-window" label="Preferred Window" required optionalLabel={false}>
              <Input
                id="preferred-window"
                type="text"
                required
                placeholder="e.g. Tuesday morning, 9-11am"
                value={preferredWindow}
                onChange={(e) => setPreferredWindow(e.target.value)}
              />
            </FormField>
          </>
        ) : (
          <FormField id="meeting-time" label="Preferred Date & Time" required optionalLabel={false}>
            <Input
              id="meeting-time"
              type="datetime-local"
              required
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </FormField>
        )}

        <FormField id="notes" label="Notes (optional)">
          <Textarea
            id="notes"
            rows={2}
            placeholder="Anything we should know before we talk?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <Button type="submit" fullWidth loading={loading} disabled={loading} className="!h-12">
          {isInPerson ? "Request Visit" : "Confirm Booking"}
        </Button>
      </form>
    </div>
  );
}

export default function BookConsultationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1200px] justify-between px-6 py-6 sm:px-8">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Smile AI<span className="text-primary">.</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-16">
        <Suspense
          fallback={
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
          }
        >
          <BookConsultationForm />
        </Suspense>
      </main>

      <footer className="border-t border-border py-6 text-center text-metadata text-muted-foreground">
        &copy; {new Date().getFullYear()} Smile AI Marketing. All rights reserved.
      </footer>
    </div>
  );
}
