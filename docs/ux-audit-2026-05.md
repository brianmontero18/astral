# UX Audit — Astral Guide (2026-05-05)

> Análisis sin escribir código. Capturas en `.playwright-mcp/ux-*.png`.
> Objetivo: validar el problema reportado de "Generar Informe" + identificar fricciones,
> inconsistencias, violaciones a `DESIGN.md` y oportunidades alineadas al nicho
> (coaches HD / marcas personales del bienestar).

## TL;DR — el problema reportado

**"Generar mi informe" está mal escondido. Es probablemente el peor problema de IA del producto.** El informe es la promesa central de Astral (`CLAUDE.md`: *"genera reportes semanales personalizados"*) y hoy vive a 3 acciones de profundidad detrás de un dropdown que también es referencia de datos:

1. Click en el pill `Brian Montero` (esquina superior derecha)
2. Scroll dentro del panel pasando 13 campos HD + 7 chips de canales
3. Encontrar el botón gold al fondo

En mobile (390px) el panel mide **358×633px** (`index.css:2016-2032`), tapa todo el nav y el CTA queda *bajo el fold dentro de un scroll dentro del header*.

Y para empeorarlo: en chat hay un quick action **"Reporte semanal completo"** (`ChatView.tsx:96-100`) que es **otra cosa distinta** — manda un mensaje al agente que devuelve texto conversacional. La usuaria no tiene cómo saber que el "informe estructurado" (9 secciones bonitas) vive en otro lado, escondido.

## Recomendación principal: Informe como tab de primer nivel

```
Hoy:        Chat | Tránsitos | Mis Cartas
Propuesta:  Chat | Informe ★ | Tránsitos | Mis Cartas
```

Tradeoffs:

- **Pro**: vuelve visible la promesa core, da motor de retención semanal, resuelve la confusión de los dos "reportes".
- **Pro**: separa **acción** (generar informe) de **referencia** (datos del perfil HD). Hoy el `ProfilePanel` mezcla ambos.
- **Con**: 4 tabs en mobile a 390px ya queda apretado (5 con admin); hay que probar layout.
- **Alternativa intermedia**: dejar tabs como están, pero (a) en chat-empty cambiar el quick action gold "Reporte semanal completo" para que **abra ReportView** en lugar de mandar texto, (b) mover el botón **arriba** del bloque de datos en `ProfilePanel`.

## Hallazgos por pantalla

### Chat
- ✅ Empty state con kicker editorial, copy cálido, 3 quick actions priorizadas.
- ⚠️ **Confusión de "reportes"**: el quick action gold manda mensaje al chat; el "informe estructurado" (`ReportView`) vive en otro flujo. Indistinguibles para la usuaria.
- ⚠️ `chat-empty-title` es un `<div>` (`ChatView.tsx:448`), no `<h1>`. La page no tiene heading semántico.

### Tránsitos
- ✅ 13 cards de planetas con info densa (signo, grado, puerta, línea + chip "✦ Activa tu Puerta X" en gold cuando hay impacto). Es **el mejor uso de gold** del producto.
- 🔥 **Tarjetas no son interactivas hacia chat**. La usuaria ve "Sol activa tu Puerta 2" y no puede pulsar para preguntar al agente. Es la integración más obvia que falta.
- ⚠️ Las 3 secciones de impacto bajo el grid están colapsadas. Para Premium deberían estar **abiertas por defecto** — están pagando por personalización.
- ⚠️ Header `4 — 10 may · 2026` tiene "may" minúscula. Inconsistente con el sistema uppercase tracked.

### Mis Cartas
- ✅ Heading clean, kicker dorado, CTA gold de subir.
- ⚠️ **Voz**: `VER` / `ELIMINAR` quedan formales, mientras el resto habla en voseo cálido ("Reintentá", "Te invitamos").
- 🔥 **Falta jerarquía "carta activa vs históricas"**. Si hay 3 bodygraphs subidos, no hay marca visual de cuál se usa para tránsitos/informes.

### Profile dropdown (ofensor principal)
- 🔥 Acción enterrada bajo 13 fields + 7 chips.
- 🔥 Mobile colapsa todo: 358×633 cubre el header completo.
- ⚠️ **DESIGN.md violation**: `box-shadow: 0 18px 44px rgba(33, 41, 30, 0.32)` (`index.css:2027`). El sistema dice *"No usar drop shadows en cards. La elevación es tonal."* Misma violación en `.intake-card` (`index.css:2130`).
- ⚠️ Mezcla de roles: cédula identitaria + launcher de acción. Anti-pattern.
- ⚠️ Nombre "Brian Montero" se repite (pill + panel header inmediato).

### Intake ("Contame de tu negocio")
- ✅ Layout limpio, voice notes con mic icon, copy claro.
- 🔥 **Fricción doble**: el mismo intake se llena en onboarding y se vuelve a pedir acá. Si ya está completo, debería ir directo a Report.
- 🔥 **Bias de nicho**: las preguntas asumen negocio (`¿A qué te dedicás?`, `Tipo de negocio` con default "Mentora"). Para usuarias HD sin emprendimiento se siente equivocado.
- ⚠️ Tabs desaparecen, solo "← Volver". Perdés orientación durante el formulario más largo.

### Report (`Informe Personal`)
- ✅ Page header impecable (kicker + headline serif + meta + acción secundaria).
- 🔥 **9 secciones colapsables son `<button>`, no `<h2>`**. Solo hay un `<h1>`. Lectura de pantalla / navegación por encabezados rota.
- 🔥 **No hay TOC**: 9 secciones colapsables, llegar a "Próximos 30 días" pide muchísimo scroll.
- ⚠️ **Compartir** abajo solo: ¿qué comparte? ¿Link público? ¿PDF? ¿Native share? Sin contexto.
- ⚠️ Sección "Tu Carta Mecánica" repite literal el `ProfilePanel`.
- ⚠️ "Compartir" / "Editar mis respuestas" mismo styling secondary, pero acciones distintas.

### Navegación / NavBar
- ⚠️ Tabs reemplazadas por "← Volver" durante intake/report (`NavBar.tsx:99-104`). Perdés orientación en las pantallas más largas.
- ⚠️ "Dashboard Auth" admin link con border gold compite con el pill.
- ⚠️ Logout es icon-only sin label. Mobile difícil de descubrir.

### Personas (admin)
- ✅ Heading + búsqueda + paginación clara, kicker "SUPPORT PANEL", CTA gold único.
- 🔥 **Densidad bajísima**: cada persona ~150px alto con solo 4 datos visibles. 41 personas en 4 páginas.
- ⚠️ "ANTERIOR / SIGUIENTE" mobile se apilan en columna, ocupan 100px. Pill de pagination más eficiente.

## Violaciones a DESIGN.md (hard rules)

1. `index.css:2027` — `.profile-panel` lleva `box-shadow: 0 18px 44px rgba(33, 41, 30, 0.32)`. **DESIGN.md L367**: *"No usar drop shadows en cards. La elevación es tonal."*
2. `index.css:2130` — `.intake-card` lleva `box-shadow: 0 24px 56px rgba(33, 41, 30, 0.22)`. Misma violación.
3. **▾ chevrons en colapsos del informe** son caracteres Unicode. **DESIGN.md L370-371**: *"No usar emojis decorativos en UI. Para iconografía, SVG inline con strokeWidth: 1.7"*.
4. **Más de un primario gold por vista**: en `Personas` admin conviven "Invitar persona" (gold) + pill `Dashboard Auth` (border gold). DESIGN.md L286: *"primary... Una vez por vista máximo."*
5. **Headings semánticos rotos en Report**: 9 sub-secciones son `<button>` en vez de `<h2>`.

## Niche fit (coaches HD / marcas personales del bienestar)

- Usuaria viene buscando una guía pausada, semanal, ritual. **Pero su entregable está escondido detrás de un pill de utility como si fuera config**. Una revista premium no esconde el artículo principal en el menú de "cuenta".
- Las preguntas de intake la **fuerzan a definirse profesionalmente**. Filtra mucho a usuarias *aspirantes* o *practicantes serias sin negocio* (lo más típico en HD).
- Falta **ritualización del informe**: no hay "tu informe del 4 al 10 de mayo" como objeto persistente con permalink. Hoy se regenera bajo demanda.
- Tránsitos sin "qué hacer con esto": ver una grilla planetaria es información, no insight. **Cada tarjeta de tránsito debería tener un mini-CTA**: *"Pedile a tu agente que te explique"* → abre chat con contexto pre-cargado.

## Top 10 prioritizado

| # | Severidad | Issue | Fix sugerido |
|---|-----------|-------|--------------|
| 1 | P0 | "Generar mi informe" enterrado | Tab "Informe" en NavBar **o** mover botón al top del ProfilePanel **+** unificar con quick action de chat |
| 2 | P0 | Dos "reportes" distintos confunden | Renombrar el quick action de chat a "Conversación sobre la semana", reservar "Informe" para ReportView |
| 3 | P0 | Tránsitos no interactivos hacia chat | Cada card → CTA "Preguntale al agente" pre-cargando contexto |
| 4 | P1 | Intake duplicado entre onboarding y "Generar informe" | Si ya está completo, ir directo a ReportView; "Editar mis respuestas" como secundario |
| 5 | P1 | Intake pide negocio obligatorio | "Tipo de negocio" opcional con neutro "Sin definir" |
| 6 | P1 | Tabs desaparecen en intake/report | Mantener tabs + "← Volver" complementario |
| 7 | P1 | Mobile profile dropdown tapa todo | Convertir en sheet bottom-up con CTA pinned arriba |
| 8 | P2 | Box-shadows violan DESIGN.md | Reemplazar con elevación tonal (forest sobre sage-soft) |
| 9 | P2 | Secciones del informe sin TOC ni `<h2>` | Sticky TOC lateral / pill bar mobile + `<h2>` reales |
| 10 | P2 | "Carta activa" no marcada en Mis Cartas | Pill "EN USO" gold sobre la activa, resto grayed |
