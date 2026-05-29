import { useRef } from "react";
import type { ReactNode } from "react";
import "./marketing.css";
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

// ─── Marketing Home — Astral Guide ──────────────────────────────────────────
// Home del sitio público de marketing. Réplica del diseño Stitch (desktop),
// tema dark "Editorial Premium / Botanical" — independiente del tema sage-soft
// in-app.
//
// Orquestador: compone secciones autocontenidas (cada una en ./sections/).
// El copy vive en ./content.ts, la capa de movimiento en useScrollReveal +
// marketing.css (scroll-reveal, aura del mandala, hovers, prefers-reduced-motion).
// La versión mobile pulida llega en una iteración aparte.

interface HomePageProps {
  /** Lleva al visitante a la app / auth (CTAs y botón ACCESO). */
  onEnter?: () => void;
}

export function HomePage({ onEnter }: HomePageProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  return (
    <div className="mkt-root" ref={rootRef}>
      <Header onEnter={onEnter} />
      <main className="mkt-main" id="top">
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
