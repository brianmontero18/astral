# Handoff — Astral Guide

## Estado

**Branch:** `main`
**Último commit:** `7c0128d` fix(extraction+ui): genetic matrix metadata + center i18n + mobile layout
**Push:** NO pusheado (1 commit ahead of origin/main)

## Lo que se hizo

- **Fix deploy Render**: `backend/package-lock.json` tenía 148 URLs de registry privado MeLi (furycloud.io). Regenerado con registry público.
- **Fix backend local**: Node v21 `--env-file` bug parseaba `# TURSO_DATABASE_URL=...` como variable real. Limpiado `.env`.
- **Genetic Matrix metadata extraction**: `parseHdSummaryFromText()` ahora reconoce labels de ambos providers (MyHumanDesign: `TYPE `, Genetic Matrix: `TYPE: `). Maps expandidos para tipos con authority prefix (`Emotional Manifesting Generator`), definición corta (`Split`), cross abreviada (`LAX/RAX/JXP`).
- **Center i18n**: `CENTER_DISPLAY` movido a `utils.ts` compartido. ProfilePanel traduce centros al español.
- **Mobile layout**: NavBar con `whiteSpace: nowrap` + flex shrink. ProfilePanel con `maxWidth: calc(100vw - 32px)` + scroll. Subtítulo → "DISEÑO HUMANO". Botón solo nombre. "Desconectar" → "Salir".
- **E2E Playwright**: onboarding con Genetic Matrix PDF verificado en 375px y 960px.

## Pendiente

1. Pushear `7c0128d` y verificar deploy en Render
2. Reiniciar backend y testear extracción Genetic Matrix E2E (usuario nuevo con `chart1773003080.pdf` — debe poblar Tipo, Perfil, Autoridad, Definición, Cruz)
3. i18n más robusto — evaluar si centralizar traducciones o mantener approach actual (traducir en display)
4. ReportRenderer — `parseReport` aplasta párrafos y borra markdown en respuestas largas

## Decisiones

- No librería i18n — traducción en punto de display suficiente para MVP
- ProfilePanel `position: absolute` (no fixed) — fixed rompía desktop
- Subtítulo simplificado, tipo HD removido del botón de perfil

## Notas técnicas

- **`.env` backend**: Node v21 `--env-file` tiene bug con `# VAR=value`. No usar esa sintaxis.
- **`CHANNELS: `** se agregó como label boundary en `extractSection()`, no se extrae como campo.
- **`translateCrossTitle()`**: maneja formato con paréntesis (MyHumanDesign) y sin (Genetic Matrix).
- **Backend sin hot-reload** — reiniciar manualmente tras cambios.
