import type { ReactNode } from "react";
import { HOW_HEADING, STEPS } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

export function HowItWorksSection(): ReactNode {
  return (
    <section className="lp-wrap-narrow lp-section" id="como-funciona">
      <SectionHeading {...HOW_HEADING} />
      <div className="lp-steps">
        <div className="lp-steps-line" aria-hidden="true" {...revealProps()} />
        {STEPS.map((step, index) => {
          const onRight = index % 2 === 0;
          const copy = (
            <div className={`lp-step-side${onRight ? " lp-step-side--right" : ""}`}>
              <h3 className="lp-headline-md">{step.title}</h3>
              <p className="lp-body-readable">{step.body}</p>
            </div>
          );
          const dot = <div className="lp-step-dot">{step.n}</div>;
          const spacer = <div className="lp-step-spacer" aria-hidden="true" />;

          return (
            <div key={step.n} className="lp-step" {...revealProps(index * STAGGER_MS)}>
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
