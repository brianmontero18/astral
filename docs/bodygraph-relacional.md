# Bodygraph Relacional

**Fecha:** 2026-05-10
**Estado:** hipótesis producto v2, dirección recomendada para discovery
**Documentos conectados:** [competencia.md](./competencia.md), [context-workspace-ux.md](./context-workspace-ux.md), [context-workspace-architecture.md](./context-workspace-architecture.md), [context-workspace-e2e-plan.md](./context-workspace-e2e-plan.md), [context-workspace-migration-plan.md](./context-workspace-migration-plan.md)

Este documento captura la intención de producto para pasar de un modelo centrado en una sola carta a un modelo relacional de bodygraphs. No define implementación. La intención es que otro agente pueda retomar el discovery, entender la abstracción y luego bajar a UX, arquitectura, E2E o migración sin reconstruir el hilo.

## Decisión V2: Context Workspace

El hallazgo principal del sparring es que "tránsitos relacionales" no puede resolverse como selector local dentro de Tránsitos. La necesidad real atraviesa toda la app.

El modelo actual es:

```text
Usuario principal
  ├─ bodygraph activo
  ├─ intake
  ├─ chat
  ├─ informe
  ├─ tránsitos
  └─ archivos
```

El modelo objetivo es:

```text
Cuenta / workspace
  ├─ sujetos individuales
  │    ├─ mi carta
  │    ├─ cliente
  │    ├─ negocio
  │    ├─ pareja / familiar / socio
  │    └─ entidad simbólica
  ├─ conexiones A+B
  │    ├─ persona + persona
  │    ├─ persona + negocio
  │    ├─ cliente + pareja
  │    └─ cliente + negocio
  └─ superficies por contexto
       ├─ chat
       ├─ informe
       ├─ tránsitos
       └─ carta / dinámica
```

La pregunta madre de UX pasa a ser:

> Primero elijo sobre qué estoy trabajando. Después elijo qué quiero hacer con eso.

No:

> Primero entro a Chat, Informe o Tránsitos y cada sección me vuelve a preguntar de quién hablamos.

## Problema

Astral hoy está pensado alrededor de una carta principal del usuario. La nueva demanda no es simplemente "cargar otra carta". Los usuarios quieren analizar cómo se relacionan dos bodygraphs en distintos contextos:

- una persona con su negocio;
- una persona con un cliente;
- una coach analizando cliente + pareja del cliente;
- una persona con pareja, madre, hermano, socio o colaborador;
- dos clientes entre sí;
- un negocio como entidad;
- una pareja como entidad;
- un animal u otra entidad simbólica.

El pedido real parece ser: **entender qué pasa cuando un bodygraph interactúa con otro bodygraph**.

## Corrección De Enfoque

No conviene encuadrar la feature como "compatibilidad amorosa". Eso reduce demasiado el caso de uso y arrastra patrones incorrectos como ranking, match score o predicción vincular.

El framing correcto para Astral debería ser:

> Análisis relacional de bodygraphs: qué activa uno en otro, qué se completa, qué se condiciona, qué se potencia, qué fricciones aparecen y cómo cambia la lectura según el contexto.

La palabra "compatibilidad" puede existir como keyword de mercado, pero no debería ser el centro conceptual del producto.

## Hipótesis V1

Astral debería evolucionar hacia un modelo de **workspace contextual** donde el usuario organiza sujetos, bodygraphs y conexiones.

La unidad de valor ya no sería solo "mi informe" o "mi chat", sino:

- guardar bodygraphs relevantes;
- crear conexiones entre ellos;
- conversar dentro de un contexto específico;
- generar informes individuales o relacionales;
- preservar memoria sin contaminar contextos.

## Modelo Mental

| Concepto | Descripción producto |
|---|---|
| Cuenta | La identidad autenticada que paga, guarda datos y administra su espacio privado. |
| Workspace | El espacio privado del usuario donde vive su universo de cartas, personas, entidades, conexiones, chats e informes. |
| Persona / Sujeto | Cualquier entidad nombrable con una carta/bodygraph: el usuario, un cliente, una pareja, una madre, un socio, una celebridad, un negocio, una mascota o una entidad simbólica. |
| Mi carta | El sujeto principal del usuario. Sigue siendo el punto de entrada default. |
| Bodygraph | La representación de Diseño Humano asociada a un sujeto. Puede venir de PDF, carga manual o cálculo futuro. |
| Conexión | Objeto relacional guardado que combina dos sujetos para analizar interacción. Internamente puede seguir llamándose "cruce". |
| Contexto activo | El objeto sobre el que trabaja la app en este momento. Puede ser un sujeto individual o una conexión A+B. |
| Superficie | Una experiencia que se renderiza sobre un contexto activo: Chat, Informe, Tránsitos, Carta o Dinámica. |
| Thread | Conversación asociada a un contexto activo. No debería mezclarse entre sujetos o conexiones. |
| Informe | Artefacto generado desde un sujeto individual o desde una conexión. |
| Intake | Contexto narrativo asociado a un sujeto o, eventualmente, a una conexión. No todo sujeto necesita el mismo intake. |
| Memoria | Aprendizaje persistente, pero scopiado al contexto correcto para evitar mezclar hechos de distintas personas o conexiones. |

## Principios De Producto

1. **Contexto antes que superficie.** La app debe resolver "sobre qué estamos trabajando" antes de abrir Chat, Informe o Tránsitos.
2. **Mi carta sigue siendo default.** La experiencia actual no se reemplaza de golpe; se convierte en el primer sujeto del workspace.
3. **Conexión es objeto persistente.** No es un cálculo temporal A+B ni dos informes pegados.
4. **Chat por contexto.** El monothread actual no escala. Cada sujeto/conexión necesita conversación propia.
5. **Informe por contexto.** Informe individual e informe relacional son productos distintos.
6. **Tránsitos por contexto.** El tránsito colectivo es uno, pero se interpreta contra un sujeto o contra una conexión.
7. **Biblioteca primero.** `Mis Cartas` debe evolucionar de archivo/PDF a biblioteca de sujetos y conexiones.
8. **Alias desde el inicio.** El producto no debe exigir identidad real para terceros si el caso de uso funciona con alias.
9. **No birth data en superficies innecesarias.** La UI debe mostrar nombres/alias y lectura, no datos crudos de nacimiento salvo donde haga falta.
10. **V1 de dos bodygraphs.** Penta, equipos y grupos quedan fuera de esta primera hipótesis.

## Dirección Recomendada Hoy

Avanzar hacia un **Context Workspace**, empezando por una versión conservadora, pero no paralizada por el tema legal:

1. Mantener "mi carta" como punto de entrada.
2. Agregar una biblioteca privada de sujetos/bodygraphs y conexiones.
3. Permitir alias y entidades no-personales desde el inicio.
4. Crear conexiones guardables entre dos bodygraphs.
5. Ofrecer lectura relacional básica: activaciones, completions, condicionamientos, centros, canales y dinámica de contexto.
6. Separar chats por contexto: sujeto individual o conexión.
7. Separar informes por contexto: informe individual o informe relacional.
8. Evitar scores, rankings o claims deterministas.
9. Mantener privacy-by-default y copy liviana de responsabilidad al cargar terceros.

La experiencia objetivo:

```text
Biblioteca
  → seleccionar o crear sujeto/conexión
  → abrir workspace de contexto
  → usar Chat / Informe / Tránsitos / Carta-Dinámica sobre ese contexto
```

## Veredictos Del Sparring

| Pregunta | Veredicto actual |
|---|---|
| ¿Cruce, Conexión, Comparación o Dinámica? | Usar `Conexión` de cara al usuario. Mantener `Cruce` como término interno de discovery. Usar `Comparar` como verbo/CTA. |
| ¿El selector de contexto vive solo en Tránsitos? | No. Debe ser patrón de workspace. Tránsitos consume contexto, no lo inventa. |
| ¿Crear conexión desde Tránsitos alcanza? | No. Debe existir biblioteca mínima. Tránsitos puede ofrecer un atajo. |
| ¿Primer caso de uso a optimizar? | Mi carta + otra entidad. Tercero + tercero debe existir, pero no ser happy path inicial. |
| ¿`Dinámica` como tab o sección? | El resumen debe ser relacional por default. Luego capas: A, B, Dinámica. |
| ¿Chat automático al crear conexión? | No. Crear conexión abre workspace. El thread se crea al entrar al Chat o enviar primer mensaje. |
| ¿Cartas temporales? | Temporales por default. Para chat, informe o volver luego, pedir guardar/nombar. |
| ¿Copy legal mínima? | "Usá alias si corresponde. Cargá datos que tengas permiso de usar. Todo queda privado y podés borrarlo cuando quieras." |

## Producto Que Habría Que Cambiar

### Navegación

La navegación actual no debería seguir siendo solamente:

```text
Chat | Informe | Tránsitos | Mis Cartas
```

Ese patrón funciona cuando hay una sola carta. En un modelo relacional, fuerza a cada sección a resolver contexto por separado.

La sección actual de "mi carta" debería evolucionar hacia una biblioteca de sujetos y conexiones. El usuario tiene que poder ver:

- mi carta principal;
- sujetos guardados;
- conexiones recientes;
- informes generados;
- chats por contexto.

El patrón objetivo:

```text
Biblioteca
  ├─ Sujetos
  └─ Conexiones

Workspace activo
  ├─ Chat
  ├─ Informe
  ├─ Tránsitos
  └─ Carta / Dinámica
```

### Carga

El flujo de carga debería preguntar primero qué se está cargando:

- mi carta;
- otra persona;
- cliente;
- pareja/familia/amigo;
- negocio;
- animal;
- entidad simbólica;
- carta temporal.

No todos requieren el mismo tono ni el mismo nivel de datos. Un cliente real y un negocio simbólico no deberían sentirse iguales.

### Conexiones

El producto debería permitir:

- elegir sujeto A y sujeto B;
- definir el contexto de la conexión;
- guardar la conexión con nombre propio;
- reabrirla después;
- generar un informe;
- abrir un chat específico de la conexión;
- leer tránsitos sobre esa conexión.

El valor no debería ser "son compatibles", sino:

- qué define cada uno;
- qué le activa A a B;
- qué le activa B a A;
- qué canales se completan;
- qué centros se condicionan;
- qué se amplifica;
- dónde puede haber confusión;
- qué preguntas prácticas conviene observar en ese contexto.

### Chat

El monothread actual no alcanza para esta dirección. El usuario necesita conversaciones separadas porque cada pregunta vive en un contexto diferente:

- chat sobre mi diseño;
- chat sobre mi negocio;
- chat sobre cliente X;
- chat sobre cliente X + pareja;
- chat sobre mi relación con socio Y;
- chat sobre un equipo o penta futuro.

La experiencia debe dejar siempre claro "sobre qué estamos hablando". Si eso no está claro, el chat va a mezclar personas, consejos y memoria.

El thread no debería crearse automáticamente al crear una conexión. La conexión abre un workspace. El thread se crea cuando el usuario entra al Chat o manda el primer mensaje.

### Informes

Los informes deberían dividirse conceptualmente en:

- informe individual;
- informe relacional de dos bodygraphs;
- informe de negocio/persona;
- informe cliente/coach;
- informe familiar/pareja/equipo en una etapa posterior.

El informe relacional no debería ser solo dos informes individuales pegados. Tiene que explicar la interacción.

### Tránsitos

El ADR de tránsitos de hoy sigue vigente para un sujeto individual. La extensión relacional debe vivir dentro del workspace contextual:

- contexto sujeto: tránsito contra una carta;
- contexto conexión: tránsito interpretado en A, en B y en la dinámica A+B.

Ver [transits-relational-ux.md](./transits-relational-ux.md) para la pantalla específica.

### Privacidad

La hipótesis actual no es "bloquear todo hasta tener consentimiento verificable". El mercado no parece operar así. La hipótesis prudente es:

- private by default;
- alias permitidos;
- no exponer datos de nacimiento exactos innecesariamente;
- borrar sujeto/bodygraph/conexión fácilmente;
- copy de responsabilidad al crear terceros;
- revisión legal antes de compartir/exportar o vender workspace para coaches.

## Riesgos

| Riesgo | Por qué importa | Mitigación producto |
|---|---|---|
| Abstracción demasiado amplia | Persona, negocio, animal, cliente y pareja pueden volver la UI confusa. | Empezar con pocos tipos y permitir "otro". |
| Selector global confuso | Un dropdown universal puede sentirse técnico y frágil. | Biblioteca + workspace, no selector global flotante como única navegación. |
| Contaminación de chats | El asistente puede mezclar datos de distintas personas. | Thread explícito por contexto. |
| Memoria contaminada | Aprender facts de terceros como si fueran del usuario rompe confianza. | Memoria por contexto o separación fuerte de scopes. |
| Promesas deterministas | "Compatibilidad" puede sonar a destino o juicio. | Lenguaje de dinámica, activación, fricción, complementariedad y observación. |
| Pricing débil | Si se cobra solo por cantidad de cartas, competidores baratos/gratis presionan. | Cobrar profundidad, informes, IA contextual, histórico y workflows pro. |
| Legal gris | Birth data/bodygraph/alias pueden caer en zonas distintas según jurisdicción y uso. | Documentar fuentes, minimizar datos, privacidad por defecto y revisión legal real antes de escalar. |
| Usuarios coaches | Las coaches cargan clientes como parte natural de su trabajo, pero eso cambia responsabilidades. | Separar modo personal de modo coach antes de venderlo como SaaS profesional. |

## Hipótesis De Pricing

Todavía no hay propuesta cerrada. Lo que sugiere el mercado:

- Free: mi carta + prueba limitada de biblioteca/conexiones.
- Paid personal: más sujetos, más conexiones, informes relacionales y chats por contexto.
- Paid pro/coach: clientes, notas, exportables, reportes white-label o compartibles, histórico y workflows de consentimiento/copy.

No conviene cobrar demasiado pronto por "guardar otra carta"; varios competidores dan charts ilimitadas o muy baratas. El diferencial de Astral debería ser síntesis, contexto, memoria, reportes y experiencia en español.

## Preguntas Todavía Abiertas

1. ¿Cuántos sujetos/conexiones gratis alcanzan para que el usuario entienda el valor sin commoditizar la feature?
2. ¿El primer informe relacional pago debe ser persona+persona, persona+negocio o coach+cliente?
3. ¿Qué campos de intake necesita una conexión sin convertirla en formulario pesado?
4. ¿Qué pasa con el sujeto principal si el usuario reemplaza su bodygraph dentro del nuevo modelo?
5. ¿Qué derecho práctico tendrá un tercero si pide borrar una carta cargada por otro usuario?
6. ¿Cuándo conviene introducir modo coach como producto separado?

## Experimentos Sugeridos

1. Prototipo no técnico con 5 usuarias: abrir biblioteca, seleccionar sujeto, crear conexión y entrar a workspace.
2. Test de lenguaje: `Conexión` vs `Dinámica` vs `Comparación`.
3. Mock de informe relacional: activaciones, centros, canales, fricciones y preguntas prácticas.
4. Test de carga: persona real vs alias vs negocio vs cliente.
5. Test de willingness-to-pay: pagar por cantidad de cartas vs pagar por informe relacional profundo.

## Decisión Temporal

La dirección recomendada al 2026-05-10 es avanzar conceptualmente hacia **Context Workspace**, empezando por:

1. biblioteca privada de sujetos;
2. conexiones guardables entre dos sujetos;
3. workspace activo con superficies comunes;
4. chat, informes y tránsitos scopiados al contexto.

No cerrar aún:

- nombre final de la feature;
- pricing;
- profundidad legal;
- modo coach;
- sharing/export;
- modelo técnico.

El próximo paso no es escribir código. El próximo paso es usar los documentos conectados para cerrar UX, contratos, E2E-first y plan de migración.
