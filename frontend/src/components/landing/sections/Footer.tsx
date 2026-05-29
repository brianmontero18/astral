import type { ReactNode } from "react";
import { FOOTER } from "../content";
import { revealProps, smoothScrollToHash } from "../utils";

export function Footer(): ReactNode {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner" {...revealProps()}>
        <p className="lp-footer-brand">{FOOTER.brand}</p>
        <div className="lp-footer-links">
          {FOOTER.links.map((link) => (
            <a
              key={link}
              className="lp-footer-link lp-label-sm"
              href="#top"
              onClick={(event) => smoothScrollToHash(event, "#top")}
            >
              {link}
            </a>
          ))}
        </div>
        <p className="lp-footer-copy lp-label-sm">{FOOTER.copy}</p>
      </div>
    </footer>
  );
}
