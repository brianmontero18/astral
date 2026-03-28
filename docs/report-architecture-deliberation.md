# HD Report — Arquitectura e Implementacion

> Documento consolidado. Source of truth para la feature de reportes HD.
> Fecha: 2026-03-28 | Status: Listo para implementar

---

## 1. Scope v1

Reporte de Diseno Humano descargable/compartible como PDF.
El usuario genera su informe desde el ProfilePanel. Opcionalmente completa un intake liviano (3 campos) para personalizar la interpretacion.

**Incluye**: generacion hibrida (estatico + LLM), vista in-app con freemium locks, PDF server-side, compartir via link temporal, intake liviano con voz.

**No incluye**: pagos reales (CTA redirige a WhatsApp), carta natal, multiples idiomas (solo espanol).

---

## 2. Decisiones de arquitectura

### 2.1 Generacion: Hibrido (75% estatico + 25% LLM)

**Por que**: El codebase ya tiene infraestructura deterministica (`hd-gates.ts`, `hd-channels.ts`, `transit-service.ts`, maps de traduccion en `extraction-service.ts`). Un reporte full-LLM regenera contenido identico por $0.07/vez; el hibrido lo hace por $0.007.

- **75% estatico**: Descripciones pre-escritas por categoria HD. Una inversion unica (~22,900 palabras). Contenido revisable, versionable, sin alucinaciones.
- **25% LLM**: Sintesis personalizada donde el valor es cruzar multiples dimensiones del diseno (ej: como interactuan TUS canales especificos con TU autoridad).

### 2.2 PDF: Server-side con `@react-pdf/renderer`

**Por que**: Pure Node.js (sin Chromium/Puppeteer), compatible con Docker Alpine existente. Produce texto seleccionable real. Usa JSX (mismo modelo mental que el frontend). Soporta fonts custom (Cormorant Garamond, Inter).

**Endpoint**: `GET /api/users/:id/report/pdf?tier=free|premium` → genera report data → renderiza PDF → stream al cliente.

**Fonts**: Archivos `.ttf` en `backend/assets/fonts/`. `Font.register()` usa `path.resolve(__dirname, '../assets/fonts/...')` para evitar problemas de path en Docker.

### 2.3 Freemium: 3.5 secciones free, 6 premium

| # | Seccion | Tier | Costo LLM | Justificacion |
|---|---------|------|-----------|---------------|
| 1 | Carta Mecanica | FREE | $0 | Template puro. Muestra que los datos estan bien. |
| 2 | Tu Tipo | FREE | ~$0.0004 | Entry point a HD. Hook emocional. |
| 3 | Tu Autoridad | FREE | ~$0.0004 | Con Tipo, da los 2 datos mas accionables. |
| 4 | Tu Perfil | FREE (teaser) | ~$0.0002 | Descripcion estatica completa + 2-3 lineas LLM + blur. |
| 5 | Tu Definicion | PREMIUM | — | Primera seccion gated. Split definitions son valiosas. |
| 6 | Tus Canales | PREMIUM | — | Alta personalizacion. Cada combo es unico. |
| 7 | Centros Indefinidos | PREMIUM | — | Condicionamiento profundo. Muy personal. |
| 8 | Cruz de Encarnacion | PREMIUM | — | "Proposito de vida". Corona del reporte. |
| 9 | Variables | PREMIUM | — | HD avanzado (digestion, entorno, sentido). |
| 10 | Fortalezas y Sombras | PREMIUM | — | Sintesis total. Nadie mas tiene esto. |

**UX free**: Secciones 1-4 completas (4 con teaser). Secciones 5-10 muestran titulo + icono 🔒. Un CTA al final con enlace a WhatsApp.

**UX premium**: Las 10 secciones completas con interpretacion personalizada.

---

## 3. Idioma: Solo espanol

Todo el output visible al usuario debe estar en espanol. El codebase almacena algunos valores en ingles (centros, planetas, circuitos). Se necesitan mapas de traduccion.

### 3.1 Traducciones existentes en el codebase

Ya disponibles en `extraction-service.ts`:
- `HD_TYPE_MAP` (5): Generator → Generador, etc.
- `HD_STRATEGY_MAP` (5): Responding → Responder, etc.
- `HD_AUTHORITY_MAP` (7): Emotional → Emocional (Plexo Solar), etc.
- `HD_DEFINITION_MAP` (5): Single Definition → Definicion simple, etc.
- `HD_NOT_SELF_MAP` (4): Frustration → Frustracion, etc.
- `HD_DIGESTION_MAP` (9): Peace & Quiet → Paz y Quietud, etc.
- `HD_ENVIRONMENT_MAP` (6): Shores → Costas, etc.
- `HD_STRONGEST_SENSE_MAP` (7): Feeling → Sentir, etc.

Ya disponible en `hd-gates.ts`:
- `CENTER_NORMALIZE` (9 centros, Spanish→English): Cabeza→Head, Bazo→Spleen, etc.

Ya disponible en `hd-channels.ts`:
- `HD_CHANNELS` (36 canales con nombres en espanol): "1-8"→"Canal de Inspiracion", etc.

### 3.2 Traducciones nuevas necesarias

Crear en `backend/src/report/hd-i18n.ts`:

| Mapa | Entradas | Ejemplo |
|------|----------|---------|
| `PLANET_ES` | 12 | Sun→Sol, Moon→Luna, Mercury→Mercurio, Venus→Venus, Mars→Marte, Jupiter→Jupiter, Saturn→Saturno, Uranus→Urano, Neptune→Neptuno, Pluto→Pluton, NorthNode→Nodo Norte, SouthNode→Nodo Sur |
| `CIRCUIT_ES` | 7 | Individual Knowing→Individual de Conocimiento, Individual Centering→Individual de Centraje, Collective Understanding→Colectivo de Entendimiento, Collective Sensing→Colectivo de Sentido, Tribal Defense→Tribal de Defensa, Tribal Ego→Tribal del Ego, Integration→Integracion |
| `PROFILE_ES` | 12 | 1/3→Investigador/Martir, 1/4→Investigador/Oportunista, 2/4→Ermitano/Oportunista, 2/5→Ermitano/Hereje, 3/5→Martir/Hereje, 3/6→Martir/Modelo a Seguir, 4/6→Oportunista/Modelo a Seguir, 4/1→Oportunista/Investigador, 5/1→Hereje/Investigador, 5/2→Hereje/Ermitano, 6/2→Modelo a Seguir/Ermitano, 6/3→Modelo a Seguir/Martir |

`CENTER_ES` se puede derivar invirtiendo `CENTER_NORMALIZE` existente (Head→Cabeza, etc.). Helper:

```typescript
export function centerToSpanish(canonical: string): string {
  return CENTER_CANONICAL_TO_ES[canonical] ?? canonical;
}
// CENTER_CANONICAL_TO_ES: { Head: "Cabeza", Ajna: "Ajna", Throat: "Garganta",
//   G: "Centro G", Heart: "Corazon", Spleen: "Bazo", Sacral: "Sacral",
//   SolarPlexus: "Plexo Solar", Root: "Raiz" }
```

**Total i18n nuevas: 31 entradas** (12 + 7 + 12). CENTER reutiliza lo existente.

Helper generico:

```typescript
export function translateHD(key: string, map: Record<string, string>): string {
  return map[key] ?? key; // Fallback: devuelve el original si no hay traduccion
}
```

### 3.3 Prompts

Todos los system prompts del LLM incluyen: `"Responde EXCLUSIVAMENTE en español. No uses terminología en inglés para conceptos de Diseño Humano."`

---

## 4. Intake liviano

### 4.1 Campos

3 campos de texto (basados en `HD_CLIENT_INTAKE.md` destilado):

| Campo | Label | Placeholder | Uso en reporte |
|-------|-------|-------------|----------------|
| `actividad` | "¿A que te dedicas?" | "Ej: Soy disenadora freelance..." | Contextualiza ejemplos |
| `objetivos` | "¿Que buscas en este momento?" | "Ej: Quiero entender por que me agoto..." | Foco de las interpretaciones |
| `desafios` | "¿Cual es tu mayor desafio?" | "Ej: Me cuesta decir que no a proyectos..." | Personaliza Fortalezas/Sombras |

### 4.2 UX

- Se muestra antes de generar el reporte (IntakeView)
- Cada campo tiene textarea + boton de microfono (transcripcion via Whisper)
- Boton "Omitir" → genera reporte generico (sin intake)
- Boton "Generar mi informe" → genera con intake
- El intake se guarda en `users.intake` y es visible/editable desde ProfilePanel

### 4.3 VoiceRecorder

El `VoiceRecorder.tsx` actual reemplaza toda la UI (fullscreen recording). Para IntakeView necesitamos un **modo inline** por campo.

**Solucion**: Extraer la logica de grabacion/transcripcion a un hook `useVoiceRecorder()` que retorne `{ isRecording, startRecording, stopRecording, transcription, error }`. El componente `VoiceRecorder` actual se refactoriza para usar el hook. `IntakeView` usa el hook directamente con un boton mic inline por campo.

### 4.4 Profile hash

El `profile_hash` (usado para cache invalidation de reportes) incluye intake:

```typescript
function computeProfileHash(profile: UserProfile, intake?: Intake): string {
  const data = JSON.stringify({ profile: profile.humanDesign, intake: intake ?? null });
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}
```

Si el intake cambia, el hash cambia, y se regenera el reporte.

---

## 5. Inventario de contenido estatico

### 5.1 Descripciones (96 entradas)

| Categoria | Entradas | Palabras estimadas c/u | Total palabras |
|-----------|----------|----------------------|----------------|
| TYPE_DESCRIPTIONS | 5 | 400-600 | ~2,500 |
| AUTHORITY_DESCRIPTIONS | 7 | 300-400 | ~2,500 |
| PROFILE_DESCRIPTIONS | 12 | 300-400 | ~4,200 |
| DEFINITION_DESCRIPTIONS | 5 | 200-300 | ~1,250 |
| CHANNEL_DESCRIPTIONS | 36 | 150-250 | ~7,200 |
| CENTER_UNDEFINED_DESCRIPTIONS | 9 | 200-300 | ~2,250 |
| VARIABLE_DESCRIPTIONS | 22 | 100-200 | ~3,000 |
| **Total** | **96** | | **~22,900** |

Detalle de VARIABLE_DESCRIPTIONS (22):
- Digestion: 9 (Paz y Quietud, Sed caliente, Sed fria, Gusto abierto, Gusto cerrado, Sonido alto, Sonido bajo, Luz directa, Luz indirecta)
- Entorno: 6 (Costas, Cuevas, Mercados, Cocinas, Montanas, Valles)
- Sentido mas fuerte: 7 (Sentir, Tacto, Gusto, Olfato, Vision externa, Vision interna, Sonido)

### 5.2 Totales del modulo de reportes

| Tipo | Entradas | Estado |
|------|----------|--------|
| Descripciones estaticas | 96 | Por escribir |
| i18n nuevas | 31 | Por crear |
| i18n existentes (reutilizar) | ~50+ | Ya en codebase |
| **Total entidades nuevas** | **127** | |

### 5.3 Estrategia de escritura

1. GPT-4o genera borradores para las 96 descripciones
2. Revision experta HD (tono, precision, idioma)
3. Formato: cada descripcion es un string multilinea en espanol, sin markdown, prosa limpia
4. Se almacenan en `backend/src/report/static-content.ts` como `Record<string, string>`

---

## 6. Estrategia de llamadas LLM

### 6.1 Tres llamadas paralelas (no 10 secuenciales)

| Call | Secciones | Output tokens est. | Input tokens est. | Contenido |
|------|-----------|--------------------|--------------------|-----------|
| **Call 1** | Tipo + Autoridad + Perfil + Definicion | ~1,150 | ~600 | Parrafos personalizados conectando dimensiones basicas |
| **Call 2** | Canales + Centros Indefinidos + Variables | ~1,700 | ~800 | Interaccion de canales, patron de condicionamiento, aplicacion practica de variables |
| **Call 3** | Cruz de Encarnacion + Fortalezas y Sombras | ~1,400 | ~700 | Proposito vital + sintesis cruzada de todo el diseno |
| **Total** | 10 secciones | **~4,250** | **~2,100** | |

**Latencia**: 3 calls en paralelo ≈ 3-5s (vs 10 secuenciales ≈ 15-20s).

### 6.2 Calls por tier

**Free tier**: Solo Call 1, pero con prompt reducido (solo Tipo + Autoridad + Perfil teaser, sin Definicion completa).
- Output: ~600 tokens
- Costo: ~$0.001 (gpt-4o-mini)

**Premium tier**: Las 3 calls completas.
- Output: ~4,250 tokens
- Costo: ~$0.007 (gpt-4o-mini)

### 6.3 Prompts

Archivo: `backend/src/report/prompts.ts`

Cada prompt incluye:
1. System: rol de experto HD + "Responde EXCLUSIVAMENTE en espanol"
2. User: datos del perfil relevantes para esa call
3. Si hay intake: se inyecta como contexto adicional (`"Contexto del usuario: actividad={x}, objetivos={y}, desafios={z}"`)
4. Si no hay intake: el prompt omite la seccion de contexto (reporte generico)

**Call 1 free** vs **Call 1 premium**: prompts distintos. Free pide 3 parrafos cortos (tipo, autoridad, teaser perfil). Premium pide 4 parrafos mas profundos (tipo, autoridad, perfil completo, definicion).

### 6.4 Caching

Tabla `hd_reports` almacena el reporte generado. Se regenera solo si:
- `profile_hash` cambia (perfil o intake modificados)
- Usuario solicita regeneracion explicitamente

---

## 7. Slices de implementacion

### Slice 0 — Contenido estatico + i18n

**Archivos nuevos:**
- `backend/src/report/static-content.ts` — 96 descripciones
- `backend/src/report/hd-i18n.ts` — 31 traducciones nuevas + helpers
- `backend/src/report/types.ts` — interfaces ReportSection, DesignReport, Intake

**Criterio de aceptacion:** Importar `static-content.ts`, hacer lookup `TYPE_DESCRIPTIONS["Generador"]` y obtener string en espanol de 400+ palabras. `translateHD("Sun", PLANET_ES)` retorna `"Sol"`.

**Esfuerzo estimado:** 2-3 dias (redaccion + revision).

---

### Slice 1 — Generacion de reportes

**Archivos nuevos:**
- `backend/src/report/generate-report.ts` — `buildStaticSections()`, 3 calls LLM paralelas, `computeProfileHash()`
- `backend/src/report/prompts.ts` — 4 prompts (Call 1 free, Call 1 premium, Call 2, Call 3)

**Archivos modificados:**
- `backend/src/db.ts`:
  - `ALTER TABLE users ADD COLUMN intake TEXT DEFAULT NULL`
  - Nueva tabla `hd_reports`:
    ```sql
    CREATE TABLE IF NOT EXISTS hd_reports (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tier         TEXT NOT NULL CHECK(tier IN ('free', 'premium')),
      profile_hash TEXT NOT NULL,
      content      TEXT NOT NULL,
      tokens_used  INTEGER NOT NULL DEFAULT 0,
      cost_usd     REAL NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, tier)
    )
    ```
  - Funciones: `getReport(userId, tier)`, `saveReport(report)`, `getReportByHash(userId, tier, hash)`
  - Modificar `updateUser()`: aceptar `intake?: object` como parametro opcional
  - Modificar `getUser()`: retornar campo `intake`

- `backend/src/routes/users.ts`:
  - `PUT /api/users/:id` acepta `{ name, profile, intake? }` en body

**Rutas nuevas:**
- `backend/src/routes/report.ts`:
  - `POST /api/users/:id/report` — `{ tier: 'free'|'premium' }` → genera o retorna cached
  - `GET /api/users/:id/report` — retorna ultimo reporte generado (JSON)

**Criterio de aceptacion:** `POST /api/users/:id/report { tier: "free" }` retorna JSON con 4 secciones (3 completas + 1 teaser) en <5s. Llamar de nuevo sin cambios retorna cached.

**Esfuerzo estimado:** 2-3 dias.

---

### Slice 1.5 — Intake

**Archivos nuevos:**
- `frontend/src/hooks/useVoiceRecorder.ts` — Hook extraido de VoiceRecorder.tsx
- `frontend/src/components/IntakeView.tsx` — 3 textareas + mic buttons + Omitir/Generar

**Archivos modificados:**
- `frontend/src/components/VoiceRecorder.tsx` — Refactorizar para usar `useVoiceRecorder` hook
- `frontend/src/components/ProfilePanel.tsx`:
  - Seccion "Tu contexto" mostrando intake actual
  - Boton "Editar" que abre IntakeView
  - Boton "Generar mi informe" al fondo del panel
- `frontend/src/api.ts` — `updateUser()` enviar intake en PUT body
- `frontend/src/types.ts` — `Intake` interface + agregar a `UserProfile` o como campo separado

**Flujo:**
1. Usuario toca "Generar mi informe" en ProfilePanel
2. Se muestra IntakeView
3. Completa campos (texto o voz) o toca "Omitir"
4. Se guarda intake via `PUT /api/users/:id` con `{ intake }`
5. Se llama `POST /api/users/:id/report { tier }` → navega a ReportView

**Criterio de aceptacion:** IntakeView con 3 campos funcionales. Mic button graba y transcribe inline. Omitir genera reporte sin intake. Intake se persiste y se ve en ProfilePanel.

**Esfuerzo estimado:** 1-2 dias.

---

### Slice 2 — ReportView (in-app)

**Archivos nuevos:**
- `frontend/src/components/ReportView.tsx` — Vista full-width con secciones colapsables

**Archivos modificados:**
- `frontend/src/App.tsx` — Agregar vista "report" al router de estado
- `frontend/src/components/NavBar.tsx` — Navegacion de vuelta ("← Volver")

**UX:**
- Secciones free: renderizadas completas, colapsables
- Secciones premium: titulo + 🔒 + blur + CTA
- Seccion Perfil (teaser): descripcion estatica completa + 2-3 lineas LLM + truncamiento con "Continua en el reporte completo"
- Footer: boton "Descargar PDF" + boton "Compartir"
- Navegacion: "← Volver" regresa a la vista anterior (ProfilePanel o Chat)

**Criterio de aceptacion:** ReportView muestra 10 secciones, 4 visibles, 6 locked. Boton Descargar funcional. Responsive en mobile.

**Esfuerzo estimado:** 1-2 dias.

---

### Slice 3 — PDF

**Archivos nuevos:**
- `backend/src/report/pdf-renderer.tsx` — Componentes React PDF (CoverPage, SectionPage, Footer)

**Dependencias nuevas:**
- `@react-pdf/renderer` en backend

**Archivos modificados:**
- `backend/src/routes/report.ts`:
  - `GET /api/users/:id/report/pdf?tier=free|premium` → renderiza PDF → stream

**Assets:**
- `backend/assets/fonts/CormorantGaramond-Regular.ttf`
- `backend/assets/fonts/CormorantGaramond-Bold.ttf`
- `backend/assets/fonts/CormorantGaramond-Italic.ttf`
- `backend/assets/fonts/Inter-Regular.ttf`
- `backend/assets/fonts/Inter-SemiBold.ttf`

**Font registration:**
```typescript
import { Font } from '@react-pdf/renderer';
import path from 'node:path';

const fontsDir = path.resolve(__dirname, '../assets/fonts');

Font.register({
  family: 'Cormorant',
  fonts: [
    { src: path.join(fontsDir, 'CormorantGaramond-Regular.ttf') },
    { src: path.join(fontsDir, 'CormorantGaramond-Bold.ttf'), fontWeight: 'bold' },
    { src: path.join(fontsDir, 'CormorantGaramond-Italic.ttf'), fontStyle: 'italic' },
  ],
});
```

**Estetica PDF:**
- Fondo oscuro: `#0A0910`
- Acento dorado: `#D4AF37`
- Texto claro: `#F0EDE6`
- Header serif (Cormorant), body sans (Inter)
- Numeros de pagina en footer

**Tier free incluye PDF**: Si. El PDF free tiene las mismas 3.5 secciones que la vista in-app, mas una pagina final con CTA para premium.

**Criterio de aceptacion:** `GET /api/users/:id/report/pdf?tier=free` retorna PDF valido con texto seleccionable, fonts custom, y 3.5 secciones.

**Esfuerzo estimado:** 2-3 dias.

---

### Slice 4 — Compartir via link

**Archivos modificados:**
- `backend/src/db.ts`:
  - Nueva tabla `report_shares`:
    ```sql
    CREATE TABLE IF NOT EXISTS report_shares (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_id  TEXT NOT NULL REFERENCES hd_reports(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
    ```
  - Funciones: `createShareToken(userId, reportId, expiryDays)`, `getShareByToken(token)`

- `backend/src/routes/report.ts`:
  - `POST /api/users/:id/report/share` → crea token UUID, expira en 7 dias, retorna URL
  - `GET /api/report/shared/:token` → valida expiry, retorna PDF o JSON

**Manejo de expiry:** Si el token expiro, retornar 410 Gone con mensaje amigable ("Este enlace ha expirado").

**Frontend:**
- Boton "Compartir" en ReportView genera link y copia al clipboard
- Opcionalmente abre `mailto:?subject=...&body=<link>` como fallback para compartir por email

**Criterio de aceptacion:** Compartir genera link. Abrir link en incognito muestra el PDF. Link de 8+ dias retorna 410.

**Esfuerzo estimado:** 1 dia.

---

## 8. Schema de DB (resumen de cambios)

```sql
-- Modificacion a tabla existente
ALTER TABLE users ADD COLUMN intake TEXT DEFAULT NULL;

-- Tabla nueva: reportes HD
CREATE TABLE IF NOT EXISTS hd_reports (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL CHECK(tier IN ('free', 'premium')),
  profile_hash TEXT NOT NULL,
  content      TEXT NOT NULL,    -- JSON del DesignReport
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  cost_usd     REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tier)
);

-- Tabla nueva: links de compartir
CREATE TABLE IF NOT EXISTS report_shares (
  token      TEXT PRIMARY KEY,  -- UUID
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id  TEXT NOT NULL REFERENCES hd_reports(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 9. API endpoints (nuevos y modificados)

| Metodo | Ruta | Cambio | Descripcion |
|--------|------|--------|-------------|
| PUT | `/api/users/:id` | MODIFICADO | Acepta `intake` opcional en body |
| POST | `/api/users/:id/report` | NUEVO | `{ tier }` → genera reporte o retorna cached |
| GET | `/api/users/:id/report` | NUEVO | Retorna ultimo reporte (JSON) |
| GET | `/api/users/:id/report/pdf` | NUEVO | `?tier=free\|premium` → stream PDF |
| POST | `/api/users/:id/report/share` | NUEVO | Crea link temporal, retorna URL |
| GET | `/api/report/shared/:token` | NUEVO | Acceso publico al PDF compartido |

---

## 10. Mapa de archivos

### Nuevos

| Archivo | Slice | Proposito |
|---------|-------|-----------|
| `backend/src/report/types.ts` | 0 | Interfaces: ReportSection, DesignReport, Intake |
| `backend/src/report/static-content.ts` | 0 | 96 descripciones HD en espanol |
| `backend/src/report/hd-i18n.ts` | 0 | 31 traducciones + helpers |
| `backend/src/report/generate-report.ts` | 1 | Logica hibrida: static + 3 LLM calls |
| `backend/src/report/prompts.ts` | 1 | 4 system prompts (Call 1 free, Call 1 premium, Call 2, Call 3) |
| `backend/src/routes/report.ts` | 1 | Rutas de reporte |
| `frontend/src/hooks/useVoiceRecorder.ts` | 1.5 | Hook de grabacion extraido |
| `frontend/src/components/IntakeView.tsx` | 1.5 | 3 campos + voz + Omitir/Generar |
| `frontend/src/components/ReportView.tsx` | 2 | Vista in-app con freemium |
| `backend/src/report/pdf-renderer.tsx` | 3 | Componentes React PDF |
| `backend/assets/fonts/*.ttf` | 3 | Cormorant Garamond + Inter |

### Modificados

| Archivo | Slice | Cambio |
|---------|-------|--------|
| `backend/src/db.ts` | 1 | intake column, hd_reports table, report_shares table, updateUser, getUser |
| `backend/src/routes/users.ts` | 1 | PUT body acepta intake |
| `frontend/src/components/VoiceRecorder.tsx` | 1.5 | Refactor a usar useVoiceRecorder hook |
| `frontend/src/components/ProfilePanel.tsx` | 1.5 | Seccion "Tu contexto" + boton "Generar" |
| `frontend/src/api.ts` | 1.5 | updateUser envia intake |
| `frontend/src/types.ts` | 1.5 | Interface Intake |
| `frontend/src/App.tsx` | 2 | Vista "report" en router |
| `frontend/src/components/NavBar.tsx` | 2 | Navegacion back |
| `backend/package.json` | 3 | @react-pdf/renderer dependency |

---

## 11. Costos

| Tier | LLM calls | Tokens output | Tokens input | Costo gpt-4o-mini | Costo gpt-4o |
|------|-----------|---------------|--------------|--------------------|--------------| 
| Free | 1 (reducida) | ~600 | ~400 | **~$0.001** | ~$0.008 |
| Premium | 3 (paralelas) | ~4,250 | ~2,100 | **~$0.007** | ~$0.05 |

A escala (1,000 reportes/mes, 70% free / 30% premium):
- gpt-4o-mini: $0.70 (free) + $2.10 (premium) = **$2.80/mes**
- gpt-4o: $5.60 + $15.00 = $20.60/mes

---

## 12. Decisiones abiertas (resolver durante implementacion)

| # | Decision | Contexto | Impacto |
|---|----------|----------|---------|
| 1 | Boton "Regenerar" en ReportView | ¿Permitir regenerar manualmente? ¿Limite? | UX, costo |
| 2 | Navegacion back desde ReportView | ¿Vuelve a ProfilePanel, Chat, o ultimo lugar? | Router state |
| 3 | Estructura interna de descripciones | ¿String plano o `{ intro, body, cierre }`? | Complejidad de static-content.ts |
| 4 | Manejo de perfil incompleto | ¿Generar reporte parcial o bloquear? Ej: usuario sin variable data | UX, edge cases |
| 5 | PDF para free tier | Decidido: si, incluye pagina final con CTA premium | — |
| 6 | Link compartido muestra PDF o vista web | ¿Renderizar HTML publico o solo servir PDF? | Esfuerzo de Slice 4 |
