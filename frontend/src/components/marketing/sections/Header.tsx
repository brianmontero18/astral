import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { NAV_LINKS } from "../content";
import { IconClose, IconMenu, IconStar } from "../icons";
import { smoothScrollToHash } from "../utils";

interface HeaderProps {
  onEnter?: () => void;
}

export function Header({ onEnter }: HeaderProps): ReactNode {
  // Menú mobile (hamburguesa). En desktop el panel está oculto por CSS.
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    smoothScrollToHash(event, href);
    setMenuOpen(false);
  };

  const handleEnter = () => {
    setMenuOpen(false);
    onEnter?.();
  };

  return (
    <header className="mkt-header">
      <div className="mkt-header-inner">
        <a
          className="mkt-brand"
          href="#top"
          aria-label="Astral Guide"
          onClick={(event) => handleLink(event, "#top")}
        >
          <span className="mkt-brand-name">Astral Guide</span>
          <span className="mkt-brand-mark">
            <IconStar />
          </span>
        </a>

        {/* Nav desktop (oculto < 768px) */}
        <nav className="mkt-nav">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className="mkt-nav-link mkt-label-md"
              href={link.href}
              onClick={(event) => handleLink(event, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="mkt-btn mkt-btn-outline mkt-header-cta"
          onClick={handleEnter}
        >
          Acceso
        </button>

        {/* Toggle hamburguesa (visible < 768px) */}
        <button
          type="button"
          className="mkt-nav-toggle"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="mkt-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {/* Panel mobile desplegable (oculto en desktop por CSS) */}
      <div
        id="mkt-mobile-menu"
        className={`mkt-mobile-menu${menuOpen ? " is-open" : ""}`}
      >
        <nav className="mkt-mobile-menu-nav">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className="mkt-mobile-menu-link mkt-label-md"
              href={link.href}
              onClick={(event) => handleLink(event, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="mkt-btn mkt-btn-gold mkt-btn-block"
          onClick={handleEnter}
        >
          Acceso
        </button>
      </div>
    </header>
  );
}
