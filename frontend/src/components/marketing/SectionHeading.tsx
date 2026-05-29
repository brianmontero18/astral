import type { ReactNode } from "react";
import { revealProps } from "./utils";

// Encabezado de sección (kicker + título + lead opcional). Se repite en casi
// todas las secciones; centralizarlo hace trivial reestructurar el patrón.
interface SectionHeadingProps {
  kicker: string;
  title: string;
  lead?: string;
  /** Más margen inferior y título separado del lead (sección Mentores). */
  wide?: boolean;
  /** Clase tipográfica del lead (default: body legible). */
  leadClassName?: string;
}

export function SectionHeading({
  kicker,
  title,
  lead,
  wide = false,
  leadClassName = "mkt-body-readable",
}: SectionHeadingProps): ReactNode {
  return (
    <div
      className={`mkt-section-head${wide ? " mkt-section-head--wide" : ""}`}
      {...revealProps()}
    >
      <p className="mkt-kicker">{kicker}</p>
      <h2 className="mkt-headline-lg">{title}</h2>
      {lead ? <p className={`mkt-section-lead ${leadClassName}`}>{lead}</p> : null}
    </div>
  );
}
