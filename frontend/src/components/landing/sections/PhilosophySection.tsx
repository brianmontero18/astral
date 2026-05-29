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
    <section className="lp-wrap lp-section">
      <SectionHeading {...PHILOSOPHY_HEADING} />
      <div className="lp-grid-3">
        {PHILOSOPHY_CARDS.map((card, index) => (
          <article
            key={card.title}
            className="lp-card lp-philo-card"
            {...revealProps(index * STAGGER_MS)}
          >
            <span className="lp-icon">{ICONS[card.icon]}</span>
            <h3 className="lp-headline-sm">{card.title}</h3>
            <p className="lp-body-readable">{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
