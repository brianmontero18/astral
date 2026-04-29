/**
 * HD Detection Rules — anti-hallucination específica de Diseño Humano.
 *
 * 12 reglas críticas que el LLM debe respetar al hablar de HD. Sintetizadas
 * del SKILL.md de marca_personal (que validó Daniela en sus reportes), traídas
 * literales en español al system prompt del chat.
 *
 * Severidad implícita: cualquier violación = respuesta incorrecta.
 *
 * Bead astral-y3c.12 promueve estas reglas a evals automatizadas (post-hoc)
 * + self-check pre-output. Acá viven solo como reglas in-prompt.
 */

export const HD_DETECTION_RULES = `## REGLAS CRÍTICAS DE DISEÑO HUMANO

Verificá tu respuesta contra estas reglas antes de devolverla. Si alguna se viola, corregí internamente y devolvé la versión corregida:

1. AUTORIDAD JERÁRQUICA: Si el usuario tiene Solar Plexus definido, su autoridad es Emocional — JAMÁS recomiendes decisión espontánea ni "confía en tu intuición ahora". La jerarquía es Solar Plexus > Sacral > Bazo > Ego > Centro G > Mental > Lunar.

2. MG vs GENERATOR: Manifesting Generator tiene Sacral DEFINIDO + conexión motor-Garganta. Su estrategia es Responder y luego Informar. NO confundir con Generator puro (que no informa después).

3. TIPOS DE CANAL: Generated = Sacral involucrado. Manifested = motor a Garganta SIN Sacral. Projected = el resto. Dos motores conectados ≠ Generated automáticamente. Verificá contra la tabla de 36 canales antes de afirmar.

4. CANALES ENTRE CENTROS DISTINTOS: Las puertas del MISMO centro NUNCA forman canal entre sí. Cualquier canal conecta dos centros DIFERENTES. Si dudás, no inventes — decí "habría que verificar contra la tabla de canales".

5. HANGING GATES: La atracción magnética de una puerta colgante apunta a la puerta complementaria del canal — siempre en otro centro distinto.

6. TRÁNSITOS TEMPORALES: Los tránsitos suman energía momentánea pero NUNCA son definición permanente del usuario. No digas "ahora sos X tipo" porque un tránsito active algo.

7. MENTE NO ES AUTORIDAD INTERNA: La mente solo sirve como autoridad EXTERIOR (compartir sabiduría con otros). La autoridad interior siempre bypasea la mente analítica. No prescribas "pensalo racionalmente" como camino para decidir.

8. VARIABLES Y PHS CONDICIONAL: NO prescribas Variables (4 flechas) ni PHS sin que el usuario haya integrado primero su Estrategia y Autoridad. Son capa avanzada.

9. REFLECTOR: Reflector tiene CERO centros definidos y CERO canales definidos. Si el usuario tiene aunque sea uno definido, NO es Reflector.

10. INDEFINIDO vs COMPLETAMENTE ABIERTO: Centro indefinido = tiene puertas colgantes (filtro parcial, sabiduría posible). Completamente abierto = sin gates (sin filtro, condicionamiento más profundo).

11. LÍNEAS MODIFICAN PUERTAS: Puerta 25.3 es fundamentalmente distinta de Puerta 25.1. La línea modifica cómo se expresa la puerta. Si mencionás una puerta, considerá la línea.

12. OLAS EMOCIONALES: Cada puerta del Plexo Solar pertenece a un tipo de ola: Tribal (37, 6, 49), Individual (22, 55), Colectiva Abstracta (36, 30). Una persona puede tener varias olas simultáneamente.

Si no podés verificar una afirmación HD contra estas reglas, NO la afirmes con certeza — usá lenguaje provisional ("habría que verificar...", "según el patrón general...").`;
