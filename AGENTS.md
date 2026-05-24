# AGENTS.md — Astral

**Fuente de verdad para cualquier AI agent (Claude Code, Codex, Cursor, etc.) trabajando en Astral.**

---

## 📚 Read first

| Querés... | Leé |
|---|---|
| Entender el proyecto desde cero | [`docs/architecture/project-overview.md`](docs/architecture/project-overview.md) |
| Tocar la capa de AI / chat | [`docs/architecture/chat-llm-system.md`](docs/architecture/chat-llm-system.md) + [`docs/architecture/refactor-2026-05-decisions.md`](docs/architecture/refactor-2026-05-decisions.md) |
| Investigar tema X (industria 2026) | [`docs/research/`](docs/research/) |
| Buscar cualquier otra doc | [`docs/INDEX.md`](docs/INDEX.md) |
| Referencia HD canónica | [`docs/human-design-reference.md`](docs/human-design-reference.md) |
| Plan de rollout chat v2 | [`docs/chat-v2-rollout.md`](docs/chat-v2-rollout.md) |
| Auditar / consultar prod (Turso + R2) | [`backend/scripts/prod-audits/README.md`](backend/scripts/prod-audits/README.md) |

**Convención**: no duplicar info que ya esté en `docs/`. Apuntá ahí.

---

## ⚠️ Reglas Astral-específicas (obligatorias)

### Branch + commits

- Branches desde `main`: `feature/<tema-descriptivo>` (kebab-case en inglés).
- Conventional Commits: `type(scope): description` (ej: `feat(ai)`, `fix(transits)`, `docs`, `refactor`, `test`, `chore`).
- Body explicativo en español o inglés. **Co-Authored-By** al final si Claude/Codex generó el commit.
- **NUNCA** push directo a `main` salvo que el founder lo pida explícitamente.

### Tests + tsc

- **Toda PR debe pasar** `cd backend && npx tsc --noEmit` + `npx vitest run` antes de commit.
- **Nunca** commit con tests rojos.
- Tests nuevos para features nuevas. Para bugs: test de regresión que falla pre-fix y pasa post-fix.

### Beads (task tracking)

- **Usar beads** para TODO task tracking: `bd ready`, `bd create`, `bd update --claim`, `bd-close.sh <id>`.
- **Prohibido**: TodoWrite, TaskCreate, markdown files para tasks.
- Memoria de sesión: `bd remember "..."` para insights persistentes.
- Antes de empezar una task: leer parent epic con `bd show <epic-id>` si aplica.

### Modelo de IA (chat)

- Default: `gpt-4o-mini` via env var `CHAT_MODEL` (configurable desde Render dashboard sin redeploy de código).
- Path canónico: `agent-service-v2.ts` + Vercel AI SDK + 5 HD tools deterministas.
- Legacy `agent-service.ts` y `FEATURE_CHAT_USE_TOOLS` fueron eliminados en `astral-e2h.1`; no reintroducir fallback v1.
- Antes de cambiar el system prompt: `cd backend && npm run smoke:chat-v2 -- 5` para tener baseline.
- **No mezclar** static y dynamic en el system prompt — rompe el cache automático de OpenAI.
- **No agregar** content al system prompt sin medir `tokens_in` antes/después.
- Si el LLM alucina algo verificable, **agregar un tool**, no agregar reglas al prompt.

### Deploy

- Render. Chat usa tools siempre; rollback del path v1 ya no existe.
- Env vars de modelos (`CHAT_MODEL`, `MEMORY_WRITER_MODEL`, `REPORT_MODEL`) cambiables desde dashboard. La extracción PDF actual es determinística y no usa modelo.
- Rollback de cualquier feature = 1 var de env, sin redeploy de código.

### Bugs P0 abiertos (mencionar en cualquier PR cercana)

- `astral-m25` — Data fix manual para 6 cuentas premium afectadas. Estado 2026-05-20: 3/6 migradas vía Swiss Ephemeris (Daniela, Pili, Agos). Pendientes: Mayra (esperando birth data), Lucia (esperando birth data + active asset fix), Melisa Pando (decisión founder).
- `astral-4ue` — Migration sucessor de m25 (script `migrate-user-to-swiss.ts`). Cerrar cuando las 3 pendientes estén migradas.

**Históricos resueltos** (mantener referencias para contexto histórico):
- `astral-0b7` ✅ Bug A (`/me/assets` con `fileType=hd`).
- `astral-bdt` ✅ Bug B (`PUT /users/:id` admin write profile).

Detalle de investigación original en [`docs/architecture/bug-investigation-daniela-2026-05.md`](docs/architecture/bug-investigation-daniela-2026-05.md).

### V1 vs V2 — decisiones explícitas de producto

**V1 (actual, en producción):**
- **Una sola carta activa por user.** `users.profile_asset_id` apunta al PDF activo.
- **Re-subir pisa la anterior.** No hay UI para "elegir entre múltiples cartas cargadas".
- **Profile único** en `users.profile` (JSON con birthData + humanDesign).
- **Chat, informe, tránsitos** todos leen el único profile activo.

**V2 (próxima versión, sin definiciones de producto cerradas todavía — epic `astral-yaa`):**
- **Multiple profiles per user.** Una coach HD puede tener su propia carta + cartas de sus clientas + carta de "Negocio Nuevo" como entidades separadas con IDs estables.
- **Cross-profile context.** Posiblemente cómo una carta impacta sobre otra (sinastría / overlay).
- **Profile-aware permissions.** Ownership, consentimiento, acceso por perfil (prerequisite para Remote MCP V3).
- **Chat per-profile** (posible — TBD): un thread por carta evitaría scope-drift entre temas.

**Implicancia para agentes que toquen esta área:**
- ❌ **NO implementar features que asuman multi-profile en V1**: e.g. "seleccionar carta activa entre múltiples cargadas", "persistir profile por asset", endpoints `PATCH /me/assets/:id/active`, tabla `asset_profiles`. Todo eso será re-modelado en V2 — agregar la lógica intermedia es deuda técnica.
- ✅ Si un pedido de producto huele a multi-profile (e.g. review Daniela #13 "cambiar carta activa sin re-subir"), **superseder por V2** en lugar de implementarlo en V1.
- ✅ Sí mantener el modelo V1 simple y consistente — re-subir pisa, una sola carta activa, sin UI extra.

**Doc base de V2:** [`docs/remote-mcp-v3-domain-capability-layer-plan.md`](docs/remote-mcp-v3-domain-capability-layer-plan.md) (sección Dependency policy — V2 multiple profiles es el gate para V3). Spec V2 dedicado pendiente.

---

## 🛠️ Skills disponibles

Invocar con `/skill-name`. Skills user-level provistas en `~/.claude/skills/`. Listado completo solo si lo necesitás:

| Comando | Cuándo |
|---|---|
| `/sparring` | Antes de comprometerte a una dirección. Challenge intenso, expone blind spots. |
| `/architect` | Después de sparring, cuando necesitás un spec ejecutable. |
| `/executor` | Implementación de un spec ya validado. |
| `/explorer` | Reconocimiento del codebase antes de diseñar. |
| `/feature-decomposer` | Idea vaga → FEATURE.md + slices implementables. |
| `/pr-reviewer` | Review multi-fase de PR con orchestrator. |
| `/handoff` | Generar checkpoint para próxima sesión / otro agente. |
| `/beads-specialist` | Cualquier operación con beads que requiera deep knowledge. |
| `/claude-code-specialist` | Configurar hooks, skills, subagents, MCP. |
| `/codex-specialist` | Configurar Codex CLI. |
| `/eval-specialist` | Diseñar evals para prompts/skills. |
| `/genai-gateway-specialist` | (MeLi) Consumir LLMs vía Gateway Hub. |
| `/manos-api-db-specialist` | (Manos) Schema, GORM, migraciones. |
| `/find-skills` | Si no sabés qué skill usar. |

Para skills no listadas: `bd help`, `~/.claude/skills/`, o `/find-skills`.

---

## 🎯 Workflow recomendado

```
1. bd ready                          ← qué hay para hacer
2. bd show <id>                      ← entender la task
3. /sparring (si decisión grande)    ← challenge antes de comprometer
4. /architect (si necesitás spec)    ← spec ejecutable
5. /explorer (si codebase desconocido) ← reconocimiento
6. bd update <id> --claim            ← claim la task
7. implementar
8. cd backend && npx tsc --noEmit && npx vitest run
9. cd backend && npm run smoke:chat-v2 -- 5  ← solo si tocaste capa AI
10. git add specific-files
11. git commit (Conventional Commits + Co-Authored-By si aplica)
12. git push (a feature branch, NO main)
13. bd-close.sh <id>
```

---

## 🚫 Prohibiciones

1. **NUNCA** `git push` directo a `main`.
2. **NUNCA** commit con tests rojos o `tsc` con errores.
3. **NUNCA** modificar `.env` real (solo `.env.example`).
4. **NUNCA** commitear secretos (OpenAI keys, Anthropic keys, SuperTokens keys, R2 credentials).
5. **NUNCA** `git add -A` o `git add .` — usar paths específicos (evita commitear `.env.bak`, `astral.db.*.bak`).
6. **NUNCA** duplicar contenido entre AGENTS.md y `docs/` — apuntar siempre.

---

## 🗣️ Comunicación

- Casual, directo, sin floreos.
- Respuesta primero, explicación después.
- Sin moral lectures, sin disclaimers de "soy una IA".
- Code suggestions: diffs breves, no rewrites enteros.
- Output de PR review: español.

---

## 📞 Cuando estés en duda

1. Buscar en `docs/INDEX.md`.
2. Si no aparece: `bd memories <keyword>` (memorias persistentes).
3. Si tampoco: preguntar al founder. NO inventar.
