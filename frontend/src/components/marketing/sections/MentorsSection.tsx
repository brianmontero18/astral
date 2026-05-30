import type { ReactNode } from "react";
import { MENTORS, MENTORS_CTA, MENTORS_HEADING, MENTORS_QUOTE } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

interface MentorsSectionProps {
  onEnter?: () => void;
}

export function MentorsSection({ onEnter }: MentorsSectionProps): ReactNode {
  return (
    <section className="mkt-wrap mkt-section">
      <SectionHeading {...MENTORS_HEADING} wide leadClassName="mkt-body-lg" />
      <div className="mkt-mentors">
        {MENTORS.map((mentor, index) => (
          <article
            key={mentor.name}
            className="mkt-mentor"
            {...revealProps(index * STAGGER_MS)}
          >
            <div className="mkt-mentor-photo">
              <img src={mentor.img} alt={mentor.name} />
            </div>
            <h3 className="mkt-headline-md">{mentor.name}</h3>
            <p className="mkt-mentor-role mkt-kicker">{mentor.role}</p>
            <p className="mkt-body-readable">{mentor.body}</p>
          </article>
        ))}
      </div>
      <div className="mkt-mentors-quote" {...revealProps()}>
        <blockquote className="mkt-headline-sm">{MENTORS_QUOTE}</blockquote>
        <button
          type="button"
          className="mkt-btn mkt-btn-gold mkt-btn-wide"
          onClick={() => onEnter?.()}
        >
          {MENTORS_CTA}
        </button>
      </div>
    </section>
  );
}
