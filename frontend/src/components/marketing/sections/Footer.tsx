import type { ReactNode } from "react";
import { FOOTER } from "../content";
import { revealProps, smoothScrollToHash } from "../utils";

export function Footer(): ReactNode {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-inner" {...revealProps()}>
        <p className="mkt-footer-brand">{FOOTER.brand}</p>
        <div className="mkt-footer-links">
          {FOOTER.links.map((link) => (
            <a
              key={link}
              className="mkt-footer-link mkt-label-sm"
              href="#top"
              onClick={(event) => smoothScrollToHash(event, "#top")}
            >
              {link}
            </a>
          ))}
        </div>
        <p className="mkt-footer-copy mkt-label-sm">{FOOTER.copy}</p>
      </div>
    </footer>
  );
}
