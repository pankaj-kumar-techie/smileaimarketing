import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PatientJourney from "@/components/PatientJourney";
import SampleAuditPreview from "@/components/SampleAuditPreview";
import HowItWorks from "@/components/HowItWorks";
import TrustAndConsultation from "@/components/TrustAndConsultation";
import FAQ from "@/components/FAQ";
import { FAQS } from "@/components/faqData";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Smile AI Marketing",
  description:
    "Marketing agency helping dental clinics improve local visibility, generate qualified patient enquiries, and book more appointments.",
  url: "https://smileaimarketing.com",
  email: "hello@smileaimarketing.com",
  areaServed: "CA",
  knowsAbout: [
    "Dental marketing",
    "Local SEO",
    "Google Business Profile optimization",
    "Dental website design",
    "Patient lead generation",
    "Reputation management",
  ],
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <Header />
      <main className="flex-1">
        <Hero />
        <PatientJourney />
        <SampleAuditPreview />
        <HowItWorks />
        <TrustAndConsultation />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
