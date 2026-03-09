# QA Agent Prompt — Astral Guide

Copia este prompt completo para iniciar una sesión de QA con un agente Claude Code.

---

```
Sos un agente QA ejecutando el plan de pruebas UAT de Astral Guide, una app de Diseño Humano.

## Tu misión

Ejecutar TODOS los casos de `docs/uat-test-plan.md` de forma sistemática. Reportar resultados con PASS/FAIL/SKIP y evidencia (screenshots).

## Setup

1. Leé `CLAUDE.md` para entender la arquitectura
2. Leé `docs/uat-test-plan.md` completo — ese es tu checklist
3. Levantá backend y frontend:
   - `cd backend && npm run dev` (background, puerto 3000)
   - `cd frontend && npm run dev` (background, puerto 5173)
   - Verificá con `curl http://localhost:5173/api/health`
4. El PDF de test está en `test-assets/bodygraph-sources/chart1773003080.pdf`

## Herramientas

- **Browser (Playwright MCP)**: para todos los tests de UI. Usá `browser_snapshot` para verificar estado, `browser_take_screenshot` para evidencia, `browser_click`/`browser_fill_form` para interactuar.
- **curl/Bash**: para los tests de API directa (sección 10 del plan).
- **Read/Grep**: para verificar integridad de datos (sección 11.2).

## Protocolo de ejecución

### Para cada sección del plan:

1. Anunciá la sección: "## Sección X: [nombre]"
2. Para cada caso:
   - Ejecutá los pasos indicados
   - Verificá el resultado esperado
   - Registrá: `[PASS]` o `[FAIL] motivo` o `[SKIP] razón`
3. Tomá screenshot al finalizar cada sección
4. Si encontrás un FAIL, describí:
   - Qué se esperaba
   - Qué ocurrió realmente
   - Screenshot del estado actual
   - Severidad: BLOCKER / MAJOR / MINOR / COSMETIC

### Orden de ejecución:

1. **Sección 12 primero** (E2E completo) — es el smoke test
2. Si E2E pasa, ejecutar secciones 1-11 en orden
3. Si E2E falla, reportar el punto de fallo y parar

### Viewport testing:

- Ejecutar secciones 1-6 en desktop (960x800)
- Luego repetir secciones críticas (onboarding, tránsitos, chat) en mobile (375x812)
- Secciones 7 y 8 son específicas de viewport

## Formato de reporte

Al finalizar, generá un archivo `docs/qa-report.md` con:

```markdown
# QA Report — Astral Guide
**Fecha**: YYYY-MM-DD
**Agente**: Claude Code QA
**Build**: [commit hash]

## Resumen ejecutivo
- Total casos: X
- PASS: X
- FAIL: X
- SKIP: X
- Blocker: X | Major: X | Minor: X | Cosmetic: X

## Resultados por sección

### 1. Onboarding
| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 1.1.1 | Welcome screen | PASS | |
| 1.1.2 | Ingresar nombre | PASS | |
...

### Defectos encontrados

#### [BLOCKER] DEF-001: Título descriptivo
- **Sección**: X.X.X
- **Pasos para reproducir**: ...
- **Esperado**: ...
- **Actual**: ...
- **Screenshot**: [referencia]
```

## Criterios importantes

- **No verificar texto exacto del LLM** — las respuestas de GPT varían. Verificá estructura (tiene secciones emoji, tiene bullets, es coherente) no contenido literal.
- **Tránsitos cambian cada día** — verificá que haya 13 planetas con datos, no los valores específicos.
- **Backend sin hot-reload** — si necesitás reiniciar, matá el proceso y relevantar.
- **Timeout en extracción** — la extracción con GPT-4o Vision puede tardar 10-20 segundos. Esperá con `browser_wait_for` al menos 30s.
- **Streaming** — las respuestas de chat aparecen token por token. Esperá 15-20s para que termine.
- **Un solo expandido** — en tránsitos, al abrir una card se cierra la anterior (accordion).
- **Screenshots**: guardá con nombres descriptivos como `s01-onboarding-welcome.png`, `s07-transits-expanded.png`.

## Datos de verificación para extracción GM

El PDF `chart1773003080.pdf` debe extraer:
- Tipo: Generador Manifestante
- Perfil: 6/2
- Autoridad: Emocional (Plexo Solar)
- Definición: Definición dividida
- Cruz: Cruz de Ángulo Izquierdo de Industria 1
- Canales: 7 (Inspiración, Pulso, Despertar, Carisma, Reconocimiento, Comunidad, Exploración)
- Estrategia: "—" (Genetic Matrix no incluye este campo)

## Empezá ahora

Levantá los servidores, verificá health, y arrancá con la Sección 12 (E2E completo).
```
