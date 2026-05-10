# Context Workspace E2E Plan

**Fecha:** 2026-05-10
**Estado:** plan E2E-first v0
**Capa:** pruebas de aceptación y contrato de migración
**Leer antes:** [bodygraph-relacional.md](./bodygraph-relacional.md), [context-workspace-ux.md](./context-workspace-ux.md), [context-workspace-architecture.md](./context-workspace-architecture.md)
**Leer después:** [context-workspace-migration-plan.md](./context-workspace-migration-plan.md)

Este documento define cómo usar E2E como primera barrera de refactor. La idea es que los tests describan la experiencia objetivo antes de mover el modelo de datos. Los agentes que implementen la migración deben leer este plan antes de tocar código.

## Principio

El refactor debe empezar por E2E porque el riesgo principal no es una función aislada. El riesgo es mezclar contextos:

- chat de una persona respondiendo sobre otra;
- informe relacional servido como informe individual;
- tránsitos usando el bodygraph equivocado;
- memoria de un sujeto contaminando una conexión;
- assets reemplazando una carta distinta a la esperada.

Los tests deben verificar comportamiento visible y requests mockeados, no detalles internos.

## Estrategia De Fases

```text
Fase A: congelar app actual
Fase B: definir E2E del nuevo modelo con mocks
Fase C: implementar backend/frontend hasta que pasen
Fase D: agregar E2E reales contra backend cuando el contrato exista
```

## Fase A: Baseline Actual

Antes de cambiar producto, preservar lo que ya funciona:

- onboarding crea usuario y carta principal;
- usuario entra al chat;
- chat muestra historial actual;
- informe individual se genera/lee;
- tránsitos cargan impacto del perfil activo;
- reemplazar bodygraph actualiza tránsitos/reportes según reglas existentes;
- `Mis Cartas` muestra asset activo.

Estos tests protegen regresiones mientras se introduce el subject primario.

## Fase B: Contrato UX Con Mocks

Estos tests pueden escribirse antes de que existan endpoints reales usando route mocks.

### 1. Onboarding Crea Workspace Primario

**Dado** un usuario que completa onboarding con su bodygraph.
**Cuando** entra a la app.
**Entonces** ve el workspace `Mi carta` como contexto activo.
**Y** ve tabs `Chat`, `Informe`, `Tránsitos`, `Carta`.

Verifica:

- header muestra nombre del sujeto principal;
- no aparece un selector ambiguo vacío;
- `Mi carta` sigue siendo default.

### 2. Biblioteca Muestra Sujetos Y Conexiones

**Dado** un usuario con subject primario, un cliente y una conexión.
**Cuando** abre Biblioteca.
**Entonces** ve secciones `Sujetos` y `Conexiones`.
**Y** el subject primario aparece marcado.

Verifica:

- no se muestra birth data crudo;
- sujetos y conexiones se distinguen visualmente;
- seleccionar un item abre su workspace.

### 3. Crear Sujeto Tercero

**Dado** un usuario en Biblioteca.
**Cuando** crea un sujeto tipo `Cliente` con alias `Cliente X`.
**Entonces** el sujeto aparece en la biblioteca.
**Y** puede abrir su workspace individual.

Verifica:

- alias visible;
- copy de privacidad/responsabilidad aparece en el flujo;
- no se pide email/DNI del tercero.

### 4. Crear Conexión

**Dado** sujetos `Brian` y `AUREA`.
**Cuando** el usuario crea conexión `Brian + AUREA` tipo `Negocio`.
**Entonces** se abre workspace de conexión.
**Y** las tabs visibles son `Chat`, `Informe`, `Tránsitos`, `Dinámica`.

Verifica:

- crear conexión no abre chat automáticamente;
- nombre autogenerado puede mostrarse/editable;
- conexión aparece en Biblioteca.

### 5. Chat Individual No Mezcla Contextos

**Dado** contexto activo `Brian`.
**Cuando** abre Chat.
**Entonces** carga mensajes de `Brian`.
**Y** el composer dice que pregunta sobre Brian.

Luego:

**Cuando** cambia a `Cliente X + Pareja`.
**Entonces** el historial visible cambia.
**Y** no aparecen mensajes de `Brian`.

Verifica:

- request de mensajes incluye context id;
- quick actions cambian por tipo de contexto;
- no se usa monothread visual.

### 6. Chat De Conexión Usa Prompts Relacionales

**Dado** contexto activo `Cliente X + Pareja`.
**Cuando** abre Chat.
**Entonces** ve quick actions relacionales:

- `Qué activa Cliente X en su pareja`;
- `Dónde se condicionan mutuamente`;
- `Qué mirar con el tránsito de hoy`.

Verifica:

- la UI dice `Chat sobre esta conexión`;
- el request de chat usa context id de conexión;
- no manda birth data crudo desde frontend.

### 7. Informe Individual Vs Relacional

**Dado** contexto activo `Brian`.
**Cuando** abre Informe.
**Entonces** ve `Informe personal`.

**Dado** contexto activo `Brian + AUREA`.
**Cuando** abre Informe.
**Entonces** ve `Informe de conexión`.

Verifica:

- secciones de informe relacional no son las mismas que individual;
- stale/error/loading funcionan por contexto;
- regenerar informe no afecta otro contexto.

### 8. Tránsitos Individual Vs Relacional

**Dado** contexto activo `Brian`.
**Cuando** abre Tránsitos.
**Entonces** ve `LO PRINCIPAL AHORA` y lectura individual.

**Dado** contexto activo `Brian + AUREA`.
**Cuando** abre Tránsitos.
**Entonces** ve `LO PRINCIPAL DE LA CONEXIÓN`.
**Y** ve capas `Resumen`, `En Brian`, `En AUREA`, `Dinámica`.

Verifica:

- selector temporal del ADR sigue visible;
- contexto activo aparece en header;
- CTA al agente preserva contexto y hora.

### 9. Carta Individual / Dinámica De Conexión

**Dado** contexto individual.
**Cuando** abre `Carta`.
**Entonces** ve bodygraph/datos del sujeto.

**Dado** contexto conexión.
**Cuando** abre `Dinámica`.
**Entonces** ve A, B y lectura de interacción.

Verifica:

- no se renderiza una ficha individual para una conexión;
- no se muestra birth data crudo salvo sección explícita.

### 10. Carta Temporal No Persiste Sin Confirmación

**Dado** un usuario explora una carta temporal.
**Cuando** intenta chatear o generar informe.
**Entonces** la app le pide guardar/nombar la carta.
**Y** si cancela, no queda en Biblioteca.

Verifica:

- exploración temporal existe;
- persistencia requiere acción explícita.

## Fase C: Tests De Requests

Cuando existan endpoints:

- Biblioteca llama `GET /api/contexts`;
- Chat llama `GET /api/contexts/:contextId/messages`;
- Chat stream llama `POST /api/contexts/:contextId/chat/stream`;
- Informe llama `GET/POST /api/contexts/:contextId/report`;
- Tránsitos llama `GET /api/contexts/:contextId/transits`;
- Crear sujeto llama `POST /api/subjects`;
- Crear conexión llama `POST /api/connections`.

Los tests deben assertar que el context id correcto viaja en cada request.

## Fase D: Tests Reales Contra Backend

Cuando el backend tenga modelo persistido:

1. crear usuario;
2. crear subject tercero;
3. crear connection;
4. enviar mensaje en subject;
5. enviar mensaje en connection;
6. verificar historiales separados;
7. generar reporte individual;
8. generar reporte relacional;
9. verificar que hashes/stale no se cruzan;
10. verificar tránsitos por context.

## Fixtures Recomendadas

```ts
const SUBJECT_BRIAN = {
  id: "subject-brian",
  kind: "subject",
  title: "Brian",
  badge: "Mi carta",
};

const SUBJECT_AUREA = {
  id: "subject-aurea",
  kind: "subject",
  title: "AUREA",
  badge: "Negocio",
};

const CONNECTION_BRIAN_AUREA = {
  id: "connection-brian-aurea",
  kind: "connection",
  title: "Brian + AUREA",
  badge: "Conexión · Negocio",
};
```

Los mocks deben usar nombres humanos, no IDs visibles, para validar UX.

## Criterios De Done E2E

- Los tests fallan si Chat no manda context id.
- Los tests fallan si cambiar contexto conserva historial equivocado.
- Los tests fallan si Informe de conexión muestra copy de informe personal.
- Los tests fallan si Tránsitos de conexión no muestra capas relacionales.
- Los tests fallan si Biblioteca expone birth data crudo en listas/header.
- Los tests fallan si crear conexión abre chat automáticamente.

## Riesgos De Testing

| Riesgo | Mitigación |
|---|---|
| Tests demasiado acoplados al texto final | Assertar labels estructurales y CTAs principales, no cada párrafo. |
| Mocks inventan un contrato que backend no puede cumplir | Mantener este plan sincronizado con architecture doc. |
| Se testea solo happy path | Agregar cambio de contexto y separación de historial como casos obligatorios. |
| E2E lento por LLM/extracción | Mockear LLM y extracción; backend real solo para persistencia cuando aplique. |
| Legacy `/api/me` convive con contexto | Tests deben permitir wrappers legacy solo si la UI ya manda contexto en flujos nuevos. |

## Orden Recomendado Para Implementar Tests

1. Baseline actual de onboarding/chat/report/transits si no existe cobertura suficiente.
2. Biblioteca con mocks.
3. Crear sujeto con mocks.
4. Crear conexión con mocks.
5. Context shell cambia superficies.
6. Chat separado por contexto.
7. Informe individual vs relacional.
8. Tránsitos individual vs relacional.
9. Backend persistence E2E.
