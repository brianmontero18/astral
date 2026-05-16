# Project overview — Astral Guide

**Audiencia**: cualquier humano o AI agent que toca el código por primera vez.
**Última actualización**: 2026-05-16.

---

## Contexto

App de Diseño Humano que genera reportes semanales personalizados.
Cruza el bodygraph del usuario con tránsitos planetarios reales (Swiss Ephemeris WASM).
El usuario sube imágenes/PDFs de su bodygraph, GPT-4o Vision extrae los datos, y luego chatea con un agente que cruza su perfil HD con los tránsitos de la semana.

## Stack

- **Frontend**: React 18 + TypeScript + Vite 5
- **Backend**: Node.js / Fastify 5 + SQLite (`@libsql/client` / Turso en prod)
- **LLM chat**: GPT-4o-mini por default (env var `CHAT_MODEL`), Vercel AI SDK + 5 HD tools cuando `FEATURE_CHAT_USE_TOOLS=true`
- **LLM extracción**: GPT-4o Vision (env var `EXTRACTION_MODEL`)
- **LLM memory/report**: GPT-4o-mini (env vars `MEMORY_WRITER_MODEL`, `REPORT_MODEL`)
- **Tránsitos**: Swiss Ephemeris WASM (sin APIs externas)
- **Auth**: SuperTokens managed (passwordless email + sessions httpOnly)
- **Storage**: Cloudflare R2 para assets (PDFs HD)
- **Deploy**: Render. Dockerfile (Node 20 Alpine multi-stage) + fly.toml (legacy)

## Estructura del repo

```
astral/
├── package.json          ← root: concurrently para dev, build, start
├── Dockerfile            ← Node 20 Alpine, multi-stage
├── AGENTS.md             ← fuente de verdad para AI agents (entry point)
├── CLAUDE.md             ← redirector a AGENTS.md
├── docs/
│   ├── INDEX.md          ← índice de toda la documentación
│   ├── architecture/     ← verdad de hoy (mutable)
│   ├── research/         ← snapshots de investigación externa (inmutable)
│   └── *.md              ← specs activos, planes, ADRs, runbooks
├── backend/
│   ├── .env              ← OPENAI_API_KEY + env vars de modelo (no commitear)
│   ├── .env.example      ← template documentado
│   └── src/
│       ├── server.ts                    ← entry. Plugins, DB init, rutas /api, static prod
│       ├── db.ts                        ← SQLite schema + migraciones idempotentes
│       ├── agent-service.ts             ← v1 chat (fetch directo OpenAI, default activo)
│       ├── agent-service-v2.ts          ← v2 chat (Vercel AI SDK + tools, behind flag)
│       ├── agent-service-v2-prompt.ts   ← prompt builder v2 (knowledge slim)
│       ├── agent-prompt-helpers.ts      ← helpers compartidos entre v1 y v2
│       ├── extraction-service.ts        ← GPT-4o Vision: extrae UserProfile HD
│       ├── transit-service.ts           ← Swiss Ephemeris + analyzeTransitImpact()
│       ├── memory-writer.ts             ← Living Document writer fire-and-forget
│       ├── hd-gates.ts                  ← Mapeo 360° → 64 puertas + GATE_TO_CENTER
│       ├── hd-channels.ts               ← 36 canales HD + helpers (HD_CHANNELS_FULL)
│       ├── hd-tools/                    ← 5 tools deterministas para Vercel AI SDK
│       ├── knowledge/                   ← HD_CONDENSED + BUSINESS_PACK + detection rules
│       ├── config/flags.ts              ← feature flags (env-based)
│       └── routes/
│           ├── health.ts                ← GET /api/health
│           ├── transits.ts              ← GET /api/transits[?userId=]
│           ├── chat.ts                  ← POST /api/chat + /chat/stream (SSE)
│           ├── users.ts                 ← CRUD /api/users
│           ├── assets.ts                ← Upload/download bodygraphs
│           ├── extract.ts               ← POST /api/extract-profile
│           └── report.ts                ← /me/report (cached, invalidated por profile_hash)
└── frontend/
    ├── vite.config.ts                   ← Proxy /api → localhost:3000 (sin rewrite)
    └── src/
        ├── App.tsx                      ← Router por estado: onboarding | chat | transits | assets
        ├── types.ts                     ← Tipos compartidos (sincronizar con backend)
        ├── api.ts                       ← Todas las llamadas HTTP
        ├── utils.ts                     ← parseReport, stripMarkdown, SECTION_META
        ├── main.tsx                     ← Entry point React
        ├── index.css                    ← CSS variables, glassmorphism, animaciones
        └── components/
            ├── OnboardingFlow.tsx       ← welcome → nombre → upload HD → extracción → review
            ├── NavBar.tsx               ← Tabs + botón perfil
            ├── ChatView.tsx             ← Chat con historial desde DB + quick actions
            ├── TransitViewer.tsx        ← Grid planetas + canales personales + centros
            ├── AssetViewer.tsx          ← Gestión de cartas
            ├── ProfilePanel.tsx         ← Datos HD del perfil activo
            └── ReportRenderer.tsx       ← Parsea reporte por emojis en secciones
```

## Desarrollo local

```bash
# Desde la raíz (levanta ambos con concurrently)
npm run dev

# O por separado
cd backend && npm run dev   # :3000
cd frontend && npm run dev  # :5173

# Verificar
curl http://localhost:5173/api/health

# Smoke del chat v2 (requiere OPENAI_API_KEY)
cd backend && npm run smoke:chat-v2          # 5 runs
```

El proxy Vite reenvía `/api/*` a `localhost:3000`. Backend usa prefix `/api` en todas las rutas.

## Flujo de datos

### 1. Onboarding
```
POST /api/users (crea user)
  → POST /me/bodygraph (sube PDF + GPT-4o Vision extrae perfil)
  → updateUserBodygraph atómico (profile + profile_asset_id)
  → opcional: POST /me/onboarding/intake (datos de negocio)
  → onboarding_status = 'complete'
```

### 2. Chat (streaming, default)
```
POST /api/chat/stream { messages }
  → Backend carga profile + intake + memory_md de DB
  → Calcula transits semanales + analyzeTransitImpact() deterministic
  → Trunca history a últimos CHAT_HISTORY_TURNS (default 60)
  → Branch por flag FEATURE_CHAT_USE_TOOLS:
      false (default) → agent-service.ts v1: fetch directo OpenAI
      true            → agent-service-v2.ts: Vercel AI SDK + 5 HD tools
  → Streaming SSE chunks al frontend
  → Post-stream: persiste chat_messages + llm_calls (con cached_tokens)
  → Fire-and-forget: memory_writer mergea hechos en users.memory_md
```

Ver `docs/architecture/chat-llm-system.md` para el diagrama completo del flujo LLM.

### 3. Tránsitos
```
GET /api/transits[?userId=xxx]
  → Cache por week_key en SQLite
  → Swiss Ephemeris WASM calcula posiciones + canales HD activados
  → Si viene userId: analyzeTransitImpact() cruza tránsitos vs bodygraph
  → Retorna: planets, activatedChannels, impact (personalChannels, conditionedCenters, reinforcedGates)
```

### 4. Informe
```
POST /me/report
  → Lee profile + intake fresh de DB
  → computeProfileHash(profile, intake) → si matchea cached, devuelve
  → Si no, generateReport(profile, tier, openaiKey, intake) → 3 LLM calls (intro, body, close)
  → saveReport con profile_hash → invalidación automática cuando cambia el profile
```

## API endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/transits` | Posiciones planetarias + canales HD activados (colectivo) |
| GET | `/api/transits?userId=xxx` | Lo mismo + impacto personalizado en el bodygraph del usuario |
| POST | `/api/chat` | `{ messages }` → `{ reply, transits_used }` (non-streaming) |
| POST | `/api/chat/stream` | `{ messages }` → SSE stream de chunks + done event |
| GET | `/me/messages` | Historial de chat del usuario actual |
| POST | `/me/messages/:id/feedback` | Thumb up/down + nota opcional |
| GET | `/me` | Currently linked user + profile |
| PUT | `/me` | Actualizar nombre/profile/intake del user actual |
| PATCH | `/me/onboarding` | Update step/profile/intake/complete del onboarding |
| POST | `/me/bodygraph` | Sube PDF + extrae perfil + setea active asset atómico |
| GET | `/me/assets` | Lista assets del user con flag isActive |
| POST | `/me/assets` | Upload asset genérico (NO extrae perfil — ver Bug A) |
| GET | `/api/assets/:id` | Descargar asset propio |
| DELETE | `/api/assets/:id` | Eliminar asset propio |
| POST | `/me/report` | Genera/devuelve report (cached por profile_hash) |
| GET | `/me/report` | Devuelve report cached (409 si stale) |
| POST | `/admin/users` | (admin) Invitar premium/basic por email |
| GET | `/users/:id` | (admin) Detalle de cualquier user |
| PUT | `/users/:id` | (admin) Update profile/intake/name de cualquier user — **VER BUG B** |
| DELETE | `/users/:id` | (admin) Borrar user |

## Decisiones técnicas clave

- **Solo Diseño Humano**: la app se enfoca exclusivamente en HD. No astrología natal.
- **Offset 302° del Rave Mandala**: las 64 puertas HD NO empiezan en 0° Aries. Gate 41 empieza en 302° (2°0' Acuario). Ver `docs/human-design-reference.md`.
- **Transit impact determinístico**: `analyzeTransitImpact()` calcula canales personales, centros condicionados y puertas reforzadas antes de llamar al LLM. El LLM interpreta datos calculados, no los infiere.
- **Center normalization**: GPT-4o Vision extrae centros en español ("Cabeza", "Bazo"). El código usa IDs canónicos en inglés ("Head", "Spleen"). `normalizeCenter()` en `hd-gates.ts` maneja la conversión.
- **No Next.js**: Fastify sirve el build estático de React en producción. Una app, un deploy.
- **No npm workspaces**: causaba hoisting que rompía tipos. Root usa `cd backend && ...`.
- **Assets en Cloudflare R2**: `assets.storage_key` apunta a `users/{userId}/assets/{assetId}.{ext}`. R2 es obligatorio en producción — `server.ts` valida al boot.
- **Auth con SuperTokens managed**: passwordless email + sessions httpOnly. Mapping de identity en `user_identities`. Email persistido en `users.email`.
- **Backend sin hot-reload**: `node --import tsx/esm` sin watch. Reiniciar manualmente.
- **API responses en camelCase**: rutas backend mapean `snake_case` de SQLite a `camelCase`.
- **Models como env vars** (post-refactor 2026-05): `CHAT_MODEL`, `MEMORY_WRITER_MODEL`, `REPORT_MODEL`, `EXTRACTION_MODEL` configurables desde Render dashboard.
- **HD tools deterministas** (post-refactor 2026-05): la tabla canónica de 36 canales se expone como tools (`findChannelByGates`, `findChannelsByGate`, etc) en lugar de inline en el system prompt. Anti-alucinación por diseño.

## Layout del frontend — CRÍTICO

```
div (height: 100vh, flex column, overflow: hidden)     ← App root
  div (position: absolute, pointer-events: none)        ← Orbs decorativos
  div (flex: 1, flex column, minHeight: 0, zIndex: 10)  ← Main wrapper
    header (flexShrink: 0)                               ← NavBar
    div (flex: 1, flex column, overflow: hidden, minHeight: 0)  ← Content wrapper
      <Vista activa> (flex: 1, overflowY: auto, maxWidth: 760, margin: 0 auto, width: 100%)
```

**Reglas duras**:

- Todas las vistas: `maxWidth: 760px` + `width: 100%` + `margin: 0 auto`
- NUNCA `scrollIntoView()` — usar `el.scrollTop = el.scrollHeight` en el contenedor
- NUNCA `minHeight: 100vh` en root
- `minHeight: 0` en flex children es esencial para overflow

## Estilo / design system

- Fondo: `#0A0910`, gradientes oscuros tipo cosmos
- Acentos: `#D4AF37` (dorado), `#9d8bdf` (amatista), `#c96b7a` (rosa), `#6bba8a` (verde)
- Fuentes: Cormorant Garamond / Georgia (serif), Inter / system-ui (sans)
- CSS Variables en `index.css` (`--color-primary`, `--glass-bg`, `--text-main`, etc.)
- Sin librerías de UI externas. Inline styles + clases utility en `index.css`.
- Glassmorphism: `.glass-panel`, `.glass-panel-gold`
- Animaciones: fadeIn, fadeInSlow, pulse, spin
- Secciones del reporte: 🔭 ⚡ 💼 ❤️ 🧭 ⚠️

## Referencia técnica HD

Ver `docs/human-design-reference.md` para:

- Tabla completa de 64 puertas con grados zodiacales
- Mapeo gate → center (9 centros, 64 puertas)
- Los 36 canales HD por circuito
- Cómo los tránsitos impactan el bodygraph (4 tipos de impacto)
- Jerarquía de planetas y duraciones por puerta

## Bugs conocidos abiertos (P0)

Trackeados en beads. Resumen para nuevos colaboradores:

- **`astral-0b7`** — Bug A: `POST /me/assets` con `fileType=hd` deja profile vacío (no extrae). Afecta a 4 cuentas premium hoy. Ver `docs/architecture/bug-investigation-daniela-2026-05.md`.
- **`astral-bdt`** — Bug B: `PUT /users/:id` admin permite escribir profile de otro user. Caso Daniela = profile contaminado con el de Brian.
- **`astral-m25`** — Data fix manual para Daniela, Lucia, Agos, Jez, Mayra.

## Pendientes (no-bloqueantes)

- **ReportRenderer**: `parseReport` aplasta párrafos y borra markdown. Las respuestas largas son muros de texto.
- **CORS en producción**: actualmente `origin: true`. Restringir al dominio real al deployar.
- **Extracción HD-only**: la extracción ahora solo soporta bodygraphs HD. Si se quiere re-agregar carta natal en el futuro, crear un extraction prompt separado.

## Para profundizar

- **Cómo funciona el LLM en el chat**: `docs/architecture/chat-llm-system.md`
- **Decisiones del refactor AI 2026-05**: `docs/architecture/refactor-2026-05-decisions.md`
- **Caso Daniela** (origen del refactor): `docs/architecture/bug-investigation-daniela-2026-05.md`
- **Research de industria 2026**: `docs/research/`
- **Índice completo**: `docs/INDEX.md`
