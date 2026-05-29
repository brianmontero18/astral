import { useEffect, type RefObject } from "react";

// Revela los elementos [data-reveal] dentro del contenedor al cruzar el
// viewport, agregándoles la clase .lp-in (una sola vez). Respeta
// prefers-reduced-motion mostrándolos de entrada, sin animar.
export function useScrollReveal(
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("lp-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-in");
            observer.unobserve(entry.target);
          }
        }
      },
      // Margen inferior fijo (no %) para que el último bloque —el footer—
      // nunca quede atrapado invisible en una zona muerta al final del scroll.
      { threshold: 0, rootMargin: "0px 0px -60px 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [containerRef]);
}
