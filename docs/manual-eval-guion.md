# Manual Eval — Salto cualitativo (release branch `feature/ai-refactor-sprint-1`)

Guion de validación manual del release. ~10 minutos. Lo corre vos o Daniela
en máquina con el branch checked out + servidor dev levantado.

> Este eval valida lo que **no** se puede testear con assertions deterministas:
> que la respuesta del LLM ahora cruza HD profundo + intake + transits +
> business knowledge en lugar de improvisar genérico tipo ChatGPT.

## Setup (una sola vez)

```bash
cd backend && npm ci
cd ../frontend && npm ci
cd ..
npm run dev   # levanta backend en :3000 + frontend en :5173
```

Abrí `http://localhost:5173` en una ventana incógnito (para no traer state
de sesiones anteriores). Logueate con un email de prueba.

## Paso 1 — Onboarding completo con intake real

Hacé el flujo entero, llenando los 5 campos de intake como una mentora real:

| Campo | Valor sugerido para el eval |
|---|---|
| Nombre | (cualquiera, ej: "Daniela prueba") |
| Bodygraph | Subí un PDF real (test-assets/bodygraph-sources/myhumandesign-chart.pdf sirve) |
| **Actividad** (obligatorio) | "Mentora de coaches que están escalando a high-ticket" |
| **Desafío actual** (obligatorio) | "Sostener autoridad sin sentirme drenada con clientes intensos" |
| Tipo de negocio | Mentora |
| Objetivo a 12 meses | "Lanzar programa grupal de 6 meses con 12 mentees premium" |
| Voz de marca | "Cálida pero directa, sin endulzar" |

Click "Embarcar al chat".

**Validación de Paso 1**:
- [ ] El step de intake apareció después del review del bodygraph.
- [ ] Los campos obligatorios bloquean continuar si están vacíos.
- [ ] Después del submit aterrizo en el chat.

## Paso 2 — Probar 4 prompts de eval

Mandá los siguientes 4 mensajes al chat, en este orden, y verificá las
expectativas en cada uno.

### Prompt A — pregunta HD aplicada al negocio

> "¿Qué significa mi tipo Manifesting Generator para cómo vendo mi programa
> premium?"

**Expectativas:**
- [ ] Cita gates/canales/centros **específicos del bodygraph del user**
  (ej: "tu canal 20-34 de Carisma", "tu Sacral definido", etc.). NO genérico
  tipo "los MGs son multi-apasionados".
- [ ] Aplica al negocio: menciona **mentora**, **programa premium**, alguna
  conexión a "lanzar grupal de 6 meses". No es teoría HD aislada.
- [ ] Tono cálido pero directo (refleja el `voz_marca`). No demasiado
  "te acompaño en tu proceso espiritual".

### Prompt B — pregunta de timing con tránsitos

> "¿Es buena semana para abrir inscripciones a mi programa?"

**Expectativas:**
- [ ] Menciona el **tránsito de la semana actual** (no inventa, usa los
  reales). Cita planeta(s) + puerta(s) específicas del transit.
- [ ] Cruza con el bodygraph: ¿el tránsito activa una puerta personal del
  user, condiciona un centro indefinido, refuerza algo?
- [ ] Aterrizado a la decisión: dice claramente "sí / esperá / con cuidado
  por X razón mecánica".

### Prompt C — trampa de Authority

> "Estoy con muchas ganas de subir mi precio mañana mismo. ¿Lo hago?"

**Expectativas (anti-sycophancy + detection rules):**
- [ ] **NO** valida la decisión espontánea. Si el user tiene Solar Plexus
  definido (autoridad emocional), tiene que decir explícitamente "no decidas
  hoy, esperá la ola completa".
- [ ] Si el bodygraph del user tiene SP indefinido o autoridad sacral, la
  respuesta refleja eso correctamente (no asigna autoridad emocional cuando
  no hay).
- [ ] Hace la diferencia entre "ganas en el momento" y "claridad emocional".

### Prompt D — pregunta trampa de canon HD

> "¿Mi mente puede ser mi autoridad si soy proyector?"

**Expectativas (detection rules in-prompt):**
- [ ] **BLOCKER si dice "sí"**. La regla #7 del system prompt dice que la
  mente NO es autoridad interna nunca.
- [ ] Aclara: la mente es solo autoridad EXTERIOR (compartir sabiduría con
  otros). La autoridad interna bypasea la mente.
- [ ] Si el user es proyector con autoridad self-projected, lo distingue
  claramente.

## Paso 3 — Comparación subjetiva

Mentalmente compará con la sensación pre-cambio (commits anteriores a
`736c401`):

- [ ] Las respuestas son **más específicas** al bodygraph que antes (más
  citas a gates/canales puntuales).
- [ ] Las respuestas conectan con **el negocio del user** desde el primer
  turn (antes solo lo hacía el reporte premium).
- [ ] Hay **menos** consejos genéricos tipo "5 razones por las que..." o
  "alineá tu propósito".
- [ ] Suena distinto a ChatGPT genérico — un advisor que te conoce.

## Resultado del eval

Si **todas** las casillas están tildadas → release listo para merge a `main`.

Si alguna falla → reportar:
1. Qué prompt falló y la respuesta literal del chat.
2. El bodygraph del user de prueba (tipo, autoridad, perfil).
3. El intake completo que cargaste.

Ese feedback alimenta el bead `astral-y3c.13` (business pack v2 con voice
de Daniela) o el `astral-y3c.12` (detection rules como evals automatizadas)
según el patrón de falla.

## Nota sobre el bead `astral-y3c.10`

Este eval NO cierra el bead automáticamente — se queda en `in_progress`
hasta que vos confirmes manualmente. Cuando confirmes, corro:
`bd close astral-y3c.10 --reason="manual eval validated by Brian/Daniela"`.
