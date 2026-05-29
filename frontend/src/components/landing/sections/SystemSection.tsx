import type { ReactNode } from "react";
import { SYSTEM_FEATURES, SYSTEM_HEADING } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

export function SystemSection(): ReactNode {
  return (
    <section className="lp-section-band" id="que-incluye">
      <div className="lp-wrap">
        <SectionHeading {...SYSTEM_HEADING} />
        <div className="lp-grid-2">
          {SYSTEM_FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={`lp-feature${feature.reverse ? " lp-feature--reverse" : ""}`}
              {...revealProps((index % 2) * STAGGER_MS)}
            >
              <div className="lp-feature-media">
                <img src={feature.img} alt={feature.alt} />
              </div>
              <div className="lp-feature-copy">
                <h3 className="lp-headline-md">{feature.title}</h3>
                <p className="lp-body-readable">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
