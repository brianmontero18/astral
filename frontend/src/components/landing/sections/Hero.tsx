import type { ReactNode } from "react";
import { HERO } from "../content";
import { revealProps } from "../utils";

interface HeroProps {
  onEnter?: () => void;
}

export function Hero({ onEnter }: HeroProps): ReactNode {
  const enter = () => onEnter?.();

  return (
    <section className="lp-wrap-narrow lp-section lp-hero">
      <h1 className="lp-display" {...revealProps()}>
        {HERO.title}
      </h1>
      <p className="lp-hero-sub lp-body-readable" {...revealProps(120)}>
        {HERO.subtitle}
      </p>
      <div className="lp-hero-actions" {...revealProps(240)}>
        <button type="button" className="lp-btn lp-btn-gold" onClick={enter}>
          {HERO.primaryCta}
        </button>
        <button type="button" className="lp-btn lp-btn-ghost" onClick={enter}>
          {HERO.secondaryCta}
        </button>
      </div>
      <div className="lp-hero-media" {...revealProps(360)}>
        <div className="lp-hero-glow" aria-hidden="true" />
        <img className="lp-hero-img" src={HERO.image.src} alt={HERO.image.alt} />
      </div>
    </section>
  );
}
