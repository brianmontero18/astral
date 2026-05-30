import type { ReactNode } from "react";
import { SYSTEM_FEATURES, SYSTEM_HEADING } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

export function SystemSection(): ReactNode {
  return (
    <section className="mkt-section-band" id="que-incluye">
      <div className="mkt-wrap">
        <SectionHeading {...SYSTEM_HEADING} />
        <div className="mkt-grid-2">
          {SYSTEM_FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={`mkt-feature${feature.reverse ? " mkt-feature--reverse" : ""}`}
              {...revealProps((index % 2) * STAGGER_MS)}
            >
              <div className="mkt-feature-media">
                <img src={feature.img} alt={feature.alt} />
              </div>
              <div className="mkt-feature-copy">
                <h3 className="mkt-headline-md">{feature.title}</h3>
                <p className="mkt-body-readable">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
