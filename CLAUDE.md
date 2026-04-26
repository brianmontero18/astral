# Astral Guide

## Contexto

App de Diseño Humano que genera reportes semanales personalizados.
Cruza el bodygraph del usuario con tránsitos planetarios reales (Swiss Ephemeris WASM).
El usuario sube imágenes/PDFs de su bodygraph, GPT-4o Vision extrae los datos, y luego chatea con un agente que cruza su perfil HD con los tránsitos de la semana.

## Stack

- **Frontend**: React 18 + TypeScript + Vite 5
- **Backend**: Node.js / Fastify 5 + SQLite (@libsql/client)
- **LLM**: GPT-4o Vision (extracción) + GPT-4o-mini (chat) — via backend
- **Tránsitos**: Swiss Ephemeris WASM (sin APIs externas)
- **Deploy**: Dockerfile (Node 20 Alpine multi-stage) + fly.toml

## Arquitectura

```
astral/
├── package.json          ← root: concurrently para dev, build, start
├── Dockerfile            ← Node 20 Alpine, multi-stage
├── fly.toml              ← Fly.io con volumen persistente para SQLite
├── docs/
│   ├── human-design-reference.md  ← Referencia técnica HD (gates, centros, canales, tránsitos)
│   └── hd-transit-refactor-spec.md ← Spec del refactor de tránsitos
├── backend/
│   ├── .env              ← OPENAI_API_KEY (no commitear)
│   └── src/
│       ├── server.ts         ← Entry point. Plugins, DB init, rutas bajo /api, static en prod
│       ├── db.ts             ← SQLite: users, assets, transit_cache, chat_messages
│       ├── agent-service.ts  ← System prompt HD + GPT-4o-mini para reportes (sync + streaming)
│       ├── extraction-service.ts ← GPT-4o Vision: extrae UserProfile HD de imágenes/PDFs
│       ├── transit-service.ts    ← Swiss Ephemeris WASM + analyzeTransitImpact()
│       ├── hd-gates.ts           ← Mapeo 360° zodiac → 64 puertas HD + GATE_TO_CENTER + normalizeCenter
│       └── routes/
│           ├── health.ts     ← GET /api/health
│           ├── transits.ts   ← GET /api/transits[?userId=] (cache SQLite por semana ISO + impact personalizado)
│           ├── chat.ts       ← POST /api/chat + POST /api/chat/stream (SSE) + GET /api/users/:id/messages
│           ├── users.ts      ← CRUD /api/users
│           ├── assets.ts     ← Upload/download /api/users/:id/assets + /api/assets/:id
│           └── extract.ts    ← POST /api/extract-profile
└── frontend/
    ├── vite.config.ts    ← Proxy /api → localhost:3000 (sin rewrite)
    └── src/
        ├── App.tsx           ← Router por estado: onboarding | chat | transits | assets
        ├── types.ts          ← Tipos compartidos (sincronizar con backend)
        ├── api.ts            ← Todas las llamadas HTTP
        ├── utils.ts          ← parseReport, stripMarkdown, SECTION_META
        ├── main.tsx          ← Entry point React
        ├── index.css         ← CSS variables, glassmorphism, animaciones
        └── components/
            ├── OnboardingFlow.tsx   ← Wizard: welcome → nombre → upload HD → extracción → review
            ├── NavBar.tsx           ← Tabs: Chat | Tránsitos | Mis Cartas + botón perfil
            ├── ChatView.tsx         ← Chat con historial desde DB + quick actions
            ├── TransitViewer.tsx    ← Grid de planetas + canales personales + centros condicionados
            ├── AssetViewer.tsx      ← Gestión de cartas: ver, subir, eliminar
            ├── ProfilePanel.tsx     ← Dropdown con datos HD del perfil activo
            └── ReportRenderer.tsx   ← Parsea reporte por emojis en secciones coloreadas
```

## Desarrollo

```bash
# Desde la raíz (levanta ambos con concurrently)
npm run dev

# O por separado
cd backend && npm run dev   # :3000
cd frontend && npm run dev  # :5173

# Verificar
curl http://localhost:5173/api/health
```

El proxy Vite reenvía `/api/*` a `localhost:3000`. Backend usa prefix `/api` en todas las rutas.

## Flujo de datos

```
1. Onboarding:
   POST /api/users (crea user) → POST /api/users/:id/assets (sube bodygraph)
   → POST /api/extract-profile { assetIds } → GPT-4o Vision extrae UserProfile HD
   → PUT /api/users/:id (guarda perfil) → localStorage("astral_user") = { id, name }

2. Chat (streaming — default):
   POST /api/chat/stream { userId, messages }
   → Backend carga profile de DB + tránsitos (cache semanal) + analyzeTransitImpact()
   → GPT-4o-mini genera respuesta con datos de impacto calculados
   → SSE: data: {"content":"chunk"}\n\n por cada token
   → Al final: data: {"done":true, "transits_used":"..."}\n\n
   → Guarda mensaje completo en chat_messages
   → Fallback: POST /api/chat (non-streaming, misma lógica)

3. Tránsitos:
   GET /api/transits[?userId=xxx] → cache por semana ISO en SQLite
   → Swiss Ephemeris WASM calcula posiciones + detecta canales HD activados
   → Si viene userId: analyzeTransitImpact() cruza tránsitos vs bodygraph del usuario
   → Retorna: planets, activatedChannels, impact (personalChannels, conditionedCenters, reinforcedGates)
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/transits` | Posiciones planetarias + canales HD activados (colectivo) |
| GET | `/api/transits?userId=xxx` | Lo mismo + impacto personalizado en el bodygraph del usuario |
| POST | `/api/chat` | `{ userId, messages }` → `{ reply, transits_used }` (non-streaming) |
| POST | `/api/chat/stream` | `{ userId, messages }` → SSE stream de chunks + done event |
| GET | `/api/users/:id/messages` | Historial de chat del usuario |
| POST | `/api/users` | Crear usuario |
| GET | `/api/users/:id` | Obtener usuario con perfil |
| PUT | `/api/users/:id` | Actualizar perfil |
| POST | `/api/users/:id/assets` | Subir bodygraph HD (multipart) |
| GET | `/api/assets/:id` | Descargar asset |
| DELETE | `/api/assets/:id` | Eliminar asset |
| POST | `/api/extract-profile` | `{ assetIds }` → UserProfile HD extraído con Vision |

## Decisiones técnicas

- **Solo Diseño Humano**: la app se enfoca exclusivamente en HD. No astrología natal.
- **Offset 302° del Rave Mandala**: las 64 puertas HD NO empiezan en 0° Aries. Gate 41 empieza en 302° (2°0' Acuario). Ver `docs/human-design-reference.md`.
- **Transit impact determinístico**: `analyzeTransitImpact()` calcula canales personales, centros condicionados y puertas reforzadas antes de llamar al LLM. El LLM interpreta datos calculados, no los infiere.
- **Center normalization**: GPT-4o Vision extrae centros en español ("Cabeza", "Bazo"). El código usa IDs canónicos en inglés ("Head", "Spleen"). `normalizeCenter()` en `hd-gates.ts` maneja la conversión.
- **No Next.js**: Fastify sirve el build estático de React en producción. Una app, un deploy.
- **No npm workspaces**: causaba hoisting que rompía tipos. Root usa `cd backend && ...`.
- **Assets en Cloudflare R2**: `assets.storage_key` apunta a `users/{userId}/assets/{assetId}.{ext}`. La columna BLOB legacy se dropeó. Setup en `docs/r2-setup.md`. R2 es obligatorio en producción — `server.ts` valida al boot.
- **Auth con SuperTokens managed**: passwordless email + sessions httpOnly. Mapping de identity en `user_identities`. Setup y env vars en backend cubren dev (Dev core) y prod (Production core). Email del user se persiste en `users.email` en signup desde la sesión de SuperTokens.
- **Backend sin hot-reload**: `node --import tsx/esm` sin watch. Reiniciar manualmente.
- **API responses en camelCase**: rutas backend mapean snake_case de SQLite a camelCase.

## Layout del frontend — CRÍTICO

```
div (height: 100vh, flex column, overflow: hidden)     ← App root
  div (position: absolute, pointer-events: none)        ← Orbs decorativos
  div (flex: 1, flex column, minHeight: 0, zIndex: 10)  ← Main wrapper
    header (flexShrink: 0)                               ← NavBar
    div (flex: 1, flex column, overflow: hidden, minHeight: 0)  ← Content wrapper
      <Vista activa> (flex: 1, overflowY: auto, maxWidth: 760, margin: 0 auto, width: 100%)
```

**Reglas**:
- Todas las vistas: `maxWidth: 760px` + `width: 100%` + `margin: 0 auto`
- NUNCA `scrollIntoView()` — usar `el.scrollTop = el.scrollHeight` en el contenedor
- NUNCA `minHeight: 100vh` en root
- `minHeight: 0` en flex children es esencial para overflow

## Estilo

- Fondo: `#0A0910`, gradientes oscuros tipo cosmos
- Acentos: `#D4AF37` (dorado), `#9d8bdf` (amatista), `#c96b7a` (rosa), `#6bba8a` (verde)
- Fuentes: Cormorant Garamond / Georgia (serif), Inter / system-ui (sans)
- CSS Variables en `index.css` (`--color-primary`, `--glass-bg`, `--text-main`, etc.)
- Sin librerías de UI externas. Inline styles + clases utility en index.css.
- Glassmorphism: `.glass-panel`, `.glass-panel-gold`
- Animaciones: fadeIn, fadeInSlow, pulse, spin
- Secciones del reporte: 🔭 ⚡ 💼 ❤️ 🧭 ⚠️

## Referencia técnica

Ver `docs/human-design-reference.md` para:
- Tabla completa de 64 puertas con grados zodiacales
- Mapeo gate → center (9 centros, 64 puertas)
- Los 36 canales HD por circuito
- Cómo los tránsitos impactan el bodygraph (4 tipos de impacto)
- Jerarquía de planetas y duraciones por puerta

## Pendientes

- **ReportRenderer**: parseReport aplasta párrafos y borra markdown. Las respuestas largas son muros de texto.
- **CORS en producción**: actualmente `origin: true`. Restringir al dominio real al deployar.
- **Extracción HD-only**: la extracción ahora solo soporta bodygraphs HD. Si se quiere re-agregar carta natal en el futuro, crear un extraction prompt separado.
