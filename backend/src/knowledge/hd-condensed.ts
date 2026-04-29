/**
 * HD Knowledge — Condensed manual para chat.
 *
 * Manual de Diseño Humano destilado (~8K tokens) optimizado para mentora
 * hispanohablante aplicado a negocio. Sintetizado del manual completo de
 * marca_personal (validado por Daniela) + Ra Uru Hu canónico, ajustado a
 * caso de uso Astral (advisor de negocio, no enciclopedia HD).
 *
 * Se carga en el prefix estable del system prompt del chat. Para reports
 * premium, bead astral-y3c.11 importa el manual completo (205K) con
 * selección programática por gates/canales/centros del usuario.
 */

export const HD_CONDENSED = `## CONOCIMIENTO BASE DE DISEÑO HUMANO (DESTILADO PARA NEGOCIO)

Esta sección te da el marco para interpretar el bodygraph del usuario aplicado a su negocio. Usalo como anclaje, no como guion: cada interpretación tiene que aterrizar en datos específicos de SU diseño.

### LOS 5 TIPOS

**Manifestor (~9%)**
- Estrategia: Informar antes de actuar.
- Aura: cerrada y repulsiva — abre o cierra puertas.
- Signature: Paz · Not-self: Enojo.
- En negocio: inicia, abre caminos, no necesita esperar respuesta. Su trampa es no informar a quienes su acción impacta y generar fricción innecesaria. La oferta funciona cuando arranca él/ella, no cuando "encaja en lo que el mercado quiere".

**Generator (~37%)**
- Estrategia: Esperar a responder. Sacral se prende ante el estímulo correcto.
- Aura: abierta y envolvente.
- Signature: Satisfacción · Not-self: Frustración.
- En negocio: maquina de construcción si responde a lo correcto. Si fuerza inicio o se compromete sin respuesta sacral, agotamiento y frustración crónica. La estrategia de venta es magnetismo, no outbound frío.

**Manifesting Generator (~33%)**
- Estrategia: Responder y luego Informar.
- Sub-tipo de Generator con Sacral DEFINIDO + conexión motor-Garganta.
- En negocio: multi-apasionado, salta entre temas, manifiesta a velocidad cuando se prende. Su trampa es saltar pasos por velocidad y no informar a su entorno. Diseñado para hacer varias cosas a la vez, no para "elegir un solo nicho".

**Projector (~20%)**
- Estrategia: Esperar la invitación (en lo grande: trabajo, relación, lugar).
- Aura: penetrante y focalizada.
- Signature: Éxito · Not-self: Amargura.
- En negocio: ve patrones, guía sistemas, no sostiene energía como un Generator. Si trabaja "como Generator" se quema. Su negocio florece desde reconocimiento e invitación — no desde "salir a vender". El precio premium es coherente con su diseño.

**Reflector (~1%)**
- Estrategia: Esperar el ciclo lunar (28 días) antes de decisiones grandes.
- TODOS los centros indefinidos — espejo del entorno.
- Signature: Sorpresa · Not-self: Decepción.
- En negocio: barómetro de la salud del entorno/comunidad. Trabajo solo cuando la comunidad alrededor está sana. NO presiones decisiones rápidas — necesita tiempo.

### LAS 7 AUTORIDADES (cómo decide bien la persona)

Jerarquía estricta — si el centro de arriba está definido, ese es la autoridad:

1. **Solar Plexus (Emocional)** — la más común. "No hay verdad en el ahora." Necesita sentir la ola completa: alta, baja, claridad. NUNCA decide en caliente. En venta: nunca cierra primera call. En email: deja como draft, revisa al día siguiente.

2. **Sacral** — solo Generators/MGs sin SP. Sonido gutural "uh-huh / un-uh" ante el estímulo. Decisión inmediata, pero requiere estímulo externo. En negocio: respondé al pitch del cliente, no al pitch tuyo.

3. **Bazo (Splenic)** — instinto del momento, susurra una sola vez. Quien tiene SP también tiene esto pero está tapado por la ola emocional. Decisión rápida, somática.

4. **Ego (Heart/Will)** — desde la voz del Heart center. "Quiero / no quiero." Necesita alineación con compromiso real, no con presión externa.

5. **Self-projected (G a Garganta)** — solo Projectors. Habla, escuchá tu propia voz. Si la dirección suena clara al hablarla, es correcta.

6. **Mental / Environmental** — solo Projectors sin centros motrices ni Bazo. Necesita compañía + entorno correcto para clarificar. Habla con varias personas hasta que la verdad emerja.

7. **Lunar** — solo Reflectors. Esperar el ciclo lunar (28 días) antes de decisiones grandes.

### LOS 9 CENTROS

**Centros de presión (sin awareness):**
- **Cabeza (Head)**: presión por inspiración. Indefinido = absorbe preguntas ajenas como propias.
- **Raíz (Root)**: presión adrenalina. Indefinido = corre sin razón, "tengo que apurarme".

**Centros de awareness (cómo procesa):**
- **Ajna**: certeza mental. Indefinido = "tengo que estar seguro" (no es necesario).
- **Bazo (Spleen)**: instinto, salud, miedos. Indefinido = se aferra a lo conocido por miedo.
- **Solar Plexus**: emociones, deseo. Indefinido = absorbe emociones ajenas, evita confrontación.

**Centros motrices (energía):**
- **Sacral**: vida y trabajo. Indefinido = "trabaja pero no debería" — Projectors se queman.
- **Heart/Ego (Will)**: voluntad, valor, autoestima. Indefinido = se prueba constantemente.
- **Centro G**: identidad, dirección, amor. Indefinido = busca dirección/amor afuera.

**Centro de expresión:**
- **Garganta (Throat)**: hablar y manifestar. Indefinido = habla para ser visto/oído.

### CENTROS INDEFINIDOS = SABIDURÍA POTENCIAL

Cada centro indefinido tiene un Not-self pattern (trampa) y una sabiduría posible si el usuario lo trabaja. Las preguntas Not-self que el usuario debe vigilar:

- Cabeza: "¿Estoy intentando responder preguntas que no son mías?"
- Ajna: "¿Estoy intentando convencer a todos de que tengo certeza?"
- Garganta: "¿Estoy hablando para llamar la atención?"
- Centro G: "¿Sigo buscando amor y dirección afuera?"
- Heart/Ego: "¿Sigo intentando demostrar lo que valgo?"
- Bazo: "¿Me aferro a lo que ya no me sirve?"
- Sacral: "¿Sé cuándo es suficiente?"
- Solar Plexus: "¿Estoy evitando confrontar la verdad?"
- Raíz: "¿Estoy apurándome para liberar la presión?"

### CANALES (las 36 conexiones definidas) — VISTA POR CIRCUITO

Convención de IDs: \`puerta_menor-puerta_mayor\` (ej: 12-22, no 22-12).

**Circuito Individual** — sub-circuito Knowing + las interconexiones entre los 4 gates de Self (10, 20, 34, 57) que algunas fuentes llaman Integration / Centering. Mutación, voz única, ruptura de patrones colectivos.
- Knowing: 1-8, 2-14, 3-60, 12-22, 23-43, 24-61, 25-51, 28-38, 39-55.
- Integration / Centering (los 4 gates de Self con sus 6 interconexiones): 10-20, 10-34, 10-57, 20-34, 20-57, 34-57. La persona se sostiene a sí misma; auténtica radicalmente.

**Circuito Colectivo** — sub-circuitos Logic (7) y Abstract (7). Compartir, lecciones, aprender de la experiencia.
- Logic: 4-63, 5-15, 7-31, 9-52, 16-48, 17-62, 18-58.
- Abstract: 11-56, 13-33, 29-46, 30-41, 35-36, 42-53, 47-64.

**Circuito Tribal** — sub-circuitos Ego (4) y Defense (3). Soporte, comunidad, transacciones, tribu.
- Ego: 19-49, 21-45, 26-44, 37-40.
- Defense: 6-59, 27-50, 32-54.

### CRUZ DE ENCARNACIÓN (Incarnation Cross)

4 puertas: Sun de Personality (rojo, lo que la persona ve de sí misma), Sun de Design (negro, lo que otros ven), Earth Personality, Earth Design. Es el propósito vital. Hay 192 cruces totales (4 cuartos de 48 cruces).

**Quarters:**
- Q1 Initiation (gates en gates 13-24-33...): cruzar conocimiento.
- Q2 Civilization (gates en zona 2): forma + estructura social.
- Q3 Duality (gates en zona 3): vínculo + relación.
- Q4 Mutation (gates en zona 4): transformación.

En negocio: el cruce informa por qué la persona vino. No es un destino fijo, es la dirección energética donde florece.

### TIPOS DE PERFIL (las 12 geometrías 6/2, 5/1, 4/6, etc.)

Líneas conscientes (P) e inconscientes (D):
- 1: Investigador (necesita base sólida).
- 2: Hermitaño (foco interno, llamado externo).
- 3: Mártir (aprende por experimentación, prueba/error).
- 4: Oportunista (red, influencia 1-a-1).
- 5: Heretical (proyección, salvador del mundo, presión social).
- 6: Role Model (3 fases: 0-30 mártir, 30-50 ermitaño en techo, 50+ rol modelo).

**Geometrías:**
- Right Angle (Personal Destiny): perfiles 1/3, 1/4, 2/4, 2/5, 3/5, 3/6, 4/6.
- Juxtaposition (Fixed Fate): perfil 4/1.
- Left Angle (Transpersonal Karma): 4/6, 5/1, 5/2, 6/2, 6/3.

En negocio: el perfil dicta cómo se posiciona. 6/2 muestra proceso, no fórmula. 5/1 desde autoridad (necesita expertise antes de proyectar). 3/5 desde experimentación visible.

### VARIABLES (4 FLECHAS) — capa avanzada

Solo se prescriben tras años de Strategy & Authority integrados. Son las 4 flechas en la cabeza de la chart:

- **Determinación (Digestion)**: cómo comer (PHS — Primary Health System).
- **Environment**: dónde estar (Caves/Markets/Kitchens/Mountains/Valleys/Shores + L/R).
- **Perspective**: cómo enfocar (Personal/Strategic/Observe + L/R).
- **Motivation**: motor profundo (Hope/Desire/Need/Guilt/Innocence/Fear + L/R).

Direcciones de flecha (left ← / right →):
- **Left arrow**: focused/specific (PRR/PLL/etc).
- **Right arrow**: peripheral/receptive.

**No prescribas Variables a alguien que recién está integrando Strategy & Authority** — es prematuro y descondiciona desordenadamente.

### CRUCE HD × NEGOCIO — patrones canónicos

- **MG con SP definido + Profile 6/2**: ciclos largos, se retira (linea 2), después regresa con propuesta integrada. NO funciona "estar siempre disponible". Ofertas que respeten ciclos.
- **Projector con Heart/Ego definido**: vende desde reconocimiento + voluntad, no desde Sacral. Pricing premium coherente. Cobra por su mirada, no por sus horas.
- **Generator con G abierto**: deja que el cliente le diga quién es. El nicho se aclara respondiendo, no eligiendo.
- **MG con Throat-Sacral**: charisma natural en video/voz. Su Throat-Sacral hace que diga lo que su Sacral confirma — autenticidad radical en cámara.
- **Solar Plexus tribal (gates 6, 37, 49)**: contratos, alianzas, intimidad selectiva. Negocio basado en relación 1-a-1, no en masa.
- **Solar Plexus individual (gates 22, 55)**: ola ascendente que afecta a todos cerca. Líneas creativas, "spirit/melancholy".
- **Solar Plexus abstracto (gates 30, 36)**: deseo, anticipación, "qué pasaría si...". Vende visiones futuras, no presente.

Cuando interpretes, anclá SIEMPRE en datos específicos del usuario: "tu canal X (que conecta Y a Z) hace que..." — no generalidades.`;
