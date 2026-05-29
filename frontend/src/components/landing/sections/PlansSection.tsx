import type { ReactNode } from "react";
import { PLANS, PLANS_HEADING } from "../content";
import { IconCheck } from "../icons";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

interface PlansSectionProps {
  onEnter?: () => void;
}

export function PlansSection({ onEnter }: PlansSectionProps): ReactNode {
  return (
    <section className="lp-wrap lp-section" id="planes">
      <SectionHeading {...PLANS_HEADING} />
      <div className="lp-grid-3">
        {PLANS.map((plan, index) => (
          <div
            key={plan.name}
            className={`lp-plan${plan.featured ? " lp-plan--featured" : ""}`}
            {...revealProps(index * STAGGER_MS)}
          >
            {plan.featured ? (
              <span className="lp-plan-badge lp-kicker">Recomendado</span>
            ) : null}
            <h3 className="lp-headline-md">{plan.name}</h3>
            <p className="lp-plan-blurb lp-body-readable">{plan.blurb}</p>
            <div className="lp-plan-price">
              <span className="lp-plan-price-amount">{plan.price}</span>
              {plan.suffix ? (
                <span className="lp-plan-price-suffix">{plan.suffix}</span>
              ) : null}
            </div>
            <ul className="lp-plan-features lp-body-md">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span className="lp-icon">
                    <IconCheck />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`lp-btn lp-btn-block ${plan.featured ? "lp-btn-gold" : "lp-btn-ghost"}`}
              onClick={() => onEnter?.()}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
