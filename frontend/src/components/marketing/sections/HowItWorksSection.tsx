import type { ReactNode } from "react";
import { HOW_HEADING, STEPS } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

export function HowItWorksSection(): ReactNode {
  return (
    <section className="mkt-wrap-narrow mkt-section" id="como-funciona">
      <SectionHeading {...HOW_HEADING} />
      <div className="mkt-steps">
        <div className="mkt-steps-line" aria-hidden="true" {...revealProps()} />
        {STEPS.map((step, index) => {
          const onRight = index % 2 === 0;
          const copy = (
            <div className={`mkt-step-side${onRight ? " mkt-step-side--right" : ""}`}>
              <h3 className="mkt-headline-md">{step.title}</h3>
              <p className="mkt-body-readable">{step.body}</p>
            </div>
          );
          const dot = <div className="mkt-step-dot">{step.n}</div>;
          const spacer = <div className="mkt-step-spacer" aria-hidden="true" />;

          return (
            <div key={step.n} className="mkt-step" {...revealProps(index * STAGGER_MS)}>
              {onRight ? (
                <>
                  {copy}
                  {dot}
                  {spacer}
                </>
              ) : (
                <>
                  {spacer}
                  {dot}
                  {copy}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
