import type { ReactNode } from "react";
import { NAV_LINKS } from "../content";
import { IconStar } from "../icons";
import { smoothScrollToHash } from "../utils";

interface HeaderProps {
  onEnter?: () => void;
}

export function Header({ onEnter }: HeaderProps): ReactNode {
  return (
    <header className="lp-header">
      <div className="lp-header-inner">
        <a
          className="lp-brand"
          href="#top"
          aria-label="Astral Guide"
          onClick={(event) => smoothScrollToHash(event, "#top")}
        >
          <span className="lp-brand-name">Astral Guide</span>
          <span className="lp-brand-mark">
            <IconStar />
          </span>
        </a>
        <nav className="lp-nav">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className="lp-nav-link lp-label-md"
              href={link.href}
              onClick={(event) => smoothScrollToHash(event, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button type="button" className="lp-btn lp-btn-outline" onClick={() => onEnter?.()}>
          Acceso
        </button>
      </div>
    </header>
  );
}
