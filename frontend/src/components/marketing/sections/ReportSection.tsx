import type { ReactNode } from "react";
import { REPORT_CARDS, REPORT_HEADING } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

export function ReportSection(): ReactNode {
  return (
    <section className="mkt-section-band" id="informe">
      <div className="mkt-wrap">
        <SectionHeading {...REPORT_HEADING} />
        <div className="mkt-grid-2 mkt-grid-2--tight">
          {REPORT_CARDS.map((card, index) => (
            <article
              key={card.title}
              className="mkt-report-card"
              {...revealProps((index % 2) * STAGGER_MS)}
            >
              <h4 className="mkt-headline-md">{card.title}</h4>
              <p className="mkt-body-readable">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
