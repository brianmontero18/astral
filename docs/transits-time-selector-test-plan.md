# Tránsitos v2 — Plan de tests

Estado: Propuesto  
Fecha: 2026-05-09  
Documento padre: `docs/transits-time-selector-adr.md`  
Plan técnico: `docs/transits-time-selector-technical-plan.md`

## Objetivo

Extender la cobertura sin romper el flujo actual. Los tests deben probar
comportamiento observable y contratos, no detalles internos de UI.

## Reglas de testing

- No instalar dependencias.
- Reusar fixtures/mocks existentes cuando alcancen.
- Evitar objetos gigantes repetidos: crear factories para `TransitExperience`.
- E2E verifica la experiencia del usuario y requests relevantes.
- Backend verifica contrato, cache y semántica HD.
- Frontend unit/integration verifica adapter + componentes presentacionales.

## Backend tests

Agregar o extender `backend/src/__tests__/api-transits.test.ts`.

Casos requeridos:

1. `GET /api/transits` legacy sigue devolviendo el shape actual.
2. `GET /api/transits/experience?mode=today&clientNow=...` devuelve
   `version="transits.v2"`, `mode="today"` y `selectedAt` igual al timestamp
   pedido.
3. `includeTimeline=true` devuelve 24 snapshots horarios del día local más la
   foto seleccionada.
4. Dos requests del mismo día/hora reutilizan cache colectivo v2.
5. Cambiar `users.profile` cambia `personal` sin recalcular/cachear colectivo.
6. Usuario pending/no autenticado recibe `collective` pero no `personal`.
7. `activatedCenters` no se mezcla con `temporarilyDefinedCenters`.
8. `temporarilyDefinedCenters` aparece solo cuando hay canal completo.
9. `mode=next7Days` devuelve `range.step="panorama"` en MVP.
10. `timeZone` inválido devuelve `400 invalid_time_zone`.
11. `clientNow` inválido devuelve `400 invalid_time`.
12. `POST /api/chat/stream` sin `transitContext` usa tránsito actual.
13. `POST /api/chat/stream` con `transitContext.targetAt` usa esa hora.

## Frontend tests

Crear tests del adapter antes de tests visuales.

Casos requeridos para `TransitExperienceAdapter`:

1. Convierte `TransitExperienceResponse` en `TransitScreenModel`.
2. Ordena la pantalla como: insight principal, impacto personal, timeline,
   centros, detalle planetario.
3. Si falta `personal`, genera modelo colectivo sin secciones personales.
4. Agrupa centros en tres buckets: temporalmente definidos, condicionados,
   activados.
5. No llama "definido" a centros que solo vienen de puertas aisladas.
6. Para `mode=today`, genera labels `Ahora` y `A las HH:00`.
7. Para `mode=next7Days`, usa label visible `Próximos 7 días`.
8. Genera payload `askAgent` con `targetAt`, `snapshotId` y `timeZone`.

Casos requeridos para componentes:

1. Renderiza `TransitScreenModel` sin conocer `UserProfile`.
2. Click en `Próximos 7 días` emite `mode.change`.
3. Mover slider emite `time.select` y no hace fetch directo.
4. Click en refresh emite `refresh`.
5. Click en CTA de agente emite `askAgent`.
6. Estado `timelineLoading` mantiene visible la lectura principal.
7. Estado de error no filtra errores técnicos crudos al usuario.

## E2E tests

Actualizar `e2e/specs/20-transits-weekly-view.spec.ts` o crear
`e2e/specs/20-transits-experience-view.spec.ts`.

### E2E 1 — Default Hoy/Ahora

Setup:

- Mock de `/api/transits/experience?mode=today`.
- Usuario linked + onboarding complete.

Verifica:

- Al entrar en `Tránsitos`, `Hoy` está seleccionado.
- Se ve `Ahora · HH:mm`.
- Se ve `LO PRINCIPAL AHORA`.
- Se ve `Cómo te toca`.
- Se ve `Centros`.
- El detalle planetario queda después de la lectura principal.

### E2E 2 — Slider horario

Setup:

- Mock de `includeTimeline=true` con snapshots `08:00`, `14:00`, `20:00`.

Verifica:

- Mover/seleccionar `14:00` cambia el header a `A las 14:00`.
- La lectura cambia a los facts de ese snapshot.
- No dispara un request nuevo por cada cambio de slider si el timeline ya está
  cargado.
- Botón `Ahora` vuelve a la foto actual.

### E2E 3 — Próximos 7 días

Setup:

- Mock de `/api/transits/experience?mode=next7Days`.

Verifica:

- Click en `Próximos 7 días` cambia la vista.
- Se ve el rango de siete días.
- Se ve `Tema de la semana` o equivalente.
- No aparece copy que prometa granularidad diaria si `range.step="panorama"`.

### E2E 4 — Chat desde slider

Setup:

- Seleccionar snapshot `14:00`.
- Interceptar `/api/chat/stream`.

Verifica:

- CTA `Preguntale al agente sobre las 14:00` navega al chat o prefilla pregunta.
- El request de chat incluye `transitContext.targetAt` de las `14:00`.
- Si el usuario pregunta directo en chat sin venir de Tránsitos, no manda
  `transitContext` y backend usa "Ahora".

### E2E 5 — Degradación colectiva

Setup:

- Mock response sin `personal`.

Verifica:

- La pantalla no rompe.
- No muestra secciones de impacto personal falsas.
- Sí muestra insight colectivo y detalle planetario.

### E2E 6 — Error y recuperación

Setup:

- Primera request a `/api/transits/experience` falla.
- Segunda request responde OK.

Verifica:

- Error user-facing genérico.
- No se muestra error técnico crudo.
- Navegar fuera y volver recupera la vista.

### E2E 7 — Mobile

Actualizar `e2e/specs/13-mobile-core-surfaces.spec.ts`.

Verifica:

- Selector, slider, centros y CTA de agente no generan overflow horizontal.
- Texto largo dentro de cards no se pisa.
- Detalle planetario expandible sigue usable.

## Fixtures E2E recomendadas

Crear helpers en `e2e/helpers/mock-api.ts`:

- `mockTransitExperienceToday(page, response?)`
- `mockTransitExperienceNext7Days(page, response?)`
- `mockTransitExperienceError(page, status?, error?)`

Crear fixtures chicas:

- `TRANSIT_EXPERIENCE_TODAY_NOW`
- `TRANSIT_EXPERIENCE_TODAY_TIMELINE`
- `TRANSIT_EXPERIENCE_NEXT7_PANORAMA`
- `TRANSIT_EXPERIENCE_COLLECTIVE_ONLY`

No repetir objetos grandes dentro de cada spec.

## Compatibilidad

Durante la migración:

- Mantener tests legacy de `/api/transits`.
- No borrar `20-transits-weekly-view` hasta que la nueva spec cubra los mismos
  riesgos de error/recovery e impacto personalizado.
- Si se renombra la spec E2E, mantener el número `20` para conservar orden mental
  del suite.

## Smoke manual mínimo

Después de pasar tests:

1. Entrar a Tránsitos.
2. Ver `Hoy/Ahora`.
3. Mover slider a otra hora.
4. Volver a `Ahora`.
5. Cambiar a `Próximos 7 días`.
6. Volver a `Hoy`.
7. Preguntar al agente desde una hora seleccionada.
8. Preguntar al agente directo desde Chat.

## Done

- Backend tests verdes en compu personal.
- Frontend typecheck verde.
- E2E verde en compu personal.
- No hay cambios en datos persistidos de usuario.
- `/api/transits` legacy sigue funcionando.
