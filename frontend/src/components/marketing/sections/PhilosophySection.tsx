import type { ReactNode } from "react";
import { PHILOSOPHY_CARDS, PHILOSOPHY_HEADING, type PhilosophyIconKey } from "../content";
import { IconBook, IconForum, IconMap } from "../icons";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

const ICONS: Record<PhilosophyIconKey, ReactNode> = {
  map: <IconMap />,
  forum: <IconForum />,
  book: <IconBook />,
};

export function PhilosophySection(): ReactNode {
  return (
    <section className="mkt-wrap mkt-section">
      <SectionHeading {...PHILOSOPHY_HEADING} />
      <div className="mkt-grid-3">
        {PHILOSOPHY_CARDS.map((card, index) => (
          <article
            key={card.title}
            className="mkt-card mkt-philo-card"
            {...revealProps(index * STAGGER_MS)}
          >
            <span className="mkt-icon">{ICONS[card.icon]}</span>
            <h3 className="mkt-headline-sm">{card.title}</h3>
            <p className="mkt-body-readable">{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
