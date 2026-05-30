import type { ReactNode } from "react";
import { HERO } from "../content";
import { revealProps } from "../utils";

interface HeroProps {
  onEnter?: () => void;
}

export function Hero({ onEnter }: HeroProps): ReactNode {
  const enter = () => onEnter?.();

  return (
    <section className="mkt-wrap-narrow mkt-section mkt-hero">
      <h1 className="mkt-display" {...revealProps()}>
        {HERO.title}
      </h1>
      <p className="mkt-hero-sub mkt-body-readable" {...revealProps(120)}>
        {HERO.subtitle}
      </p>
      <div className="mkt-hero-actions" {...revealProps(240)}>
        <button type="button" className="mkt-btn mkt-btn-gold" onClick={enter}>
          {HERO.primaryCta}
        </button>
        <button type="button" className="mkt-btn mkt-btn-ghost" onClick={enter}>
          {HERO.secondaryCta}
        </button>
      </div>
      <div className="mkt-hero-media" {...revealProps(360)}>
        <div className="mkt-hero-glow" aria-hidden="true" />
        <img className="mkt-hero-img" src={HERO.image.src} alt={HERO.image.alt} />
      </div>
    </section>
  );
}
