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
    <section className="mkt-wrap mkt-section" id="planes">
      <SectionHeading {...PLANS_HEADING} />
      <div className="mkt-grid-3">
        {PLANS.map((plan, index) => (
          <div
            key={plan.name}
            className={`mkt-plan${plan.featured ? " mkt-plan--featured" : ""}`}
            {...revealProps(index * STAGGER_MS)}
          >
            {plan.featured ? (
              <span className="mkt-plan-badge mkt-kicker">Recomendado</span>
            ) : null}
            <h3 className="mkt-headline-md">{plan.name}</h3>
            <p className="mkt-plan-blurb mkt-body-readable">{plan.blurb}</p>
            <div className="mkt-plan-price">
              <span className="mkt-plan-price-amount">{plan.price}</span>
              {plan.suffix ? (
                <span className="mkt-plan-price-suffix">{plan.suffix}</span>
              ) : null}
            </div>
            <ul className="mkt-plan-features mkt-body-md">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span className="mkt-icon">
                    <IconCheck />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`mkt-btn mkt-btn-block ${plan.featured ? "mkt-btn-gold" : "mkt-btn-ghost"}`}
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
