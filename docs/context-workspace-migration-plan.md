# Context Workspace Migration Plan

**Fecha:** 2026-05-10
**Estado:** plan de migración v0 para agentes
**Capa:** orden de ejecución, dependencias y gates
**Leer antes:** [bodygraph-relacional.md](./bodygraph-relacional.md), [context-workspace-ux.md](./context-workspace-ux.md), [context-workspace-architecture.md](./context-workspace-architecture.md), [context-workspace-e2e-plan.md](./context-workspace-e2e-plan.md)

Este documento orquesta los assets de discovery en un plan incremental. No es una spec técnica cerrada. Sirve para que futuros agentes no intenten implementar todo de una vez ni metan contexto solo en una pantalla.

## Objetivo

Migrar Astral desde:

```text
users.profile → Chat / Informe / Tránsitos / Mis Cartas
```

hacia:

```text
Context Workspace
  ├─ sujetos
  ├─ conexiones
  └─ superficies por contexto
       ├─ Chat
       ├─ Informe
       ├─ Tránsitos
       └─ Carta / Dinámica
```

Sin romper la experiencia actual de `Mi carta`.

## Orden De Lectura Para Agentes

1. [bodygraph-relacional.md](./bodygraph-relacional.md): intención producto.
2. [context-workspace-ux.md](./context-workspace-ux.md): pantallas y flujos.
3. [context-workspace-architecture.md](./context-workspace-architecture.md): DB/endpoints/contracts.
4. [context-workspace-e2e-plan.md](./context-workspace-e2e-plan.md): tests primero.
5. Este documento: plan paso a paso.

## Regla Madre

No implementar una superficie aislada con su propio selector de contexto.

Cada cambio debe acercar la app a:

```text
Contexto activo → superficie activa
```

## Fase 0: Congelar Estado Actual

**Objetivo:** asegurar que el modelo actual sigue funcionando mientras se introduce contexto.

Tareas:

- revisar cobertura E2E existente de onboarding, chat, informe, tránsitos y assets;
- agregar tests faltantes del baseline;
- confirmar que reemplazar bodygraph sigue invalidando lo necesario;
- documentar cualquier comportamiento legacy que no se debe preservar.

Gate:

- E2E baseline pasa;
- no hay cambio de UX todavía;
- no hay tablas nuevas todavía.

## Fase 1: Definir Contratos E2E Del Context Workspace

**Objetivo:** escribir tests de la experiencia objetivo con mocks antes del modelo real.

Tareas:

- crear fixtures de sujetos y conexiones;
- testear Biblioteca;
- testear workspace individual;
- testear workspace conexión;
- testear cambio de contexto;
- testear Chat individual vs conexión;
- testear Informe individual vs relacional;
- testear Tránsitos individual vs relacional.

Gate:

- los tests nuevos fallan por funcionalidad faltante, no por errores de setup;
- los tests verifican que viaja context id;
- los tests no dependen de LLM real.

## Fase 2: Introducir Subject Primario Como Sombra

**Objetivo:** crear el puente entre `users.profile` y el nuevo modelo sin cambiar la UI.

Tareas:

- agregar modelo persistente de `subjects` o equivalente;
- crear subject primario para usuarios existentes;
- mapear `users.profile` al subject primario;
- asociar asset activo legacy al subject primario;
- mantener `/api/me` funcionando.

Gate:

- app actual se comporta igual;
- existe subject primario para usuarios migrados;
- reportes/chat/tránsitos legacy siguen leyendo datos correctos;
- no se crean sujetos duplicados en reintentos.

## Fase 3: Biblioteca Mínima

**Objetivo:** reemplazar mentalmente `Mis Cartas` por Biblioteca sin migrar todas las superficies todavía.

Tareas:

- crear `GET /api/contexts` o endpoint equivalente;
- mostrar subject primario;
- listar sujetos adicionales;
- listar conexiones si existen;
- crear sujeto tercero;
- crear conexión A+B;
- abrir workspace por contexto.

Gate:

- usuario puede crear `Cliente X`;
- usuario puede crear `Brian + AUREA`;
- Biblioteca no muestra birth data crudo;
- crear conexión no abre chat automáticamente;
- E2E de Biblioteca pasa.

## Fase 4: Context Shell Frontend

**Objetivo:** introducir header de contexto activo y superficies sobre contexto.

Tareas:

- crear estado `activeContext`;
- renderizar tabs según tipo de contexto;
- individual: `Chat`, `Informe`, `Tránsitos`, `Carta`;
- conexión: `Chat`, `Informe`, `Tránsitos`, `Dinámica`;
- cambiar contexto desde header o Biblioteca.

Gate:

- cambiar contexto actualiza título/subtítulo;
- las tabs no pierden contexto;
- mobile mantiene contexto visible;
- E2E de workspace pasa.

## Fase 5: Chat Contextual

**Objetivo:** eliminar el monothread para flujos nuevos.

Tareas:

- crear threads por context;
- migrar historial legacy al subject primario;
- crear endpoints de chat por context;
- adaptar prompts para subject vs connection;
- separar memoria por context o bloquear memoria relacional hasta tener scope seguro.

Gate:

- Chat de `Brian` no muestra mensajes de `Cliente X + Pareja`;
- Chat de conexión usa cartas A+B;
- feedback/copy/edit/truncate se aplican al thread correcto;
- message limits siguen funcionando por cuenta/plan;
- E2E de chat contextual pasa.

## Fase 6: Informes Contextuales

**Objetivo:** separar informe individual de informe relacional.

Tareas:

- crear reportes por context;
- mapear reporte legacy al subject primario;
- definir hash individual;
- definir hash relacional;
- crear plantilla relacional mínima;
- mantener report stale por context.

Gate:

- informe individual no se sirve para conexión;
- informe relacional no se invalida por cambios ajenos;
- regenerar un informe no pisa otro contexto;
- PDF/share, si siguen activos, respetan context o quedan fuera de V1.

## Fase 7: Tránsitos Contextuales

**Objetivo:** hacer que Tránsitos consuma contexto activo.

Tareas:

- mantener ADR de hoy/slider/7 días;
- crear endpoint o adapter de tránsitos por context;
- subject: impacto individual;
- connection: resumen, A, B, dinámica;
- CTA al agente incluye context + time + layer.

Gate:

- Tránsitos individual conserva UX base;
- Tránsitos conexión muestra capas relacionales;
- cambiar hora preserva contexto;
- preguntar al agente abre chat del contexto correcto;
- E2E de tránsitos contextual pasa.

## Fase 8: Assets Y Bodygraph Replacement Por Sujeto

**Objetivo:** dejar de asumir que subir un PDF reemplaza siempre la carta principal.

Tareas:

- asociar assets a subject;
- reemplazar bodygraph de subject específico;
- actualizar profile hash del subject;
- invalidar reportes y transits derivados del context correcto;
- preservar comportamiento de `Mi carta`.

Gate:

- reemplazar carta de `Cliente X` no cambia `Brian`;
- reemplazar `Mi carta` sigue funcionando como hoy;
- connections dependientes quedan stale o recalculan según contrato;
- E2E de assets por subject pasa.

## Fase 9: Limpieza Legacy

**Objetivo:** reducir deuda después de que flujos por context estén estables.

Tareas:

- convertir `/api/me/*` en wrappers o deprecarlos;
- remover dependencias frontend directas de `profile` global;
- migrar `users.intake` a subject intake;
- migrar `users.memory_md` a context memory o global memory explícita;
- actualizar `ARCHITECTURE.md`.

Gate:

- ningún flujo nuevo depende de `users.profile` como carta global;
- docs de arquitectura reflejan source of truth real;
- tests legacy ajustados o eliminados con intención.

## Rollout Recomendado

Usar feature flag si el sistema actual de flags lo permite:

```text
CONTEXT_WORKSPACE_ENABLED
```

Rollout:

1. dev/local;
2. usuarios internos/admin;
3. cohort pequeña;
4. nuevos usuarios;
5. usuarios existentes migrados;
6. default general.

## Estrategia De Commits

Máximo sugerido por fase: 1 a 3 commits.

Orden de commits por fase:

1. tests/fixtures;
2. backend/model/endpoints;
3. frontend/adapters/UI;
4. cleanup/docs.

No mezclar:

- migración DB + rediseño visual + prompt LLM en un mismo commit;
- Chat contextual + Reportes contextuales en una misma fase;
- Tránsitos relacionales antes de tener Context Shell.

## Dependencias Entre Fases

```text
Fase 0 → Fase 1
Fase 1 → Fase 2
Fase 2 → Fase 3
Fase 3 → Fase 4
Fase 4 → Fase 5/6/7
Fase 5 → memoria contextual
Fase 6 → reportes relacionales
Fase 7 → transits relacionales
Fase 8 → reemplazo correcto por sujeto
Fase 9 → cleanup
```

No saltar Fase 4. Sin Context Shell, cada superficie va a inventar su propio contexto.

## Riesgos Principales

| Riesgo | Señal temprana | Mitigación |
|---|---|---|
| Se implementa solo en Tránsitos | Chat/Informe siguen monocontexto | Bloquear specs que no pasen por Context Workspace. |
| Se rompe `Mi carta` | Usuario existente no encuentra su chat/informe | Subject primario como sombra antes de cambiar UI. |
| Memoria contaminada | Chat de conexión usa hechos personales como si fueran de un tercero | Scope de memoria por context o memoria desactivada en conexiones al inicio. |
| DB demasiado ambiciosa | Migración grande y frágil | Introducir shadow model y compat wrappers. |
| UX demasiado densa | Header lleno de controles | Biblioteca como navegación primaria, selector como cambio rápido. |
| Informes stale cruzados | Reporte de Brian aparece en Brian+AUREA | Hash por context y tests E2E. |
| Legal sobreactuado | Crear sujeto se vuelve formulario pesado | Alias + copy breve + delete fácil en V1. |

## Definition Of Done Del Programa

El programa se considera migrado cuando:

- la app abre en un workspace de contexto;
- Biblioteca lista sujetos y conexiones;
- cada superficie recibe contexto activo;
- Chat separa threads por contexto;
- Informe separa individual y relacional;
- Tránsitos soporta individual y conexión;
- assets se reemplazan por sujeto;
- E2E cubre cambio de contexto y no mezcla historiales;
- `ARCHITECTURE.md` está actualizado con la nueva source of truth;
- los docs legacy indican qué quedó reemplazado o compatibilizado.

## Próxima Acción Recomendada

Convertir este plan en specs por fase, empezando por:

1. Fase 0/1: E2E baseline + mocks de Context Workspace.
2. Fase 2: subject primario shadow model.
3. Fase 3/4: Biblioteca mínima + Context Shell.

No empezar por Tránsitos relacionales. Tránsitos debe llegar después de que exista el contexto global.
