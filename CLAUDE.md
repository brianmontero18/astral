# Astral Guide — Frontend

## Contexto del proyecto

App de astrología + Diseño Humano que genera reportes semanales personalizados.
Combina carta natal + carta HD del usuario con tránsitos planetarios reales.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js / Fastify (en WSL, puerto 3000) — ya funciona
- **LLM**: GPT-4o-mini via backend (el frontend NO llama a OpenAI directamente)
- **Tránsitos**: Swiss Ephemeris via backend (sin APIs externas)

## Arquitectura

```
Browser (este frontend)
  └── /api/* → proxy Vite → localhost:3000 (backend WSL)
        ├── GET  /health     — healthcheck
        ├── GET  /transits   — posiciones planetarias reales de la semana
        └── POST /chat       — { profile, messages } → { reply, transits_used }
```

El proxy está configurado en `vite.config.ts`. Si el backend corre en otro puerto, cambiarlo ahí.

## Estructura

```
src/
  types.ts          — tipos compartidos con el backend (no modificar sin sincronizar)
  api.ts            — todas las llamadas HTTP al backend
  utils.ts          — MOCK_PROFILE, parseReport, stripMarkdown
  App.tsx           — componente principal, estado del chat
  components/
    ReportRenderer.tsx  — parsea y renderiza el reporte por secciones
    ProfilePanel.tsx    — dropdown con datos del perfil activo
```

## TODOs prioritarios para Claude Code

### 1. Conectar y testear con el backend real
```bash
# Levantar backend (en WSL, carpeta astral-backend)
npm run dev   # puerto 3000

# Levantar frontend (esta carpeta)
npm install
npm run dev   # puerto 5173
```
Verificar que `curl http://localhost:5173/api/health` responde OK.

### 2. Reemplazar MOCK_PROFILE con perfil real del usuario
El flujo de onboarding que falta:
- Pantalla de bienvenida si no hay perfil guardado
- Upload de imagen/PDF de carta natal y carta HD
- Llamada a Claude Vision para extraer los datos → UserProfile JSON
- Guardar en localStorage (clave: `astral_profile`)
- Cargar desde localStorage al iniciar si existe

Interfaz esperada en `utils.ts`:
```ts
export async function extractProfileFromFiles(
  natalFile: File,
  hdFile: File,
): Promise<UserProfile>
```

### 3. Streaming (nice to have)
El backend puede soportar streaming SSE fácilmente.
Actualmente la respuesta llega completa → el usuario espera ~8s sin feedback.
Con streaming las secciones aparecerían progresivamente.
Implementar en `api.ts` como función alternativa `sendChatStream`.

### 4. Persistencia de conversaciones
Actualmente el historial de mensajes vive solo en memoria React.
Guardar en localStorage con clave `astral_messages` para que persistan entre sesiones.

## Tipos clave (del backend)

```ts
// POST /chat — body
{ profile: UserProfile; messages: ChatMessage[] }

// POST /chat — response
{ reply: string; transits_used: string }

// GET /transits — response
{
  fetchedAt: string;
  weekRange: string;
  planets: PlanetTransit[];
  activatedChannels: string[];
}
```

Ver `src/types.ts` para definiciones completas.

## Notas de diseño

- Paleta: fondo `#0d0820`, acentos `#7c6fcd` (púrpura), `#e8b84b` (dorado), `#c96b7a` (rosa)
- Fuente: Georgia serif
- Sin dependencias de UI externas (todo inline styles)
- Las 6 secciones del reporte tienen emojis fijos: 🔭 ⚡ 💼 ❤️ 🧭 ⚠️
