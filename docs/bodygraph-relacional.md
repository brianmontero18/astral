# Bodygraph Relacional

**Fecha:** 2026-05-09  
**Estado:** hipótesis producto v1, no decisión final  
**Documento conectado:** [competencia.md](./competencia.md)

Este documento captura una primera teoría de producto para pasar de un modelo centrado en una sola carta a un modelo relacional de bodygraphs. No define arquitectura técnica, tablas, endpoints ni implementación. La intención es que otro agente pueda retomar el discovery, contrastarlo con menos sesgo y convertirlo luego en spec.

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

Astral debería evolucionar hacia un modelo de **workspace relacional** donde el usuario organiza personas, entidades y cruces.

La unidad de valor ya no sería solo "mi informe" o "mi chat", sino:

- guardar bodygraphs relevantes;
- crear cruces entre ellos;
- conversar dentro de un contexto específico;
- generar informes individuales o relacionales;
- preservar memoria sin contaminar contextos.

## Modelo Mental

| Concepto | Descripción producto |
|---|---|
| Workspace | El espacio privado del usuario donde vive su universo de cartas, personas, entidades, cruces, chats e informes. |
| Persona / Sujeto | Cualquier entidad nombrable: el usuario, un cliente, una pareja, una madre, un socio, una celebridad, un negocio, una mascota o una entidad simbólica. |
| Bodygraph | La representación de Diseño Humano asociada a un sujeto. Puede venir de PDF, carga manual o cálculo futuro. |
| Contexto | El motivo por el cual se analiza un sujeto o cruce: negocio, mentoría, vínculo, cliente, familia, equipo, animal, experimento personal. |
| Cruce | La combinación guardada de dos o más bodygraphs para analizar interacción. |
| Thread | Conversación asociada a un sujeto o cruce específico. |
| Informe | Artefacto generado desde un sujeto individual o desde un cruce. |
| Memoria | Aprendizaje persistente, pero scopiado al contexto correcto para evitar mezclar hechos de distintas personas o cruces. |

## Dirección Recomendada Hoy

Empezar por una versión conservadora, pero no paralizada por el tema legal:

1. Mantener "mi carta" como punto de entrada.
2. Agregar una biblioteca privada de sujetos/bodygraphs.
3. Permitir alias y entidades no-personales desde el inicio.
4. Crear cruces guardables entre dos bodygraphs.
5. Ofrecer lectura relacional básica: activaciones, completions, condicionamientos, centros, canales y dinámica de contexto.
6. Separar chats por contexto: carta individual o cruce.
7. Separar informes por contexto: informe individual o informe relacional.
8. Evitar scores, rankings o claims deterministas.
9. Mantener privacy-by-default y copy liviana de responsabilidad al cargar terceros.

## Producto Que Habría Que Cambiar

### Navegación

La sección actual de "mi carta" debería evolucionar hacia algo parecido a "Personas" o "Bodygraphs". El usuario tiene que poder ver:

- mi carta principal;
- sujetos guardados;
- cruces recientes;
- informes generados;
- chats por contexto.

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

### Cruces

El producto debería permitir:

- elegir sujeto A y sujeto B;
- definir el contexto del cruce;
- guardar el cruce con nombre propio;
- reabrirlo después;
- generar un informe;
- abrir un chat específico del cruce.

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

### Informes

Los informes deberían dividirse conceptualmente en:

- informe individual;
- informe relacional de dos bodygraphs;
- informe de negocio/persona;
- informe cliente/coach;
- informe familiar/pareja/equipo en una etapa posterior.

El informe relacional no debería ser solo dos informes individuales pegados. Tiene que explicar la interacción.

### Privacidad

La hipótesis actual no es "bloquear todo hasta tener consentimiento verificable". El mercado no parece operar así. La hipótesis prudente es:

- private by default;
- alias permitidos;
- no exponer datos de nacimiento exactos innecesariamente;
- borrar sujeto/bodygraph/cruce fácilmente;
- copy de responsabilidad al crear terceros;
- revisión legal antes de compartir/exportar o vender workspace para coaches.

## Riesgos

| Riesgo | Por qué importa | Mitigación producto |
|---|---|---|
| Abstracción demasiado amplia | Persona, negocio, animal, cliente y pareja pueden volver la UI confusa. | Empezar con pocos tipos y permitir "otro". |
| Contaminación de chats | El asistente puede mezclar datos de distintas personas. | Thread explícito por contexto. |
| Memoria contaminada | Aprender facts de terceros como si fueran del usuario rompe confianza. | Memoria por contexto o separación fuerte de scopes. |
| Promesas deterministas | "Compatibilidad" puede sonar a destino o juicio. | Lenguaje de dinámica, activación, fricción, complementariedad y observación. |
| Pricing débil | Si se cobra solo por cantidad de cartas, competidores baratos/gratis presionan. | Cobrar profundidad, informes, IA contextual, histórico y workflows pro. |
| Legal gris | Birth data/bodygraph/alias pueden caer en zonas distintas según jurisdicción y uso. | Documentar fuentes, minimizar datos, privacidad por defecto y revisión legal real antes de escalar. |
| Usuarios coaches | Las coaches cargan clientes como parte natural de su trabajo, pero eso cambia responsabilidades. | Separar modo personal de modo coach antes de venderlo como SaaS profesional. |

## Hipótesis De Pricing

Todavía no hay propuesta cerrada. Lo que sugiere el mercado:

- Free: mi carta + pocos sujetos/cruces para probar valor.
- Paid personal: más sujetos, más cruces, informes relacionales y chats por contexto.
- Paid pro/coach: clientes, notas, exportables, reportes white-label o compartibles, histórico y workflows de consentimiento/copy.

No conviene cobrar demasiado pronto por "guardar otra carta"; varios competidores dan charts ilimitadas o muy baratas. El diferencial de Astral debería ser síntesis, contexto, memoria, reportes y experiencia en español.

## Preguntas Para Contrastar

1. ¿Los usuarios dicen "comparar cartas" o "entender dinámicas concretas"?
2. ¿El primer caso de uso pago es personal, negocio o coach/cliente?
3. ¿Cuántos sujetos necesita una usuaria real antes de sentir valor?
4. ¿El cruce más valioso es usuario + otra entidad, o tercero + tercero?
5. ¿Qué información espera ver una coach en un cruce cliente + pareja?
6. ¿Un negocio debe tratarse como sujeto, como contexto o como informe especial?
7. ¿Cuándo una carta debe ser temporal y cuándo debe guardarse?
8. ¿Qué lenguaje entiende mejor la usuaria: "cruce", "conexión", "relación", "comparación", "composite"?
9. ¿Qué parte debe ser gratis para que el usuario entienda la magia del producto?
10. ¿Qué datos mínimos hacen falta para que el análisis sea útil sin invadir privacidad?

## Experimentos Sugeridos

1. Prototipo no técnico con 5 usuarias: seleccionar dos bodygraphs y elegir contexto.
2. Mock de informe relacional: activaciones, centros, canales, fricciones, preguntas prácticas.
3. Test de lenguaje: "cruce" vs "conexión" vs "relación" vs "comparación".
4. Test de carga: persona real vs alias vs negocio vs cliente.
5. Test de willingness-to-pay: pagar por cantidad de cartas vs pagar por informe relacional profundo.

## Decisión Temporal

La dirección recomendada al 2026-05-09 es avanzar conceptualmente hacia **workspace relacional de bodygraphs**, empezando por biblioteca privada + cruces guardables + threads por contexto.

No cerrar aún:

- nombre final de la feature;
- pricing;
- profundidad legal;
- modo coach;
- sharing/export;
- modelo técnico.

El próximo paso sano es pedir una segunda revisión crítica de esta hipótesis, usando [competencia.md](./competencia.md) como evidencia de mercado.
