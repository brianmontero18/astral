# Context Workspace UX

**Fecha:** 2026-05-10
**Estado:** wireframes UX/UI v0 para validar alcance
**Capa:** experiencia de usuario, pantallas y flujos
**Leer antes:** [bodygraph-relacional.md](./bodygraph-relacional.md)
**Leer después:** [context-workspace-architecture.md](./context-workspace-architecture.md), [context-workspace-e2e-plan.md](./context-workspace-e2e-plan.md), [context-workspace-migration-plan.md](./context-workspace-migration-plan.md)

Este documento describe cómo se vería Astral si evoluciona desde una app de una sola carta hacia una app basada en contexto activo. No define DB, endpoints ni implementación. Su objetivo es alinear UX antes de escribir contratos técnicos.

## Tesis UX

La app debe sentirse así:

```text
Primero elijo SOBRE QUÉ estoy trabajando.
Después elijo QUÉ quiero hacer con eso.
```

No así:

```text
Primero entro a Chat/Informe/Tránsitos.
Después cada sección me pregunta otra vez de quién hablamos.
```

La unidad de navegación deja de ser solamente la pestaña. La unidad principal pasa a ser el **workspace de contexto**:

```text
Contexto activo
  ├─ Chat
  ├─ Informe
  ├─ Tránsitos
  └─ Carta / Dinámica
```

Un contexto activo puede ser:

- sujeto individual: `Brian`, `Cliente X`, `AUREA`;
- conexión: `Brian + AUREA`, `Cliente X + Pareja`.

## Arquitectura De Pantalla

```text
Astral
  ├─ Biblioteca
  │    ├─ Sujetos
  │    └─ Conexiones
  └─ Workspace activo
       ├─ Header de contexto
       ├─ Superficie activa
       └─ Acciones del contexto
```

## Shell Principal

### Contexto Individual

```text
┌─────────────────────────────────────────────┐
│ ✦ Astral Guide                              │
│ Contexto: [ Brian · Mi carta           ▼ ]  │
├─────────────────────────────────────────────┤
│ [ Chat ] [ Informe ] [ Tránsitos ] [ Carta ]│
└─────────────────────────────────────────────┘
```

### Contexto Conexión

```text
┌─────────────────────────────────────────────┐
│ ✦ Astral Guide                              │
│ Contexto: [ Brian + AUREA · Conexión   ▼ ]  │
├─────────────────────────────────────────────┤
│ [ Chat ] [ Informe ] [ Tránsitos ] [ Dinámica ]│
└─────────────────────────────────────────────┘
```

Principio:

- las tabs no eligen el objeto;
- las tabs trabajan sobre el objeto activo;
- cambiar contexto cambia el contenido de todas las tabs.

## Entrada Default

Después del onboarding, la app abre el workspace de `Mi carta`.

```text
┌─────────────────────────────────────────────┐
│ Brian · Mi carta                            │
│ Generador · Sacral · Perfil 6/2             │
├─────────────────────────────────────────────┤
│ Hoy                                         │
│ - Tránsito principal                        │
│ - Última conversación                       │
│ - Informe disponible                        │
├─────────────────────────────────────────────┤
│ Acciones rápidas                            │
│ [ Chatear ] [ Ver informe ] [ Tránsitos ]   │
│ [ Crear conexión ]                          │
└─────────────────────────────────────────────┘
```

La home no debería ser una landing explicativa. Debe ser el workspace activo.

## Biblioteca

La biblioteca reemplaza conceptualmente a `Mis Cartas`. No es solo una lista de archivos. Es el lugar donde el usuario organiza sujetos y conexiones.

```text
┌─────────────────────────────────────────────┐
│ Biblioteca                                  │
│ [ Sujetos ] [ Conexiones ]                  │
├─────────────────────────────────────────────┤
│ Sujetos                                     │
│ ★ Brian · Mi carta                          │
│   Cliente X · Cliente                       │
│   AUREA · Negocio                           │
│   Pareja Cliente X · Persona                │
│                                             │
│ [ + Cargar carta ] [ + Crear entidad ]      │
├─────────────────────────────────────────────┤
│ Conexiones recientes                        │
│ Brian + AUREA                               │
│ Cliente X + Pareja                          │
│ Cliente X + Negocio                         │
│                                             │
│ [ + Crear conexión ]                        │
└─────────────────────────────────────────────┘
```

Reglas:

- `Mi carta` aparece marcada como principal;
- sujetos y conexiones no se mezclan sin etiqueta;
- no mostrar birth data crudo en esta lista;
- usar alias como nombre visible;
- abrir un item lleva a su workspace.

## Selector De Contexto

El selector de contexto puede existir en el header, pero no debe ser la única forma de navegar. Funciona como cambio rápido.

```text
┌ Cambiar contexto ───────────────────────────┐
│ Buscar carta, persona o conexión            │
│ [_______________________________________]   │
├─────────────────────────────────────────────┤
│ Sujetos                                     │
│ ✓ Brian · Mi carta                          │
│   Cliente X · Cliente                       │
│   AUREA · Negocio                           │
├─────────────────────────────────────────────┤
│ Conexiones                                  │
│   Brian + AUREA                             │
│   Cliente X + Pareja                        │
├─────────────────────────────────────────────┤
│ + Crear sujeto                              │
│ + Crear conexión                            │
│ Ir a Biblioteca                             │
└─────────────────────────────────────────────┘
```

## Crear Sujeto

```text
┌─────────────────────────────────────────────┐
│ Cargar nueva carta                          │
├─────────────────────────────────────────────┤
│ ¿Qué estás cargando?                        │
│ [ Mi carta ] [ Cliente ] [ Pareja/Familia ] │
│ [ Negocio ] [ Animal ] [ Otro ]             │
├─────────────────────────────────────────────┤
│ Nombre o alias                              │
│ [ Cliente X                              ]  │
│                                             │
│ Archivo bodygraph                           │
│ [ Subir PDF ]                               │
│                                             │
│ Si cargás una carta de otra persona, usá    │
│ alias si corresponde. Cargá datos que tengas│
│ permiso de usar. Todo queda privado.        │
│                                             │
│ [ Guardar carta ]                           │
└─────────────────────────────────────────────┘
```

Decisiones UX:

- pedir nombre/alias antes del archivo;
- no exigir email ni DNI de terceros;
- permitir `Negocio` y `Otro` desde V1;
- si se sube sobre `Mi carta`, tratarlo como reemplazo del sujeto principal.

## Crear Conexión

```text
┌─────────────────────────────────────────────┐
│ Crear conexión                              │
├─────────────────────────────────────────────┤
│ Carta A                                     │
│ [ Brian                                ▼ ]  │
│ Carta B                                     │
│ [ AUREA                                ▼ ]  │
│                                             │
│ Tipo de vínculo                             │
│ [ Negocio / Cliente / Pareja / Familia ▼ ]  │
│                                             │
│ Nombre                                      │
│ [ Brian + AUREA                         ]   │
│                                             │
│ [ Cancelar ]          [ Crear y abrir ]     │
└─────────────────────────────────────────────┘
```

Decisiones UX:

- crear conexión abre workspace, no chat automáticamente;
- el nombre se puede autogenerar pero debe ser editable;
- permitir conectar dos terceros;
- el happy path inicial es `Mi carta + otra entidad`.

## Workspace Individual

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian · Mi carta             ▼    │
│ [ Chat ] [ Informe ] [ Tránsitos ] [ Carta ]│
├─────────────────────────────────────────────┤
│ Brian                                       │
│ Generador · Sacral · Perfil 6/2             │
│ Última actualización: 10 mayo 2026          │
├─────────────────────────────────────────────┤
│ Acciones                                    │
│ [ Chatear ] [ Generar informe ]             │
│ [ Ver tránsitos ] [ Editar carta ]          │
└─────────────────────────────────────────────┘
```

## Workspace Conexión

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian + AUREA · Conexión     ▼    │
│ [ Chat ] [ Informe ] [ Tránsitos ] [ Dinámica ]│
├─────────────────────────────────────────────┤
│ Brian + AUREA                               │
│ Tipo: Negocio                               │
│ A: Brian · Generador Sacral                 │
│ B: AUREA · Negocio                          │
├─────────────────────────────────────────────┤
│ Acciones                                    │
│ [ Chatear sobre la conexión ]               │
│ [ Generar informe relacional ]              │
│ [ Ver tránsitos de la conexión ]            │
└─────────────────────────────────────────────┘
```

## Chat Individual

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian · Mi carta             ▼    │
│ [ Chat ] [ Informe ] [ Tránsitos ] [ Carta ]│
├─────────────────────────────────────────────┤
│ Chat sobre Brian                            │
│ Usa: bodygraph + intake + memoria de Brian  │
├─────────────────────────────────────────────┤
│ Mensajes...                                 │
├─────────────────────────────────────────────┤
│ [ ¿Qué tránsitos me afectan hoy? ]          │
│ [ ¿Cómo sostengo mi energía esta semana? ]  │
│                                             │
│ Escribí tu pregunta...                      │
└─────────────────────────────────────────────┘
```

## Chat De Conexión

```text
┌─────────────────────────────────────────────┐
│ Contexto: Cliente X + Pareja           ▼    │
│ [ Chat ] [ Informe ] [ Tránsitos ] [ Dinámica ]│
├─────────────────────────────────────────────┤
│ Chat sobre esta conexión                    │
│ Usa: carta A + carta B + dinámica           │
│ No usa memoria personal como si fuera de A/B│
├─────────────────────────────────────────────┤
│ Mensajes...                                 │
├─────────────────────────────────────────────┤
│ [ ¿Qué activa Cliente X en su pareja? ]     │
│ [ ¿Dónde se condicionan mutuamente? ]       │
│ [ ¿Qué mirar con el tránsito de hoy? ]      │
│                                             │
│ Escribí tu pregunta...                      │
└─────────────────────────────────────────────┘
```

Regla crítica: si el usuario cambia de `Brian` a `Cliente X + Pareja`, el historial visible y el prompt deben cambiar. No se comparte monothread.

## Informe Individual

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian · Mi carta             ▼    │
│ Informe personal                            │
├─────────────────────────────────────────────┤
│ Tu diseño                                   │
│ Energía & cuerpo                            │
│ Trabajo & creatividad                       │
│ Comunicación & marca                        │
│ Tránsitos de la semana                      │
├─────────────────────────────────────────────┤
│ [ Editar contexto ] [ Regenerar informe ]   │
└─────────────────────────────────────────────┘
```

## Informe Relacional

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian + AUREA                ▼    │
│ Informe de conexión                         │
├─────────────────────────────────────────────┤
│ Resumen de la dinámica                      │
│ Qué aporta Brian                            │
│ Qué aporta AUREA                            │
│ Qué se activa entre ambos                   │
│ Centros y canales del vínculo               │
│ Fricciones a observar                       │
│ Preguntas prácticas                         │
├─────────────────────────────────────────────┤
│ [ Generar informe relacional ]              │
└─────────────────────────────────────────────┘
```

El informe relacional no debe ser dos informes individuales pegados. Tiene que explicar interacción.

## Tránsitos Individual

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian · Mi carta             ▼    │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ LO PRINCIPAL AHORA                          │
│ Cómo el tránsito toca tu carta              │
├─────────────────────────────────────────────┤
│ Cómo te toca                                │
│ Centros                                     │
│ Slider del día                              │
│ Detalle planetario                          │
└─────────────────────────────────────────────┘
```

## Tránsitos De Conexión

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian + AUREA                ▼    │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ LO PRINCIPAL DE LA CONEXIÓN                 │
│ Qué activa el tránsito en esta dinámica     │
├─────────────────────────────────────────────┤
│ [ Resumen ] [ En Brian ] [ En AUREA ]       │
│ [ Dinámica ]                                │
├─────────────────────────────────────────────┤
│ Activación compartida                       │
│ Completitud relacional                      │
│ Fricción a observar                         │
│ Slider del día                              │
│ Centros de la conexión                      │
└─────────────────────────────────────────────┘
```

Ver detalles en [transits-relational-ux.md](./transits-relational-ux.md).

## Carta Individual

```text
┌─────────────────────────────────────────────┐
│ Brian · Mi carta                            │
├─────────────────────────────────────────────┤
│ Bodygraph                                   │
│ Tipo · Autoridad · Perfil · Canales         │
│ Centros definidos / indefinidos             │
│ Intake / contexto personal                  │
│ Archivos fuente                             │
└─────────────────────────────────────────────┘
```

## Dinámica De Conexión

```text
┌─────────────────────────────────────────────┐
│ Brian + AUREA · Dinámica                    │
├─────────────────────────────────────────────┤
│ Carta A: Brian                              │
│ Carta B: AUREA                              │
├─────────────────────────────────────────────┤
│ Qué define A                                │
│ Qué define B                                │
│ Qué activa A en B                           │
│ Qué activa B en A                           │
│ Canales completados                         │
│ Centros amplificados / condicionados        │
└─────────────────────────────────────────────┘
```

## Cartas Temporales

Las cartas temporales son útiles para exploración rápida, pero no deberían contaminar memoria ni generar artefactos persistentes sin confirmación.

```text
┌─────────────────────────────────────────────┐
│ Carta temporal                              │
├─────────────────────────────────────────────┤
│ Podés explorar esta carta sin guardarla.    │
│ Para chatear, generar informe o volver      │
│ después, guardala con un nombre o alias.    │
├─────────────────────────────────────────────┤
│ [ Explorar ahora ] [ Guardar carta ]        │
└─────────────────────────────────────────────┘
```

## Flujo Coach

```text
Biblioteca
  → + Cargar carta
  → Tipo: Cliente
  → Cliente X

Biblioteca
  → + Cargar carta
  → Tipo: Pareja/Familia
  → Pareja Cliente X

Crear conexión
  → Cliente X + Pareja Cliente X
  → Tipo: Pareja
  → Abrir workspace

Workspace Cliente X + Pareja
  → Chat / Informe / Tránsitos / Dinámica
```

## Mobile

En mobile, el contexto activo debe ocupar un lugar visible pero compacto:

```text
┌───────────────────────┐
│ Astral Guide          │
│ [Brian + AUREA     ▼] │
│ Chat Informe Tránsitos│
├───────────────────────┤
│ Contenido de tab      │
└───────────────────────┘
```

Reglas:

- evitar un selector enorme arriba de cada pantalla;
- mostrar contexto como botón full-width o pill prominente;
- tabs horizontales compactas;
- CTA principal al final o sticky si la pantalla es conversacional;
- no mostrar birth data crudo en header mobile.

## Alcance UX V1

Incluido:

- biblioteca mínima con sujetos y conexiones;
- workspace de sujeto individual;
- workspace de conexión A+B;
- header de contexto activo;
- Chat, Informe, Tránsitos y Carta/Dinámica como superficies;
- crear sujeto;
- crear conexión;
- atajos desde superficies hacia biblioteca;
- alias y copy liviana de responsabilidad;
- mantener `Mi carta` como default.

Fuera de alcance:

- penta/equipos/grupos;
- sharing público;
- colaboración multiusuario;
- CRM de coaches;
- consentimiento verificable;
- reportes white-label;
- ranking de compatibilidad;
- bodygraph visual compuesto obligatorio;
- billing final.

## Criterios De Validación UX

- Una usuaria nueva entiende que `Mi carta` sigue existiendo y no fue reemplazada.
- Una usuaria puede crear `Cliente X` sin usar datos reales visibles.
- Una usuaria puede crear `Brian + AUREA` y entiende que abrió una conexión, no otro archivo.
- En Chat se ve claramente si está hablando de `Brian` o de `Brian + AUREA`.
- En Informe se distingue individual vs relacional.
- En Tránsitos se distingue carta individual vs conexión.
- Cambiar de contexto no requiere aprender una lógica distinta en cada tab.
