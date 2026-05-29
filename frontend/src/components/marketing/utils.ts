import type { CSSProperties, MouseEvent } from "react";

// Paso base del stagger del scroll-reveal (ms entre elementos consecutivos).
export const STAGGER_MS = 100;

// Altura aproximada del header fijo, para que los anchors no queden tapados.
export const HEADER_OFFSET = 88;

// Props para marcar un elemento como objeto de scroll-reveal. Se hace spread
// sobre el elemento semántico real (no agrega wrappers): `data-reveal` lo
// engancha al IntersectionObserver y el delay arma el stagger.
//   <article className="mkt-card" {...revealProps(index * STAGGER_MS)}>
export function revealProps(delay = 0): {
  "data-reveal": "";
  style: CSSProperties;
} {
  return { "data-reveal": "", style: { transitionDelay: `${delay}ms` } };
}

// Smooth-scroll a un ancla interna con offset por el header fijo. Evita
// scrollIntoView() a propósito (patrón del proyecto).
export function smoothScrollToHash(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
): void {
  if (!href.startsWith("#")) return;
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  event.preventDefault();
  const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
}
