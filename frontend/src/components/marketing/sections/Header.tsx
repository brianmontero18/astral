import type { ReactNode } from "react";
import { NAV_LINKS } from "../content";
import { IconStar } from "../icons";
import { smoothScrollToHash } from "../utils";

interface HeaderProps {
  onEnter?: () => void;
}

export function Header({ onEnter }: HeaderProps): ReactNode {
  return (
    <header className="mkt-header">
      <div className="mkt-header-inner">
        <a
          className="mkt-brand"
          href="#top"
          aria-label="Astral Guide"
          onClick={(event) => smoothScrollToHash(event, "#top")}
        >
          <span className="mkt-brand-name">Astral Guide</span>
          <span className="mkt-brand-mark">
            <IconStar />
          </span>
        </a>
        <nav className="mkt-nav">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className="mkt-nav-link mkt-label-md"
              href={link.href}
              onClick={(event) => smoothScrollToHash(event, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button type="button" className="mkt-btn mkt-btn-outline" onClick={() => onEnter?.()}>
          Acceso
        </button>
      </div>
    </header>
  );
}
