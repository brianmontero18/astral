import type { ReactNode } from "react";
import { REPORT_CARDS, REPORT_HEADING } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

export function ReportSection(): ReactNode {
  return (
    <section className="lp-section-band" id="informe">
      <div className="lp-wrap">
        <SectionHeading {...REPORT_HEADING} />
        <div className="lp-grid-2 lp-grid-2--tight">
          {REPORT_CARDS.map((card, index) => (
            <article
              key={card.title}
              className="lp-report-card"
              {...revealProps((index % 2) * STAGGER_MS)}
            >
              <h4 className="lp-headline-md">{card.title}</h4>
              <p className="lp-body-readable">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
