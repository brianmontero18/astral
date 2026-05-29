import { useRef } from "react";
import type { ReactNode } from "react";
import "./landing.css";
import { useScrollReveal } from "./useScrollReveal";
import { Header } from "./sections/Header";
import { Hero } from "./sections/Hero";
import { PhilosophySection } from "./sections/PhilosophySection";
import { SystemSection } from "./sections/SystemSection";
import { MentorsSection } from "./sections/MentorsSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { ReportSection } from "./sections/ReportSection";
import { PlansSection } from "./sections/PlansSection";
import { Footer } from "./sections/Footer";

// ─── Landing Page — Astral Guide ────────────────────────────────────────────
// Réplica del diseño Stitch "Astral Guide Landing Page" (desktop), tema dark
// "Editorial Premium / Botanical" — independiente del tema sage-soft in-app.
//
// Orquestador: compone secciones autocontenidas (cada una en ./sections/).
// El copy vive en ./content.ts, la capa de movimiento en useScrollReveal +
// landing.css (scroll-reveal, aura del mandala, hovers, prefers-reduced-motion).
// La versión mobile pulida llega en una iteración aparte.

interface LandingPageProps {
  /** Lleva al visitante a la app / auth (CTAs y botón ACCESO). */
  onEnter?: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  return (
    <div className="lp-root" ref={rootRef}>
      <Header onEnter={onEnter} />
      <main className="lp-main" id="top">
        <Hero onEnter={onEnter} />
        <PhilosophySection />
        <SystemSection />
        <MentorsSection onEnter={onEnter} />
        <HowItWorksSection />
        <ReportSection />
        <PlansSection onEnter={onEnter} />
      </main>
      <Footer />
    </div>
  );
}
