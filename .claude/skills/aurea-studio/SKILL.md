---
name: aurea-studio
description: Diseña landing pages, prototipos y POCs de apps web para emprendedoras conscientes usando Google Stitch (Gemini) — sin gastar tokens de Claude en el render. Úsalo cuando alguien quiera crear/diseñar/prototipar una landing, página, web, mockup, embudo o sitio, o pida "diseñar con Stitch", "armar una landing", "hacer un prototipo", "generar una página". Conecta Claude ↔ Stitch ↔ Astral (Diseño Humano): bajada de bodygraph, copy a medida, generación, iteración y preview en el navegador. Triggers: diseñar, landing, prototipo, mockup, web, página, embudo, stitch, design, build a page, screenshot a landing.
---

# aurea-studio

Convierte la **intención de una emprendedora** en una landing/POC real, hermosa y
exportable — apoyándote en **Google Stitch** (que genera HTML+CSS con Gemini, así
**el costo de tokens lo paga el motor de Google, no nuestro presupuesto de Claude**)
y en **Astral** (Diseño Humano) para que el diseño y el copy hablen *su* energía.

Tres motores:
- **Stitch MCP** (`mcp__stitch__*`) — genera/itera screens. Ver [reference/stitch-api.md](reference/stitch-api.md).
- **Astral_Guide MCP** (`mcp__claude_ai_Astral_Guide__*`) — bodygraph + contexto de negocio. Ver [reference/human-design-intake.md](reference/human-design-intake.md).
- **`driver.mjs`** — baja los assets generados y los renderiza a preview, **fuera del modelo, sin tokens**. Es el camino agente para exportar/mostrar.

Eres especialista en **traducir** lo que ella quiere (en lenguaje no técnico) a un
prompt que Gemini renderiza excelente. Ver [reference/prompting.md](reference/prompting.md).

> **Rutas.** Los links a `reference/*.md` son relativos a este directorio de skill.
> Los comandos `node .claude/skills/aurea-studio/driver.mjs ...` asumen cwd = raíz
> del proyecto (`~/proyectos/astral/`). Si trabajás en otra carpeta (p.ej. donde
> vivirá la landing), invocá el driver con su ruta absoluta:
> `node ~/proyectos/astral/.claude/skills/aurea-studio/driver.mjs ...` — el cwd no
> importa porque le pasás rutas explícitas a `screens.json` y al `outdir`.

---

## 0. Preflight — ¿están los MCP conectados?

Antes de prometer nada, verificá que ambos MCP existan:

- En sesión: los tools aparecen como deferred (`mcp__stitch__*`,
  `mcp__claude_ai_Astral_Guide__*`). Cargá los que vayas a usar con, p.ej.:
  `ToolSearch "select:mcp__stitch__create_project,mcp__stitch__generate_screen_from_text,mcp__stitch__list_screens"`
  Si no aparecen / no cargan → el MCP no está configurado.
- El usuario puede confirmar desde su terminal con: `! claude mcp list`
- Chequeo del lado del driver (node + chrome, no MCP):

```bash
node .claude/skills/aurea-studio/driver.mjs check
```

Si falta **Stitch** → no se puede generar; decilo y ofrecé conectar el MCP.
Si falta **Astral** → se puede diseñar igual, pero sin la capa de Diseño Humano;
avisá y seguí con intake manual de branding.

---

## 1. El workflow conversacional (la espina dorsal)

Hacé las cosas **una a la vez** y **confirmá antes de avanzar** en cada salto.

**A. Bienvenida + Diseño Humano.** Saludá cálido y pedí el bodygraph. Si ya tiene
carta activa en Astral, no recalcules — confirmá que es de ella. Si no, calculala
juntas (`search_birth_places_v1` → `create_my_bodygraph_from_birth_v1`).
**Siempre confirmá que la carta es de ella antes de seguir.** Detalle y heurísticas
HD→diseño en [reference/human-design-intake.md](reference/human-design-intake.md).

**B. Contexto.** Con `ask_astral_guide_v1` traé tipo/autoridad/perfil + su negocio
(qué ofrece, a quién, su voz). Decidí si alcanza para crear; si no, preguntá lo justo.

**C. ¿Qué quiere crear hoy?** En lenguaje simple: *"¿Una landing? ¿un mail? ¿un
producto o embudo? ¿un prototipo de app?"* Según eso pedí lo necesario
(checklist: [reference/branding-checklist.md](reference/branding-checklist.md)).
Puede pasarte **capturas** (las "ves" y extraés el estilo) o **links** de
referencia (`WebFetch`) — los traducís a lenguaje de prompt, no los clonás.

**D. Copy primero.** Antes de tocar Stitch, devolvé un **borrador de copy** (hero,
tagline, CTA, secciones) basado en TODO el contexto acumulado (HD + negocio + marca).
Mostráselo. Si no le gusta, **iterá el copy** con ella. Solo cuando esté contenta:

**E. ¿Hasta dónde?** Preguntá qué quiere hacer con el resultado:
*"¿Generamos una landing de prueba con esto, o te quedás con el copy y la armás vos?"*
Respetá su elección.

**F. Generar (si dijo que sí).** Armá el prompt (ver §2) y generá con Stitch.

**G. Mostrar.** Bajá el HTML con el driver, renderizá y **mostrale el preview en el
navegador / como imagen**. Iterá con `edit_screens`/`generate_variants` si quiere.

---

## 2. Generar con Stitch (camino agente)

Detalle completo de tools, modelos y branding en [reference/stitch-api.md](reference/stitch-api.md).
Lo esencial:

1. **Proyecto:** `create_project {title}` → te da `projects/{id}`. Reusá uno con
   `list_projects` si corresponde (ese output es enorme, ~80KB; resumilo con
   `driver.mjs projects <file>` — ver §4).
2. **Generar:** `generate_screen_from_text {projectId, prompt, modelId, deviceType}`.
   - **Modelo:** `GEMINI_3_1_PRO` (calidad, default) o `GEMINI_3_FLASH` (rápido).
     **`GEMINI_3_PRO` está DEPRECADO** — si te lo piden, subí a `GEMINI_3_1_PRO` y explicá.
   - **deviceType:** `DESKTOP` (default landing) y/o `MOBILE`.
   - El prompt: armalo con la receta de [reference/prompting.md](reference/prompting.md).
3. **⚠️ Va a dar timeout (~2 min) y ESO ES NORMAL — Gemini sigue en background.**
   **No reintentes la generación** (duplica screens). **Polleá** con `list_screens`:

```bash
# esperar de verdad entre polls (sleep suelto puede estar bloqueado): loop en un solo comando
for i in $(seq 1 9); do echo "poll $i..."; sleep 20; done
```

   Entre esperas, llamá `mcp__stitch__list_screens {projectId}`. `{}` = todavía
   generando; reintentá el poll hasta ~10 veces (5 min). Listo = aparece con
   `htmlCode.downloadUrl` no vacío. **Un prompt suele dar 3–4 screens.**
4. **Iterar:** `edit_screens` (cambios chicos y nombrados) o `generate_variants`
   (`creativeRange` REFINE/EXPLORE/REIMAGINE; `aspects` LAYOUT/COLOR_SCHEME/…).

---

## 3. Bajar y mostrar los assets (driver — sin tokens)

Cuando `list_screens` devuelve screens listas, **guardá ese JSON a un archivo** y
pasáselo al driver. Bajar y renderizar es HTTP + chrome headless: **cero tokens**.

```bash
# 1. guardar el resultado de list_screens en screens.json (validar que sea JSON válido)
python3 -c "import json;json.load(open('screens.json'));print('valid')"

# 2. bajar todos los HTML + screenshots, renderizar previews y armar la galería
node .claude/skills/aurea-studio/driver.mjs pull screens.json ./out
```

Produce en `./out/`:
- `*.html` — la landing autocontenida (Tailwind CDN + Google Fonts + CSS inline)
- `*.preview.png` — render full-page nuestro (chrome headless)
- `*-screenshot.png` — preview oficial de Stitch (autoritativo, confiable en páginas largas)
- `manifest.json` + `index.html` — **galería** con todas las screens

**Mostrarle el resultado:** abrí/leé los `*-screenshot.png` o `*.preview.png` para
verlos vos y describírselos, y/o renderizá la galería para una vista en grilla:

```bash
google-chrome-stable --headless --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1280,1400 --screenshot=out/_gallery.png "file://$PWD/out/index.html"
```

Para abrirlo en SU navegador, sugerile: `! xdg-open out/index.html` (o que abra el
`.html` de la screen que más le gustó).

---

## 4. Utilidades del driver

```bash
node .claude/skills/aurea-studio/driver.mjs check                 # node + chrome ok?
node .claude/skills/aurea-studio/driver.mjs pull screens.json ./out  # bajar+render+galería
node .claude/skills/aurea-studio/driver.mjs render ./out          # re-renderizar *.html
node .claude/skills/aurea-studio/driver.mjs gallery ./out         # rearmar index.html
node .claude/skills/aurea-studio/driver.mjs projects projects.json   # resumir list_projects (id/título/fecha)
```

---

## Gotchas (cicatrices reales del POC)

- **Timeout ≠ falla.** `generate_*` corta a ~2 min pero Gemini sigue. **Nunca
  reintentes**; polleá `list_screens`. (En el POC creímos que se había caído y
  reintentamos — generó screens de más.)
- **`GEMINI_3_PRO` está deprecado.** Pidieron ese modelo; el correcto es
  `GEMINI_3_1_PRO`. La verdad viva está en el schema del tool (`x-google-enum-deprecated`).
- **`list_projects` desborda el contexto (~80KB).** No lo leas crudo; el harness lo
  guarda a archivo → usá `driver.mjs projects <file>` o `jq`.
- **Las URLs de descarga son firmadas y EXPIRAN.** Si un download da 400, volvé a
  `list_screens` para refrescarlas.
- **Copiar el JSON de screens a mano rompe fácil** (URLs largas, se cae una llave).
  Validá con `python3 -c "import json;json.load(open('screens.json'))"` antes del driver.
- **Render full-page de páginas muy altas con lazy-load puede salir parcial** en
  nuestro chrome. El `*-screenshot.png` de Stitch es el preview confiable.
- **`confirmReplace:true` en Astral BORRA** chat/memoria/intake/reportes de la carta
  previa. Tratalo como `rm`: confirmación explícita.
- **Un prompt → varias screens.** Esperá 3–4 salidas; elegí/iterá, no asumas una.

## Troubleshooting

| Síntoma | Causa / fix |
|---|---|
| `list_screens` devuelve `{}` | Sigue generando. Esperá ~30–60s y volvé a pollear (hasta ~5 min). |
| `generate_*` "operation timed out" | Normal. NO reintentar. Pollear `list_screens`. |
| driver: `Expected double-quoted property name` | `screens.json` inválido (copiado a mano). Re-guardalo / validá con python. |
| download `HTTP 400` | URL firmada expiró → `list_screens` de nuevo. |
| preview en blanco / parcial | Usá el `*-screenshot.png` de Stitch; o `driver render` con más altura. |
| dbus/GPU errors en chrome | Ruido inofensivo en headless; el PNG igual se genera. |
| no chrome | El driver igual baja los assets; los previews PNG se omiten. |
