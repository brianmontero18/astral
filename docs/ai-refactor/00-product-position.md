# Astral — Posición de producto (decisión estratégica)

**Fecha**: 2026-04-26
**Decisión**: confirmada por Brian (owner) y respaldada por research de mercado.

## La decisión en una línea

**Astral es "advisor de negocio con lens holístico/HD" — NO es "la app definitiva de Diseño Humano".**

## Por qué importa esta distinción

Hay dos posiciones posibles en el mercado:

### Opción A — "Mejor app de Human Design" (rechazada)

Compite en autoridad de contenido HD:
- Profundidad de teoría
- Cobertura de tipos, perfiles, cruces, gates
- Precisión de la enseñanza tradicional
- Material curado por expertos certificados de Jovian Archive

**Por qué la rechazamos:**
- **HumanDesign.ai (Bella) ya tiene 2,000+ prompts curados, multilenguaje, V2 con reports nativos.**
- **humandesign.io oficial está en waitlist con corpus de 2,500 horas de Ra Uru Hu** (rights propietarios). Cuando lance, gana esta categoría sin discusión.
- Es una pelea estructuralmente perdida: no tenemos rights al contenido original ni equipo de practitioners certificados.

### Opción B — "Advisor de negocio con lens holístico/HD" (elegida)

Compite en valor para el negocio del cliente:
- Estrategia
- Copy y comunicación
- Toma de decisiones
- Posicionamiento, oferta, ventas
- Aprovechamiento de timing (transits)
- Memoria persistente del negocio del cliente

**Por qué es ganable:**
- El research mostró que el espacio "vertical AI para emprendedores con sensibilidad woo" está vacante a escala:
  - Coachvox = celebrity-clone (Jodie AI). Distinto público.
  - Pi = generalista emocional. No tiene framework HD/business.
  - Replika = compañía. No es advisor de negocio.
  - Intuitive-business-coach espacio = 100% humano hoy (Sarah Santacroce, Lyn Thurman, etc.).
  - Harvey AI demostró que vertical AI con domain depth + workflow integration + customer collaboration es defendible vs ChatGPT.

## Implicaciones para el producto y la capa de IA

### Lo que esto cambia en cómo construimos

1. **El system prompt cambia de tono**: en lugar de "te explico tu diseño", "te ayudo a aplicar tu diseño a decisiones de negocio".

2. **El intake del negocio (ya recolectado) ahora es FIRST-CLASS** — debe estar en cada interacción de chat, no solo en reports.

3. **Las preguntas que el producto sugiere son business-flavored, no HD-encyclopedic**:
   - ❌ "Explicame mi tipo Manifesting Generator"
   - ✅ "¿Qué energía aprovecho esta semana para vender mi nuevo curso?"
   - ✅ "¿Cómo posiciono mi servicio según mi diseño?"
   - ✅ "¿Cuándo es mi ventana de comunicación esta semana?"

4. **El "knowledge moat" no es teoría HD** sino **conocimiento del negocio del cliente acumulado en el tiempo**:
   - Productos que vende
   - Clientes objetivo
   - Decisiones tomadas
   - Lanzamientos pasados y resultados
   - Patrones que funcionaron / no funcionaron
   - Tono de voz de la marca
   - Stage del negocio (early, scaling, mature)

5. **El report semanal cambia de framing**:
   - Antes: "esta semana tu Manifesting Generator con autoridad sacral debería..."
   - Ahora: "esta semana, dado tu lanzamiento del curso de meditación y los tránsitos del 30 al 6, tu energía favorece [acción concreta de negocio]..."

6. **El advisor "discrepa" cuando corresponde** — no valida planes que ignoran el diseño del cliente o no aprovechan los transits. Anti-sycophancy es feature, no bug.

### Lo que NO cambia

- Astral sigue usando HD como lente. No abandonamos el framework.
- Los reports siguen estructurados con lenguaje HD anclado.
- La extracción del bodygraph sigue siendo deterministic.
- `analyzeTransitImpact()` sigue computando antes del LLM.
- El producto sigue siendo en español, dirigido a emprendedores hispanohablantes con sensibilidad holística.

## Diferenciación contra ChatGPT (la pregunta crítica)

ChatGPT puede dar copy. ChatGPT puede dar estrategia. ChatGPT puede improvisar HD. **¿Por qué un emprendedor pagaría $X/mes a Astral?**

El research mostró cuatro moats que sostienen vertical AI vs ChatGPT genérico:

| Moat | Cómo lo construimos en Astral |
|---|---|
| **Datos propietarios que ChatGPT no tiene** | Bodygraph + intake + transit impact + memoria acumulada. Cada conversación enriquece el knowledge del cliente sobre vos. |
| **Workflow profundo** | Cycle semanal de transits + report + chat reactiva al ciclo. ChatGPT no tiene "esta semana específicamente". |
| **Lenguaje del dominio nativo** | Combina vocabulario HD + vocabulario business. ChatGPT no opera fluido en ambos. |
| **Customer collaboration depth** | Memoria persistente + el agente "te conoce" después de N conversaciones, no necesitás re-explicarte. |

## Implicación operativa inmediata

Cualquier prompt, estructura de context, decisión de modelo, métrica de eval que diseñemos a partir de hoy se mide contra esta posición:

> **"¿Esto está construyendo un mejor advisor de negocio holístico para emprendedores con sensibilidad woo, o estamos diluyendo en una mejor app de HD?"**

Si la respuesta es lo segundo, descartar.

## Anti-objetivos explícitos

Para que no haya ambigüedad sobre lo que NO somos:

- ❌ NO somos enciclopedia HD
- ❌ NO somos sustituto de readings 1:1 con human experts
- ❌ NO somos ChatGPT genérico con piel de astrología
- ❌ NO somos "pregúntale a Ra Uru Hu" (corpus oficial)
- ❌ NO somos compañero emocional (Pi/Replika territory)
- ❌ NO somos productividad / task manager (Lindy territory)

Somos: **el socio de negocio que conoce tu diseño humano, los tránsitos de la semana, y todo lo que ya hablaste sobre tu negocio. Operativo, directo, no genérico, no sycophant.**
