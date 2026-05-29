import type { ReactNode } from "react";
import { MENTORS, MENTORS_CTA, MENTORS_HEADING, MENTORS_QUOTE } from "../content";
import { SectionHeading } from "../SectionHeading";
import { revealProps, STAGGER_MS } from "../utils";

interface MentorsSectionProps {
  onEnter?: () => void;
}

export function MentorsSection({ onEnter }: MentorsSectionProps): ReactNode {
  return (
    <section className="lp-wrap lp-section">
      <SectionHeading {...MENTORS_HEADING} wide leadClassName="lp-body-lg" />
      <div className="lp-mentors">
        {MENTORS.map((mentor, index) => (
          <article
            key={mentor.name}
            className="lp-mentor"
            {...revealProps(index * STAGGER_MS)}
          >
            <div className="lp-mentor-photo">
              <img src={mentor.img} alt={mentor.name} />
            </div>
            <h3 className="lp-headline-md">{mentor.name}</h3>
            <p className="lp-mentor-role lp-kicker">{mentor.role}</p>
            <p className="lp-body-readable">{mentor.body}</p>
          </article>
        ))}
      </div>
      <div className="lp-mentors-quote" {...revealProps()}>
        <blockquote className="lp-headline-sm">{MENTORS_QUOTE}</blockquote>
        <button
          type="button"
          className="lp-btn lp-btn-gold lp-btn-wide"
          onClick={() => onEnter?.()}
        >
          {MENTORS_CTA}
        </button>
      </div>
    </section>
  );
}
