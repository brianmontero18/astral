/**
 * Static Content — HD Report Descriptions
 *
 * 96 pre-written descriptions in Spanish for the hybrid report system.
 * These form the deterministic 75% of the report. The remaining 25%
 * comes from LLM calls that personalize based on the user's specific
 * combination of design elements.
 *
 * Categories:
 * - TYPE_DESCRIPTIONS (5)
 * - AUTHORITY_DESCRIPTIONS (7)
 * - PROFILE_DESCRIPTIONS (12)
 * - DEFINITION_DESCRIPTIONS (5)
 * - CHANNEL_DESCRIPTIONS (36)
 * - CENTER_UNDEFINED_DESCRIPTIONS (9)
 * - DIGESTION_DESCRIPTIONS (9)
 * - ENVIRONMENT_DESCRIPTIONS (6)
 * - STRONGEST_SENSE_DESCRIPTIONS (7)
 */

// ─── Type Descriptions (5) ───────────────────────────────────────────────────
// Keys match the Spanish values from extraction-service HD_TYPE_MAP

export const TYPE_DESCRIPTIONS: Record<string, string> = {
  Generador: `El Generador es la fuerza vital del planeta. Representás aproximadamente el 37% de la población y tu diseño está construido alrededor del Centro Sacral definido, un motor biológico que genera energía sostenida para el trabajo y la creación.

Tu mecánica fundamental es la respuesta. No estás diseñado para iniciar desde la mente; estás diseñado para responder a la vida con sonidos guturales — esos "ajá", "mmm", "uh-huh" que emergen antes del pensamiento. Esa respuesta sacral es tu GPS interno. Cuando algo te enciende genuinamente, tenés energía inagotable para ello. Cuando no, forzarlo te lleva directo a la frustración.

La frustración es tu tema del no-ser, la señal de que estás iniciando en lugar de responder. No es un defecto; es un mecanismo de corrección. Cada vez que sentís frustración, tu cuerpo te está diciendo que te desviaste de lo que realmente te prende.

Tu estrategia — esperar para responder — no significa pasividad. Significa vivir una vida lo suficientemente rica como para que las cosas lleguen a vos. Exponete a estímulos, conversaciones, propuestas, oportunidades. Tu sacral necesita algo a qué responder. La clave es no comprometerte mentalmente antes de que tu cuerpo dé la señal.

Cuando vivís correctamente, experimentás satisfacción. No satisfacción como meta abstracta sino como sensación física: caer en la cama agotado pero pleno, sabiendo que tu energía fue a lo correcto. Esa satisfacción es tu firma. Es la prueba de que estás en tu camino.

El error más común del Generador es confundir disponibilidad con propósito. Que tengas energía para algo no significa que sea para vos. La respuesta sacral distingue entre "puedo hacerlo" y "esto me enciende". Aprender esa diferencia cambia todo.`,

  "Generador Manifestante": `El Generador Manifestante es el tipo más rápido del sistema. Combinás la energía sostenida del Centro Sacral con una conexión motora directa a la Garganta, lo que te da la capacidad de responder Y manifestar en un mismo movimiento. Representás aproximadamente el 33% de la población.

Tu mecánica es responder primero, luego informar y actuar. A diferencia del Generador puro, una vez que tu sacral responde afirmativamente, no necesitás esperar — podés moverte inmediatamente. Esto te da una velocidad natural que a menudo confunde a los demás (y a vos mismo) haciéndote creer que sos un iniciador. No lo sos. Sos un respondedor ultrarrápido.

La frustración y la ira son tus temas del no-ser. La frustración viene de no respetar la respuesta sacral; la ira viene de no informar antes de actuar. Informar no es pedir permiso. Es dejar saber a los que te rodean lo que vas a hacer, para que no se sientan atropellados por tu velocidad.

Tu proceso no es lineal — es de saltos. Empezás algo, llegás a un punto donde tu sacral ya no responde, y saltás a otra cosa. Esto no es inconstancia; es tu mecánica natural. El truco es distinguir entre "ya terminé con esto" (la energía se fue legítimamente) y "me frustré porque se puso difícil" (resistencia, no finalización).

Cuando vivís correctamente, experimentás satisfacción y paz. Satisfacción del sacral respondiendo a lo correcto; paz de haber informado y no haber generado resistencia innecesaria a tu alrededor.

Tu mayor don es la eficiencia. Encontrás atajos que otros no ven, combinás habilidades de formas inesperadas, y podés hacer en una hora lo que a otros les toma un día — siempre y cuando estés respondiendo a algo que genuinamente te enciende.`,

  Proyector: `El Proyector es el guía natural del sistema. Representás aproximadamente el 20% de la población y tu diseño no incluye el Centro Sacral definido, lo que significa que no tenés energía sostenida propia para el trabajo. Tu don es otro: ver a los demás con una claridad que nadie más tiene.

Tu aura es penetrante y enfocada. Cuando mirás a alguien, entrás profundo en su mecánica. Ves cómo operan, dónde están desperdiciando energía, qué podrían hacer mejor. Esta capacidad es extraordinaria — y también es la fuente de tu mayor trampa: dar guía sin que te la pidan.

Tu estrategia es esperar la invitación. No cualquier invitación superficial sino el reconocimiento genuino de tu capacidad. Cuando alguien te invita correctamente — a un trabajo, una relación, una colaboración — significa que tu aura fue reconocida. En ese espacio, tu guía aterriza con poder. Sin invitación, tus palabras rebotan y la amargura se instala.

La amargura es tu tema del no-ser. Es la señal de que estás dando sin ser reconocido, trabajando sin ser invitado, guiando sin ser solicitado. No es debilidad; es tu sistema de navegación diciéndote que algo está desalineado.

Tu relación con la energía es crucial. No estás diseñado para jornadas de 8 horas de trabajo sostenido. Necesitás gestionar tu energía como un recurso finito: períodos de enfoque profundo alternados con descanso real. Acostarte antes de estar agotado, solo, para descargar la energía ajena que absorbiste durante el día.

Cuando vivís correctamente, experimentás éxito. No éxito como lo define el mundo sino como resonancia: estar en el lugar correcto, con las personas correctas, siendo reconocido por lo que realmente sos. Ese éxito externo es el reflejo de tu alineación interna.`,

  Manifestador: `El Manifestador es el iniciador del sistema. Representás aproximadamente el 8% de la población y tu diseño tiene una conexión motora directa a la Garganta sin pasar por el Centro Sacral. Esto te da la capacidad única de iniciar acción sin necesitar respuesta externa.

Tu aura es cerrada y repelente — no en sentido negativo sino protector. Tu campo energético establece límites naturales. La gente siente tu presencia antes de que hables. Esta cualidad es lo que te permite mover energía a gran escala, pero también es lo que genera resistencia si no informás.

Tu estrategia es informar. No pedir permiso — informar. Decirle a tu entorno qué vas a hacer antes de hacerlo. Esto no limita tu libertad; la protege. Cuando informás, removés la resistencia que naturalmente genera tu aura cerrada en los demás. Sin informar, cada acción tuya se siente como un impacto inesperado para quienes te rodean.

La ira es tu tema del no-ser. No la ira explosiva necesariamente, sino la ira profunda de sentirte controlado, limitado, frenado. Cuando alguien intenta decirte qué hacer o cómo hacerlo, sentís una reacción visceral. Esa ira es información: te dice que tu naturaleza iniciadora está siendo reprimida.

Tu energía viene en ráfagas. No tenés la constancia del Generador; tenés impulsos potentes que necesitan expresión inmediata. Cuando el impulso llega, actuás. Cuando se va, descansás. Intentar mantener un ritmo constante te agota y te frustra.

Cuando vivís correctamente, experimentás paz. Paz no como ausencia de acción sino como ausencia de resistencia. Iniciaste, informaste, actuaste, y el mundo se movió contigo en lugar de contra vos.`,

  Reflector: `El Reflector es el espejo del sistema. Representás aproximadamente el 1% de la población y tu diseño no tiene ningún centro definido. Todos tus centros están abiertos, lo que significa que tomás y amplificás la energía de todo y todos a tu alrededor.

Tu aura es resistente y muestreadora. No absorbe como los centros abiertos de otros tipos — muestrea. Probás la energía del ambiente, la procesás, y la reflejás de vuelta transformada. Esto te convierte en el evaluador más objetivo del sistema: podés sentir la salud de una comunidad, una relación, un proyecto, porque lo experimentás todo sin apego fijo.

Tu estrategia es esperar un ciclo lunar completo (28 días) antes de tomar decisiones importantes. No porque seas lento sino porque tu diseño está vinculado al tránsito de la Luna, que activa un centro diferente cada día. Necesitás experimentar la decisión desde las 64 puertas diferentes que la Luna toca en su ciclo para tener la perspectiva completa.

La decepción es tu tema del no-ser. Aparece cuando te apurás a decidir, cuando te dejás llevar por la energía de otros creyendo que es tuya, cuando no te das el tiempo de tu ciclo.

Tu mayor vulnerabilidad y tu mayor don son lo mismo: la apertura total. Podés ser cualquiera, sentir como cualquiera, experimentar la vida desde cualquier perspectiva. Esto es extraordinario pero también desorientador si no tenés un ambiente sano. Tu ambiente te define más que a cualquier otro tipo.

Cuando vivís correctamente, experimentás sorpresa y deleite. La vida te sorprende constantemente porque no tenés agenda fija. Cada día es diferente, cada encuentro te transforma, y tu sabiduría viene de haber experimentado la totalidad del espectro humano a través de tu apertura.`,
};

// ─── Authority Descriptions (7) ──────────────────────────────────────────────
// Keys match Spanish values from extraction-service HD_AUTHORITY_MAP

export const AUTHORITY_DESCRIPTIONS: Record<string, string> = {
  "Emocional (Plexo Solar)": `Tu autoridad es emocional, lo que significa que tu Centro del Plexo Solar está definido y opera en una onda constante. No existe la claridad emocional absoluta — solo existe mayor claridad con el tiempo.

Tu mecánica de decisión requiere paciencia. Cuando algo se presenta, tu primera reacción emocional no es la verdad completa; es solo un punto en tu onda. Necesitás dejar que la onda suba y baje — sentir entusiasmo, luego duda, luego calma — hasta que emerja algo que se siente consistente a través de los altibajos.

La regla práctica: nunca decidas en el pico emocional (euforia) ni en el valle (desesperación). Esperá a que la onda se estabilice. Esto puede tomar horas, días o semanas dependiendo de la magnitud de la decisión. No hay fórmula de tiempo; hay una sensación de "ya lo sé" que es diferente al impulso inicial.

Tu onda tiene un patrón personal. Algunas personas tienen ondas dramáticas con picos altos y valles profundos; otras tienen ondas más suaves. Conocer tu patrón te ayuda a calibrar cuánto tiempo necesitás. Con el tiempo, aprendés a surfear tu propia onda en lugar de ser arrastrado por ella.

Aproximadamente el 50% de la humanidad tiene autoridad emocional. Esto no la hace menos especial — la hace fundamental. Tus emociones no son irracionales; son un sistema de inteligencia sofisticado que procesa información que la mente no puede captar.`,

  Sacral: `Tu autoridad es sacral, lo que significa que tu respuesta viene del Centro Sacral en forma de sonidos guturales e impulsos corporales inmediatos. Es la autoridad más visceral y directa del sistema.

Tu "sí" sacral se siente como una expansión en el abdomen, un tirón hacia adelante, un sonido que sale antes del pensamiento. Tu "no" sacral es contracción, silencio, un cuerpo que se retrae. No hay ambigüedad cuando el sacral habla — el desafío es aprender a escucharlo por encima del ruido mental.

Para acceder a tu autoridad sacral necesitás preguntas de sí o no. Tu sacral no responde a preguntas abiertas como "¿qué debería hacer?". Responde a "¿quiero esto?", "¿me enciende?", "¿voy?". Practicar con preguntas simples en lo cotidiano entrena tu capacidad de escuchar la respuesta en decisiones grandes.

La respuesta sacral es inmediata y del momento. No requiere tiempo de procesamiento — eso es la mente interfiriendo. Si necesitás pensarlo, probablemente la respuesta sea no. Si el cuerpo ya se movió antes de que la mente opinara, esa es tu verdad.

Es importante distinguir la respuesta sacral de los deseos condicionados. Si alguien te pregunta "¿querés helado?" y tu sacral dice sí, eso es respuesta. Si tu mente dice "debería querer helado porque todos quieren" y forzás un sí, eso es condicionamiento.`,

  Esplénica: `Tu autoridad es esplénica, lo que significa que tu Centro del Bazo te comunica verdades instantáneas a través de intuiciones, instintos y sensaciones corporales sutiles. Es la autoridad más antigua y sutil del sistema.

El Bazo habla una sola vez. No repite. Es un susurro, una sensación de "algo no está bien" o "esto es seguro", un escalofrío, una certeza que no tiene explicación lógica. Si lo ignorás, no vuelve. Por eso es tan importante aprender a captarlo en tiempo real.

Tu proceso de decisión es instantáneo. No necesitás tiempo — necesitás presencia. Estar lo suficientemente presente en tu cuerpo como para captar la señal cuando aparece. La meditación, el ejercicio, cualquier práctica que te conecte con sensaciones corporales sutiles, entrena esta capacidad.

El desafío principal de la autoridad esplénica es que la mente es más ruidosa. Tu intuición dice "no vayas" y la mente dice "pero ya confirmé, sería descortés cancelar". La mente siempre tiene argumentos; el Bazo solo tiene la verdad del momento. Aprender a priorizar la señal esplénica sobre la justificación mental es tu práctica de vida.

Tu autoridad está conectada con la supervivencia, la salud y el bienestar. No solo te guía en decisiones grandes; te guía momento a momento sobre qué comer, cuándo descansar, a quién acercarte y de quién alejarte.`,

  "Ego/Corazón": `Tu autoridad es del Ego (Centro Corazón/Voluntad), lo que significa que tus decisiones correctas emergen de lo que genuinamente querés y estás dispuesto a comprometerte a sostener.

Esta es la autoridad de la voluntad y la palabra. Cuando decís "yo quiero esto" o "yo voy a hacer esto" y lo sentís desde el centro del pecho, esa es tu verdad. No es deseo mental ni obligación externa — es una declaración de voluntad que podés respaldar con tu energía.

Tu Centro del Corazón es un motor con ciclos de trabajo y descanso. Cuando se compromete, genera una fuerza extraordinaria para cumplir. Cuando se agota, necesita recuperarse completamente. No podés vivir en compromiso constante; necesitás períodos de no-compromiso donde tu corazón descansa.

La pregunta clave para tu autoridad es: "¿Realmente quiero esto? ¿Estoy dispuesto a poner mi voluntad detrás de esto?". Si la respuesta es un sí del pecho, adelante. Si hay duda, no te comprometas. Una promesa a medias desde un Ego definido genera más daño que no prometer nada.

Esta autoridad es rara y poderosa. No la confundas con egoísmo — es auto-respeto. Saber qué vale tu energía y comprometerte solo con lo que genuinamente querés es la forma más sana de operar para tu diseño.`,

  "Auto-proyectada": `Tu autoridad es auto-proyectada, lo que significa que tu verdad emerge cuando hablás y te escuchás a vos mismo. Tu Centro G y tu Garganta están conectados sin interferencia de motores, creando un canal directo entre tu identidad y tu expresión.

Tu proceso de decisión requiere hablar. No pensar en silencio — hablar en voz alta, idealmente con alguien que pueda escucharte sin dar consejos. Cuando articulás opciones, tu propia voz te revela la verdad. Escuchás certeza o duda en tu tono, en tu ritmo, en las palabras que elegís.

No necesitás que el otro opine; necesitás que el otro sostenga el espacio. Un buen amigo, un coach, un terapeuta que simplemente escuche es tu herramienta de decisión más valiosa. Grabarte hablando sobre una decisión y escucharte después también funciona.

La clave es no confundir hablar para decidir con racionalizar. Si te escuchás justificando con argumentos lógicos, esa es la mente. Si te escuchás declarando con convicción tranquila, esa es tu autoridad.

Tu identidad (Centro G) es tu brújula. Las decisiones correctas para vos son las que se alinean con quién sos, no con lo que es conveniente, esperado o lógico.`,

  "Mental/Ambiente": `Tu autoridad es mental o de ambiente, lo que significa que ningún motor o centro de consciencia debajo de la Garganta está definido en tu diseño. Tu claridad viene del ambiente externo y de procesar información a través del diálogo.

Esta no es autoridad mental en el sentido de "pensá bien antes de decidir". Es lo opuesto: tu mente es tu herramienta de investigación pero no tu herramienta de decisión. Necesitás hablar las opciones con múltiples personas de confianza, en diferentes ambientes, y observar cómo cambia tu perspectiva según el contexto.

El ambiente físico es crucial. Probablemente tomás mejores decisiones en ciertos lugares que en otros. Un café tranquilo, la naturaleza, tu rincón favorito de la casa — prestá atención a dónde te sentís más claro. Ese ambiente es parte de tu sistema de decisión.

Tu proceso es lento por diseño. No es indecisión; es thorough. Necesitás escuchar múltiples perspectivas, darle tiempo a la información para que se asiente, y esperar a que emerja una dirección que se sienta correcta en el cuerpo — no en la cabeza.

Las personas con esta autoridad suelen ser excelentes facilitadores y mediadores precisamente porque pueden ver todos los ángulos. Tu don es la objetividad; tu desafío es no perderte en ella.`,

  Lunar: `Tu autoridad es lunar, exclusiva del Reflector. Tu proceso de decisión está vinculado al ciclo de la Luna, que tarda aproximadamente 28.5 días en recorrer las 64 puertas del Rave Mandala.

Cada día, la Luna activa un gate diferente en tu diseño abierto, dándote una perspectiva distinta. Un lunes podés sentir certeza sobre una decisión; el jueves, desde otro gate activado, sentís lo opuesto. Ambas experiencias son válidas — son fragmentos del panorama completo.

Tu estrategia es esperar el ciclo lunar completo antes de tomar decisiones importantes. Esto no aplica para elegir qué cenar; aplica para decisiones de vida: cambios de trabajo, mudanzas, relaciones, compromisos grandes. Durante el ciclo, llevá un registro de cómo te sentís respecto a la decisión en diferentes días.

Al final del ciclo, no buscás una respuesta lógica. Buscás una sensación predominante, una dirección que se mantuvo consistente a través de las diferentes activaciones lunares. Si después de 28 días seguís sintiendo claridad en una dirección, es correcta.

Tu relación con la Luna es literal e íntima. Observar las fases lunares, registrar tus estados de ánimo, notar qué gates se activan cada día — todo esto fortalece tu conexión con tu autoridad. No es misticismo; es mecánica de tu diseño.`,
};

// ─── Profile Descriptions (12) ───────────────────────────────────────────────
// Keys match profile numbers (e.g. "1/3")

export const PROFILE_DESCRIPTIONS: Record<string, string> = {
  "1/3": `El perfil 1/3 es el Investigador/Mártir. Tu vida está construida sobre dos pilares: la necesidad de investigar hasta sentir una base sólida (línea 1) y la necesidad de descubrir qué funciona a través de la experiencia directa (línea 3).

La línea 1 consciente te da una necesidad profunda de seguridad a través del conocimiento. No podés actuar sin entender primero. Investigás, leés, preguntás, cavás hasta encontrar los fundamentos. Sin esa base, sentís inseguridad y ansiedad. Con ella, te parás con una autoridad que nadie puede cuestionar.

La línea 3 inconsciente te empuja a aprender por ensayo y error. Las cosas se rompen a tu alrededor — relaciones, trabajos, proyectos — no porque hagas algo mal sino porque tu diseño necesita descubrir qué funciona eliminando lo que no. Cada "fracaso" es un dato, cada ruptura es un descubrimiento.

La combinación crea a alguien que investiga profundamente Y testea todo en la práctica. Tu sabiduría es experiencial y fundamentada. No repetís recetas; creás las tuyas después de haber probado y descartado lo que no sirve.

Tu desafío es la relación con el error. La mente juzga los tropiezos como fallas; tu diseño los necesita como combustible. Cuando aceptás que romper cosas es tu proceso natural de descubrimiento, dejás de resistir y empezás a prosperar.`,

  "1/4": `El perfil 1/4 es el Investigador/Oportunista. Combinás la profundidad investigativa de la línea 1 con la red social estratégica de la línea 4.

Tu línea 1 consciente necesita fundamentos sólidos antes de moverse. No sos alguien que improvisa; sos alguien que prepara, estudia, y construye competencia real antes de ofrecerla al mundo. Tu seguridad viene de saber que sabés.

Tu línea 4 inconsciente opera a través de redes. Las oportunidades no te llegan de la nada; llegan a través de personas que ya conocés. Tu red social es tu recurso más valioso. No son contactos transaccionales — son relaciones genuinas que, cuando necesitás algo, activan puertas que no sabías que existían.

La combinación crea una persona que se prepara profundamente y luego externaliza ese conocimiento a través de su red. Sos el amigo que siempre sabe, el que la gente consulta porque tiene la base investigada Y la capacidad de transmitirla de persona a persona.

Tu desafío es no quedarte en la fase de investigación indefinidamente por miedo a no estar listo. La línea 4 necesita que compartas; la línea 1 necesita más tiempo. Encontrar el balance entre preparación y externalización es tu práctica de vida.`,

  "2/4": `El perfil 2/4 es el Ermitaño/Oportunista. Combinás un talento natural que preferirías ejercer en soledad (línea 2) con una naturaleza social que necesita conexión para prosperar (línea 4).

Tu línea 2 consciente tiene dones innatos que ni siquiera reconocés como especiales. Hacés cosas con naturalidad que a otros les cuestan enormemente. Tu tendencia es retirarte, hacer lo tuyo en paz, y no entender por qué la gente te interrumpe pidiendo que compartas lo que para vos es obvio.

Tu línea 4 inconsciente necesita red social. A pesar de tu deseo de ermitaño, las oportunidades correctas llegan a través de personas. Tu red te llama afuera, te invita, te saca del aislamiento — y eso es correcto cuando viene como reconocimiento genuino de tu don natural.

La tensión entre querer estar solo y necesitar conexión es tu tema central. No se resuelve eligiendo uno; se resuelve alternando. Períodos de retiro donde cultivás tu don, seguidos de períodos sociales donde lo compartís a través de tu red.

Tu desafío es aceptar ser llamado. La línea 2 resiste que la descubran; la línea 4 necesita externalizar. Cuando alguien reconoce tu talento y te llama, la respuesta correcta no siempre es esconderte.`,

  "2/5": `El perfil 2/5 es el Ermitaño/Hereje. Combinás un talento natural que preferís ejercer en privado (línea 2) con una proyección de los demás que te ven como salvador o solucionador de problemas (línea 5).

Tu línea 2 consciente tiene habilidades innatas, casi inconscientes. No estudiaste para tenerlas; vinieron con vos. Tu instinto es practicarlas en soledad, sin audiencia, sin presión de performance.

Tu línea 5 inconsciente genera un campo de proyección poderoso. La gente ve en vos lo que necesita ver: el que puede salvarlos, el que tiene la respuesta, el líder que esperaban. Esta proyección es un arma de doble filo — si cumplís con ella, tu reputación se eleva; si no, te queman.

La combinación crea a alguien que es genuinamente talentoso (línea 2) Y que atrae expectativas enormes (línea 5). Tu vida alterna entre retirarte a hacer lo tuyo y ser llamado a resolver crisis ajenas. Cuando esas crisis se alinean con tu don natural, sos extraordinario. Cuando no, sos chivo expiatorio.

Tu desafío es gestionar la proyección. No podés evitar que la gente proyecte sobre vos, pero podés elegir cuándo salir del retiro y para qué. Salir solo cuando tu don es realmente aplicable protege tu reputación y tu energía.`,

  "3/5": `El perfil 3/5 es el Mártir/Hereje. Combinás el aprendizaje por experiencia directa y ruptura (línea 3) con el campo de proyección que te posiciona como solucionador (línea 5).

Tu línea 3 consciente aprende rompiendo cosas. Probás, experimentás, descubrís qué no funciona para encontrar qué sí. Tu vida está llena de cambios, giros, cosas que empezaron de una forma y terminaron de otra. No es caos; es proceso de descubrimiento.

Tu línea 5 inconsciente atrae proyecciones. La gente te ve como el que puede arreglar las cosas, el práctico, el que tiene soluciones universales. Cuando tu experiencia (línea 3) realmente te dio la solución que necesitan, sos heroico. Cuando no, la decepción de los demás puede ser brutal.

La combinación crea un solucionador empírico. No ofrecés teoría; ofrecés soluciones testeadas en carne propia. Tu credibilidad viene de haber pasado por el fuego, no de haber leído sobre él. Esto te hace extraordinariamente útil cuando la solución que encontraste aplica al problema que te presentan.

Tu desafío es la reputación. La línea 3 rompe cosas públicamente; la línea 5 es juzgada por los resultados. Necesitás elegir cuidadosamente cuáles batallas peleás en público, porque cada una afecta la percepción que otros tienen de vos.`,

  "3/6": `El perfil 3/6 es el Mártir/Modelo a Seguir. Tu vida tiene tres fases claramente diferenciadas por la línea 6.

Hasta los 28-30 años, vivís como un 3/3: experiencia pura, ensayo y error intenso. Todo se prueba, mucho se rompe. Esta fase es caótica pero necesaria — estás acumulando la experiencia que luego te convertirá en modelo.

De los 30 a los 50 aproximadamente, subís al "techo". Observás la vida desde arriba, procesás las experiencias de la primera fase, y empezás a integrar la sabiduría. Hay menos experimentación y más reflexión. Podés sentirte desconectado, como si estuvieras esperando algo.

Después de los 50, bajás del techo como modelo a seguir. Tu autoridad viene de haber vivido las dos fases anteriores: experimentaste como nadie (línea 3) y procesaste como nadie (línea 6). Ahora podés guiar con autenticidad porque no hablás desde la teoría sino desde la vida vivida.

Tu desafío principal es no amargarte en la primera fase. Los golpes de la línea 3 son intensos y la mente puede interpretarlos como fracasos en lugar de aprendizajes. La línea 6 necesita esa materia prima; sin ella, no hay modelo a seguir posible.`,

  "4/6": `El perfil 4/6 es el Oportunista/Modelo a Seguir. Combinás la naturaleza social y de redes de la línea 4 con las tres fases vitales de la línea 6.

Tu línea 4 consciente opera a través de relaciones. Tu mundo es tu red: amigos, colegas, conocidos que forman un ecosistema donde fluyen oportunidades, ideas y conexiones. No sos un networker frío; sos alguien que genuinamente se involucra con su gente.

Tu línea 6 inconsciente te lleva por tres fases de vida. En la primera fase (hasta ~30), experimentás intensamente a través de tu red. En la segunda (~30-50), observás desde arriba, refinando tu visión. En la tercera (50+), te convertís en modelo a seguir dentro de tu comunidad.

La combinación crea a alguien cuya influencia crece orgánicamente a través de relaciones y madurez. No necesitás plataforma masiva; necesitás profundidad de conexión. Tu red es tu amplificador y tu legado.

Tu desafío es la paciencia. La línea 4 quiere externalizar ahora; la línea 6 necesita tiempo para madurar. En la segunda fase especialmente, podés sentir que no estás haciendo suficiente. Estás procesando — y eso es exactamente lo que necesitás hacer.`,

  "4/1": `El perfil 4/1 es el Oportunista/Investigador. Es un perfil de ángulo fijo con un destino particular: transmitir conocimiento profundo a través de redes personales.

Tu línea 4 consciente necesita comunidad. No funcionás en aislamiento; necesitás personas con quienes compartir, debatir, co-crear. Tu red es tanto tu audiencia como tu fuente de oportunidades.

Tu línea 1 inconsciente es una base investigativa profunda que opera debajo de tu consciencia. Sin darte cuenta, siempre estás buscando fundamentos, acumulando conocimiento, construyendo una base de experticia que sostiene todo lo que externalizás.

La combinación crea al transmisor natural: alguien que investiga profundamente (línea 1) y comparte generosamente a través de su red (línea 4). Sos el que siempre tiene la data, el recurso, la referencia que otros necesitan.

Como perfil de ángulo fijo, tu destino es más personal que transpersonal. Tu impacto es directo, de persona a persona, no masivo. La calidad de tu red importa más que su tamaño. Tu desafío es no obsesionarte con la investigación al punto de olvidar compartir, ni compartir tanto que pierdas profundidad.`,

  "5/1": `El perfil 5/1 es el Hereje/Investigador. Combinás el campo de proyección más potente del sistema (línea 5) con la profundidad investigativa de la línea 1.

Tu línea 5 consciente genera proyecciones constantes. La gente ve en vos al líder, al solucionador, al que puede salvar la situación. Esta proyección es una herramienta poderosa cuando está respaldada por sustancia real — y eso es exactamente lo que provee tu línea 1.

Tu línea 1 inconsciente investiga profundamente sin que te des cuenta. Acumulás conocimiento, buscás fundamentos, necesitás entender el por qué detrás de todo. Esta base invisible es lo que te permite cumplir con las proyecciones de la línea 5 de forma consistente.

La combinación crea al líder que realmente sabe de lo que habla. No vendés humo; vendés sustancia investigada. Cuando la gente proyecta su esperanza en vos y vos tenés la base para responder, tu impacto es transformador.

Tu campo de acción es transpersonal — podés impactar a personas que nunca conociste. Esto viene con la responsabilidad de que tu reputación te precede. Cada interacción donde cumplís fortalece la proyección positiva; cada una donde fallás la daña.

Tu desafío es elegir tus batallas. No todas las proyecciones son para vos. Discernir cuándo tu base investigativa realmente tiene la solución y cuándo no, es crucial para proteger tu reputación y tu energía.`,

  "5/2": `El perfil 5/2 es el Hereje/Ermitaño. Combinás la proyección pública de la línea 5 con el talento natural e introvertido de la línea 2.

Tu línea 5 consciente atrae expectativas y proyecciones. Sos percibido como alguien que puede resolver problemas a escala. La gente busca en vos respuestas prácticas y universalizables.

Tu línea 2 inconsciente tiene dones naturales que ejerce mejor en soledad. Hay algo que hacés con facilidad extraordinaria pero que preferís hacer sin audiencia, sin presión, sin explicar cómo lo hacés.

La combinación crea una tensión productiva: te proyectan como líder público (línea 5) pero tu genio opera mejor en privado (línea 2). La solución no es elegir uno; es diseñar una vida donde podés retirarte a hacer lo tuyo y luego emerger con soluciones que satisfagan la proyección.

Tu desafío es que la línea 5 te expone constantemente. La gente te busca, te llama, te necesita. Pero tu creatividad y tu don necesitan espacio protegido. Establecer límites claros entre tu tiempo de ermitaño y tu tiempo público es esencial.`,

  "6/2": `El perfil 6/2 es el Modelo a Seguir/Ermitaño. Combinás las tres fases vitales de la línea 6 con los dones naturales e introvertidos de la línea 2.

Tu línea 6 consciente te lleva por un viaje de vida en tres actos. Primera fase (~hasta 30): experimentación intensa donde probás todo. Segunda fase (~30-50): retiro al techo para observar y procesar. Tercera fase (50+): bajás como modelo a seguir con la sabiduría de haber vivido y observado.

Tu línea 2 inconsciente tiene talentos innatos que ni siquiera reconocés. Hacés cosas naturalmente que otros admiran y quieren aprender. Tu instinto es no hacer show de ello; simplemente lo hacés.

La combinación crea a alguien cuya sabiduría madura naturalmente con el tiempo (línea 6) y cuyo talento es genuino e inconfundible (línea 2). En la tercera fase, cuando finalmente bajás del techo, lo que ofrecés no es performativo — es auténtico y profundamente personal.

Tu desafío es la segunda fase, donde el retiro natural de la línea 6 se amplifica con la introversión de la línea 2. Podés sentirte muy aislado. Necesitás personas de confianza que te llamen afuera cuando es momento de compartir tu don, sin forzarte ni presionarte.`,

  "6/3": `El perfil 6/3 es el Modelo a Seguir/Mártir. Combinás las tres fases de vida de la línea 6 con el aprendizaje por experiencia directa de la línea 3.

Tu línea 6 consciente busca un ideal. Hay una visión de cómo deberían ser las cosas — relaciones, trabajo, vida — que te acompaña siempre. En la primera fase vivís intensamente buscando ese ideal; en la segunda observás desde arriba procesando lo vivido; en la tercera bajás como modelo encarnando lo que aprendiste.

Tu línea 3 inconsciente rompe cosas constantemente. No por sabotaje sino por diseño: necesitás descubrir qué funciona descartando lo que no. Esto hace que tu primera fase sea particularmente intensa — experimentación 6 + ruptura 3 = una montaña rusa.

La combinación crea al modelo a seguir más empírico. No sos un gurú de torre de marfil; sos alguien que se ensució las manos, se cayó, se levantó, y ahora puede guiar porque sabe exactamente cómo se siente cada paso del camino.

Tu desafío principal es la primera fase. La combinación de idealismo (línea 6) con ruptura constante (línea 3) puede generar desilusión profunda. Recordar que cada experiencia es materia prima para el modelo que serás es crucial para no abandonar el proceso.`,
};

// ─── Definition Descriptions (5) ─────────────────────────────────────────────
// Keys match Spanish values from extraction-service HD_DEFINITION_MAP

export const DEFINITION_DESCRIPTIONS: Record<string, string> = {
  "Definición simple": `Tenés Definición Simple, lo que significa que todos tus centros definidos están conectados entre sí en un solo circuito continuo. No hay separación interna en tu diseño.

Esto te da una consistencia energética notable. Tu energía fluye sin interrupciones internas — lo que sentís, lo expresás; lo que decidís, lo ejecutás. No necesitás a otra persona para sentirte completo; tu circuito interno es auto-suficiente.

En la práctica, esto significa que tendés a ser más independiente en tu proceso. No necesitás esperar a que alguien "cierre el circuito" por vos. Podés procesar, decidir y actuar dentro de tu propio campo energético.

Tu desafío es entender que otros no funcionan así. Personas con definiciones divididas necesitan tiempo, personas, o espacios específicos para conectar sus partes. Tu fluidez natural puede hacerte impaciente con procesos que a otros les toman más tiempo.`,

  "Definición dividida": `Tenés Definición Dividida (Split), lo que significa que tus centros definidos forman dos grupos separados que no están conectados directamente entre sí. Hay un "puente" que falta.

Esto crea una dualidad interna. Tenés dos "personalidades" o modos de operar que no siempre se comunican fluidamente. A veces sentís un tirón interno, como si una parte de vos quisiera algo y otra quisiera lo opuesto.

El puente se cierra de tres maneras: a través de otra persona cuyo diseño active los gates que te faltan, a través de tránsitos planetarios que temporalmente cierran el circuito, o a través de ambientes donde la energía ambiental hace de puente.

Tu tendencia natural es buscar personas que cierren tu split. Esto no es dependencia; es mecánica. Pero es importante que el cierre venga como consecuencia de relaciones correctas, no como motivación para entrar en relaciones incorrectas.

En la práctica, te puede tomar más tiempo tomar decisiones porque necesitás que ambas partes de tu diseño estén de acuerdo. Darle espacio a ese proceso es respetar tu mecánica.`,

  "Definición triple dividida": `Tenés Definición Triple Dividida, lo que significa que tus centros definidos forman tres grupos separados, cada uno operando con su propia lógica interna.

Esto te da una versatilidad extraordinaria. Tres "mundos" internos que procesan la realidad desde ángulos diferentes, dándote una perspectiva multidimensional que pocas personas tienen.

Para conectar tus tres partes necesitás más estímulo externo que una definición simple o dividida. Generalmente necesitás estar en movimiento — social, físico, ambiental — para que las tres partes se activen y se comuniquen entre sí.

Tu proceso de decisión puede parecer lento o errático desde afuera, pero internamente es un proceso de triangulación: cada parte aporta su perspectiva y la decisión emerge cuando las tres coinciden. Necesitás tiempo y variedad de experiencias para llegar ahí.

Tu desafío es no confundir tu necesidad de estímulo con hiperactividad. No necesitás estar ocupado constantemente; necesitás que tu ambiente te ofrezca suficiente variedad para activar tus tres circuitos.`,

  "Definición cuádruple dividida": `Tenés Definición Cuádruple Dividida, la configuración más rara y compleja. Tus centros definidos forman cuatro grupos separados, cada uno con su propia dinámica interna.

Esto te convierte en un procesador extraordinario. Cuatro perspectivas internas que necesitan ser consultadas antes de que una decisión se sienta completa. Tu mente puede sentirse como un comité — y en cierto sentido, lo es.

Necesitás mucho input externo para que tus cuatro partes se conecten. Personas, ambientes, actividades, tránsitos — todo contribuye a cerrar temporalmente los puentes entre tus circuitos. Por esto, tendés a ser una persona muy social y activa, no por elección sino por necesidad mecánica.

Tu proceso de decisión es el más lento de todas las definiciones, y eso está bien. Tomarte el tiempo necesario para que tus cuatro partes procesen es respetar tu complejidad. Las decisiones apresuradas generalmente ignoran una o más de tus partes y generan conflicto interno después.

Tu don es la capacidad de ver las cosas desde cuatro ángulos simultáneamente. En roles de liderazgo, consultoría o mediación, esta perspectiva múltiple es invaluable.`,

  "Sin definición": `No tenés ningún centro definido, lo que corresponde al tipo Reflector. Tu diseño es completamente abierto, sin circuitos fijos, sin motor constante, sin forma energética permanente.

Esto no es ausencia; es apertura total. Sos un espejo del universo que te rodea. Cada día, cada persona, cada ambiente te configura de forma diferente. No tenés una energía "propia" en el sentido fijo — tenés la capacidad de experimentar TODAS las energías.

Tu relación con el entorno es más importante que para cualquier otro tipo de definición. Donde estés, con quién estés, literalmente define cómo te sentís y cómo operás ese día. Elegir tu ambiente es tu acto de poder más grande.

Tu proceso de decisión está gobernado por el ciclo lunar. Necesitás 28 días para experimentar una decisión desde todas las perspectivas posibles antes de comprometerte. Esto no es lentitud; es thoroughness existencial.

Tu don es la objetividad radical. Porque no tenés forma fija, podés evaluar personas, ambientes y situaciones sin sesgo energético. Sos el evaluador más confiable del sistema — siempre y cuando te des el tiempo de completar tu ciclo antes de declarar tu veredicto.`,
};

// ─── Channel Descriptions (36) ───────────────────────────────────────────────
// Keys match channel IDs from HD_CHANNELS in hd-channels.ts

export const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  "1-8": `El Canal de la Inspiración conecta el Centro G (puerta 1, la autoexpresión creativa) con la Garganta (puerta 8, la contribución). Es un canal individual que te da la capacidad de expresar creatividad única que inspira a otros sin intentarlo deliberadamente. Tu proceso creativo es profundamente personal — creás desde tu propia verdad y eso, paradójicamente, es lo que resuena con los demás. No necesitás adaptarte; necesitás ser auténtico.`,

  "2-14": `El Canal del Pulso conecta el Centro Sacral (puerta 14, el poder de la riqueza) con el Centro G (puerta 2, la dirección del ser). Es un canal sacral que te da una capacidad natural para generar recursos abundantes cuando seguís tu dirección correcta. Tu energía para el trabajo está directamente vinculada a tu sentido de dirección — cuando sabés hacia dónde vas, la energía y los recursos fluyen.`,

  "3-60": `El Canal de la Mutación conecta el Sacral (puerta 3, el ordenamiento) con la Raíz (puerta 60, la limitación). Es un canal individual que pulsa entre orden y caos, generando mutaciones que empujan a la evolución. Vivís ciclos donde todo parece estable y de repente algo se rompe para reorganizarse en una forma nueva. Esta mecánica puede ser incómoda pero es profundamente creativa — sos agente de cambio.`,

  "4-63": `El Canal de la Lógica conecta el Ajna (puerta 4, la formulación mental) con la Cabeza (puerta 63, la duda). Es un canal colectivo lógico que te da la capacidad de formular respuestas a preguntas que surgen de la duda constructiva. Tu mente busca patrones, formula hipótesis, y necesita verificar antes de compartir. No sos dogmático; sos un cuestionador que busca certeza lógica.`,

  "5-15": `El Canal del Ritmo conecta el Sacral (puerta 5, los patrones fijos) con el Centro G (puerta 15, los extremos). Te da un flujo rítmico que puede acomodar toda la gama de comportamientos humanos. Tenés la capacidad de establecer ritmos naturales — rutinas, horarios, ciclos — y al mismo tiempo ser extremadamente adaptable cuando la vida lo requiere. Tu ritmo personal es magnético.`,

  "6-59": `El Canal de Mating conecta el Plexo Solar (puerta 6, la fricción emocional) con el Sacral (puerta 59, la sexualidad y dispersión). Es un canal reproductivo y relacional que genera intimidad a través del contacto emocional. Tu capacidad de crear vínculos íntimos es poderosa pero también requiere discernimiento — no toda conexión emocional-sexual merece tu energía. La puerta 6 actúa como filtro.`,

  "7-31": `El Canal del Alfa conecta el Centro G (puerta 7, el rol del líder) con la Garganta (puerta 31, la influencia democrática). Es un canal colectivo que te da liderazgo natural a través de la voz. No liderás imponiendo; liderás articulando dirección de forma que otros eligen seguir. Tu autoridad como líder viene de ser reconocido, no de autoproclamarte.`,

  "9-52": `El Canal de la Concentración conecta el Sacral (puerta 9, el enfoque en el detalle) con la Raíz (puerta 52, la quietud). Te da una capacidad extraordinaria de concentración sostenida. Podés mantener el foco en detalles durante períodos largos con una disciplina que otros envidian. La clave es que esa concentración sea en respuesta a algo que tu sacral diga sí — forzarla en lo incorrecto es tortura.`,

  "10-20": `El Canal del Despertar conecta el Centro G (puerta 10, el amor al ser) con la Garganta (puerta 20, la contemplación en el ahora). Es un canal individual de integración que te permite ser auténticamente vos mismo en cada momento. Cuando hablás o actuás, lo hacés desde un lugar de auto-aceptación radical. Tu autenticidad despierta algo en otros — no porque prediques sino porque encarnás.`,

  "10-34": `El Canal de la Exploración conecta el Centro G (puerta 10, el amor al ser) con el Sacral (puerta 34, el poder). Es un canal de integración que te da una energía sacral enorme para explorar y expresar tu individualidad. Tenés fuerza vital para ser vos mismo contra viento y marea. Tu poder personal es magnético pero asexuado — es poder de ser, no de hacer.`,

  "10-57": `El Canal del Perfeccionismo conecta el Centro G (puerta 10, el amor al ser) con el Bazo (puerta 57, la intuición). Te da una intuición exquisita sobre cómo ser vos mismo de la forma más perfecta posible en cada momento. Sentís intuitivamente cuándo estás siendo auténtico y cuándo estás actuando. Esta sensibilidad es tu guía hacia una vida progresivamente más alineada.`,

  "11-56": `El Canal de la Curiosidad conecta el Ajna (puerta 11, las ideas) con la Garganta (puerta 56, la estimulación a través de historias). Es un canal colectivo abstracto que te convierte en un contador de historias nato. Tu mente genera ideas constantemente y tu Garganta las convierte en narrativas que estimulan e inspiran. No necesitás que tus ideas sean prácticas; necesitás que sean interesantes.`,

  "12-22": `El Canal de la Apertura conecta la Garganta (puerta 12, la cautela social) con el Plexo Solar (puerta 22, la gracia emocional). Es un canal individual emocional que te da la capacidad de expresar emociones de formas que transforman a otros. Tu expresión emocional — a través del arte, la palabra, el gesto — tiene una cualidad mutativa. Pero necesitás esperar el momento correcto; no todas las olas emocionales merecen expresión pública.`,

  "13-33": `El Canal del Testimonio conecta el Centro G (puerta 13, el escucha) con la Garganta (puerta 33, el retiro y la memoria). Es un canal colectivo que te hace un recopilador natural de experiencias. Escuchás profundamente las historias de otros, las almacenás, y eventualmente las compartís como testimonio. Tu rol es preservar la memoria colectiva y extraer sabiduría de la experiencia acumulada.`,

  "16-48": `El Canal de la Longitud de Onda conecta la Garganta (puerta 16, el entusiasmo por la maestría) con el Bazo (puerta 48, la profundidad). Te da la capacidad de dominar habilidades con profundidad y expresarlas con entusiasmo contagioso. Tu camino es la práctica repetida hasta la maestría — no por disciplina forzada sino por el placer genuino de profundizar en lo que te apasiona.`,

  "17-62": `El Canal de la Aceptación conecta el Ajna (puerta 17, las opiniones) con la Garganta (puerta 62, los detalles). Es un canal colectivo lógico que te permite articular opiniones fundamentadas con precisión de detalle. Tu mente organiza información en patrones lógicos y tu Garganta los expresa con exactitud. Sos el que explica las cosas de forma que otros finalmente entienden.`,

  "18-58": `El Canal de la Corrección conecta el Bazo (puerta 18, el juicio correctivo) con la Raíz (puerta 58, la vitalidad y alegría). Te da un impulso natural de corregir y mejorar lo que encontrás imperfecto. No es criticismo vacío; es un amor genuino por la excelencia que, cuando se canaliza correctamente, mejora todo lo que toca. Tu desafío es que no todos quieren ser corregidos.`,

  "19-49": `El Canal de la Síntesis conecta la Raíz (puerta 19, la necesidad de recursos) con el Plexo Solar (puerta 49, los principios y la revolución). Es un canal tribal emocional que vincula necesidades básicas con principios. Cuando las necesidades de tu tribu no se satisfacen, tu ola emocional puede generar revolución — el impulso de cambiar las reglas del juego. Sos sensible a la injusticia en el acceso a recursos.`,

  "20-34": `El Canal de Carisma conecta la Garganta (puerta 20, el ahora) con el Sacral (puerta 34, el poder). Es un canal de integración que te da la capacidad de actuar con poder puro en el momento presente. Tu respuesta sacral se expresa inmediatamente a través de la acción — no hay delay entre sentir y hacer. Esto te da un carisma de acción: la gente te ve hacer y quiere seguirte.`,

  "20-57": `El Canal de la Mente Cerebral conecta la Garganta (puerta 20, la contemplación) con el Bazo (puerta 57, la intuición). Te da la capacidad de articular insights intuitivos en tiempo real. Tu intuición no se queda en sensación vaga; se convierte en palabra. Podés decir exactamente lo correcto en el momento exacto porque tu Bazo y tu Garganta operan en sincronía instantánea.`,

  "21-45": `El Canal del Dinero conecta el Corazón (puerta 21, el control) con la Garganta (puerta 45, el rey/reina). Es un canal tribal que te da autoridad natural sobre recursos materiales. Tenés una relación innata con el poder, el dinero y la gestión. Tu voz tiene un tono de autoridad que otros reconocen — cuando decís "esto es mío" o "yo manejo esto", la gente lo acepta.`,

  "23-43": `El Canal de la Estructuración conecta la Garganta (puerta 23, la asimilación) con el Ajna (puerta 43, el insight). Es un canal individual que te da la capacidad de estructurar ideas revolucionarias y expresarlas de forma que otros puedan asimilar. Tus insights vienen como relámpagos — entendimientos completos que aparecen de la nada. El desafío es encontrar el momento correcto para compartirlos.`,

  "24-61": `El Canal del Conocimiento conecta el Ajna (puerta 24, la racionalización) con la Cabeza (puerta 61, el misterio interior). Es un canal individual que te da un proceso mental que oscila entre el misterio y la comprensión. Tu mente trabaja en ciclos: inspiración misteriosa → procesamiento → insight racionalizado. No podés forzar el proceso; la comprensión llega cuando está lista.`,

  "25-51": `El Canal de la Iniciación conecta el Centro G (puerta 25, el espíritu universal del amor) con el Corazón (puerta 51, el shock competitivo). Es un canal individual que te da la capacidad de iniciar a otros en experiencias transformadoras a través del shock. Tu presencia puede ser disruptiva — no por malicia sino porque tu energía desafía el status quo y empuja a otros hacia su individualidad.`,

  "26-44": `El Canal de la Transmisión conecta el Corazón (puerta 26, el tramposo/negociador) con el Bazo (puerta 44, el instinto de reconocer talento). Es un canal tribal que te convierte en un negociador nato con instinto para el talento. Sabés intuitivamente qué vale y qué no, quién tiene potencial y quién no. Tu capacidad de "vender" no es manipulación; es reconocer y comunicar valor genuino.`,

  "27-50": `El Canal de la Preservación conecta el Sacral (puerta 27, el cuidado) con el Bazo (puerta 50, los valores tribales). Es un canal tribal que te da un instinto poderoso de cuidar y preservar. Cuidás a tu tribu, tus valores, las cosas que importan — con una energía sacral sostenida que no se agota mientras esté alineada. Tu presencia es nutritiva y estabilizadora para quienes te rodean.`,

  "28-38": `El Canal de la Lucha conecta el Bazo (puerta 28, el jugador que busca propósito) con la Raíz (puerta 38, la lucha por el propósito individual). Es un canal individual que te da la tenacidad para luchar por lo que tiene sentido para vos. No luchás por todo; luchás por propósito. Cuando encontrás algo que vale la pena, tu determinación es inquebrantable. El desafío es no luchar batallas que ya no tienen significado.`,

  "29-46": `El Canal del Descubrimiento conecta el Sacral (puerta 29, el compromiso sacral) con el Centro G (puerta 46, la determinación del ser). Te da la capacidad de decir sí con todo tu ser y descubrir tu propósito a través del compromiso. Cada sí sacral correcto te lleva más cerca de tu dirección de vida. El riesgo es decir sí a demasiado — tu sacral puede comprometerse antes de que tu autoridad valide.`,

  "30-41": `El Canal del Reconocimiento conecta el Plexo Solar (puerta 30, los deseos ardientes) con la Raíz (puerta 41, la fantasía y el nuevo comienzo). Es un canal colectivo emocional que te da la capacidad de sentir deseos intensos por nuevas experiencias. Tus emociones oscilan entre el deseo apasionado y la melancolía de lo no vivido. Este canal alimenta la creatividad humana — la necesidad de experimentar más.`,

  "32-54": `El Canal de la Transformación conecta el Bazo (puerta 32, la continuidad) con la Raíz (puerta 54, la ambición). Es un canal tribal que te da ambición con instinto. No perseguís metas al azar; tu Bazo te indica intuitivamente cuáles transformaciones son viables y cuáles no. Tu ambición es pragmática, fundamentada en la supervivencia y el instinto de lo que puede perdurar.`,

  "35-36": `El Canal de lo Transitorio conecta la Garganta (puerta 35, el progreso a través de la experiencia) con el Plexo Solar (puerta 36, la crisis emocional como catalizador). Es un canal colectivo emocional que te impulsa a buscar nuevas experiencias constantemente. Cada experiencia genera una ola emocional — excitación, crisis, resolución — y de ese ciclo extraés sabiduría que compartís. Sos el aventurero emocional.`,

  "37-40": `El Canal de la Comunidad conecta el Plexo Solar (puerta 37, la amistad y los acuerdos) con el Corazón (puerta 40, la voluntad solitaria). Es un canal tribal que define la dinámica de dar y recibir en comunidad. Establecés acuerdos emocionales con tu tribu: yo doy esto, vos das aquello. Cuando los acuerdos se respetan, hay armonía tribal. Cuando se rompen, la ola emocional es intensa.`,

  "39-55": `El Canal de la Emoción conecta la Raíz (puerta 39, la provocación) con el Plexo Solar (puerta 55, la abundancia espiritual). Es un canal individual emocional que genera estados de ánimo que oscilan entre la melancolía profunda y el éxtasis. Tu espíritu provoca emociones en otros — a veces deliberadamente, a veces sin querer. Esta capacidad de mover el espíritu de otros es un don creativo poderoso.`,

  "42-53": `El Canal de la Madurez conecta el Sacral (puerta 42, la conclusión) con la Raíz (puerta 53, los nuevos comienzos). Es un canal colectivo que completa ciclos. Tu energía está diseñada para llevar las cosas a su conclusión natural, no abandonarlas a medio camino. Cuando empezás algo, hay una presión interna de terminarlo. Esta capacidad de cierre es rara y valiosa en un mundo de proyectos inconclusos.`,

  "47-64": `El Canal de la Abstracción conecta el Ajna (puerta 47, la realización mental) con la Cabeza (puerta 64, la confusión antes del entendimiento). Es un canal colectivo abstracto que procesa experiencias pasadas hasta encontrarles sentido. Tu mente revisa memorias, sueños, experiencias — en un proceso que puede sentirse caótico hasta que de repente todo cobra sentido. El "ajá" viene después de la confusión, no en lugar de ella.`,

  "34-57": `El Canal del Poder conecta el Sacral (puerta 34, el poder puro) con el Bazo (puerta 57, la intuición). Es un canal de integración que combina poder sacral con intuición esplénica. Tu cuerpo sabe antes que tu mente y tiene la fuerza para actuar inmediatamente sobre ese conocimiento. Es un canal de supervivencia primordial — la combinación más potente de instinto y acción del sistema.`,
};

// ─── Center Undefined Descriptions (9) ───────────────────────────────────────
// Keys match canonical English center names

export const CENTER_UNDEFINED_DESCRIPTIONS: Record<string, string> = {
  Head: `Tu Centro de la Cabeza está indefinido, lo que significa que amplificás la presión mental del ambiente. Las preguntas, dudas e inspiraciones de otros entran en tu campo y se sienten como propias — más grandes, más urgentes, más fascinantes de lo que realmente son.

Tu sabiduría potencial es distinguir qué preguntas son tuyas y cuáles absorbiste del ambiente. No todas las dudas que sentís merecen tu atención. Aprender a soltar preguntas que no te pertenecen libera una cantidad enorme de energía mental.

El condicionamiento del no-ser es pensar que necesitás responder todas las preguntas. La Cabeza abierta puede pasar horas investigando cosas que no tienen relevancia real para tu vida, simplemente porque la presión mental se siente urgente. La pregunta clave: "¿Esta pregunta es realmente mía?"`,

  Ajna: `Tu Centro Ajna está indefinido, lo que significa que no tenés una forma fija de procesar información. Podés pensar de múltiples maneras, ver las cosas desde muchos ángulos, y cambiar de opinión con facilidad.

Tu sabiduría potencial es la flexibilidad mental. Donde otros están atrapados en una forma de pensar, vos podés ver alternativas. Esto te hace excelente para mediar, brainstormear, y encontrar soluciones que mentes fijas no pueden ver.

El condicionamiento del no-ser es pretender tener certeza mental cuando no la tenés. La presión social de "saber lo que pensás" puede llevarte a adoptar opiniones ajenas como propias. Tu don es la mente abierta; disfrazarla de certeza te quita poder.`,

  Throat: `Tu Centro de la Garganta está indefinido, lo que significa que no tenés una forma fija de expresarte o manifestar. Tu voz, tu timing, tu forma de comunicar cambian según con quién estés y qué energía haya en el ambiente.

Tu sabiduría potencial es reconocer cuándo es momento de hablar y cuándo no. Podés sentir la dinámica comunicativa de un grupo con una sensibilidad que los Garganta definidos no tienen. Sabés quién necesita ser escuchado y cuándo el silencio dice más que las palabras.

El condicionamiento del no-ser es hablar para llamar la atención. La Garganta indefinida puede sentir presión de hablar, de ser vista, de manifestar — incluso cuando no hay nada genuino que expresar. La práctica es esperar a que la expresión venga naturalmente en lugar de forzarla.`,

  G: `Tu Centro G está indefinido, lo que significa que tu sentido de identidad y dirección no es fijo. No tenés un "yo soy" permanente ni una dirección de vida constante — y eso es tu superpoder, no tu debilidad.

Tu sabiduría potencial es la capacidad de ser cualquiera en cualquier lugar. Experimentás la identidad de forma fluida, lo que te da una empatía profunda y la capacidad de conectar con personas muy diversas. Podés estar en cualquier ambiente y sentirlo como propio — temporalmente.

El condicionamiento del no-ser es aferrarte a una identidad fija o buscar desesperadamente tu "propósito de vida". Tu propósito no es fijo; es relacional. Cambia según dónde estés y con quién. Elegir ambientes y personas que te sientan bien es tu forma de navegar — el lugar correcto y las personas correctas te dan dirección.`,

  Heart: `Tu Centro Corazón/Ego está indefinido, lo que significa que no tenés acceso constante a la fuerza de voluntad. Tu capacidad de comprometerte y sostener promesas fluctúa según la energía disponible en tu ambiente.

Tu sabiduría potencial es saber cuándo la fuerza de voluntad es genuina y cuándo es bravuconería. Podés sentir la diferencia entre alguien que realmente va a cumplir y alguien que promete en vacío. Esta sensibilidad al compromiso ajeno es valiosa.

El condicionamiento del no-ser es sobre-prometer. La presión de demostrar tu valor, de probar que podés, de competir — todo esto viene del Corazón indefinido amplificando la energía de voluntad ajena. No necesitás probar nada. Tu valor no depende de cuánto logras por fuerza de voluntad.`,

  Spleen: `Tu Centro del Bazo está indefinido, lo que significa que no tenés un sistema inmunológico y de intuición constante. Tu sentido de bienestar, seguridad y timing instintivo varía según el ambiente.

Tu sabiduría potencial es una sensibilidad extraordinaria a la salud y el bienestar — propio y ajeno. Podés sentir cuando algo no está bien en un ambiente, en una persona, en una situación, con más intensidad que los Bazo definidos. Amplificás las señales de alerta.

El condicionamiento del no-ser es aferrarte a lo que no es sano por miedo al cambio. El Bazo indefinido puede tolerar situaciones, relaciones o hábitos que lo enferman porque el miedo a soltar es más fuerte que la incomodidad de quedarse. Aprender a soltar lo que no te hace bien es tu práctica central.`,

  Sacral: `Tu Centro Sacral está indefinido, lo que significa que no tenés acceso constante a la energía vital de trabajo y reproducción. No sos un motor incansable; sos un amplificador de la energía sacral ajena.

Tu sabiduría potencial es saber cuándo hay suficiente energía y cuándo no. Podés sentir la vitalidad de un grupo, de un proyecto, de una relación, con una claridad que los sacrales definidos no tienen. Sabés cuándo algo tiene vida y cuándo está muerto.

El condicionamiento del no-ser es no saber cuándo parar. Cuando estás rodeado de sacrales definidos, amplificás su energía y sentís que podés seguir para siempre. Pero esa energía no es tuya — cuando te separás, colapsa. Aprender a irte antes de agotarte es esencial. Necesitás dormir solo o al menos tener tiempo en cama sin energía sacral ajena para descargarte.`,

  SolarPlexus: `Tu Centro del Plexo Solar está indefinido, lo que significa que amplificás las emociones del ambiente. Sentís lo que otros sienten — pero más grande, más intenso, más abrumador.

Tu sabiduría potencial es la empatía emocional profunda. Podés leer el clima emocional de una habitación instantáneamente. Sabés quién está triste, quién está enojado, quién está fingiendo. Esta sensibilidad es un don extraordinario para terapeutas, coaches, artistas, y cualquier rol que requiera sintonía emocional.

El condicionamiento del no-ser es confundir las emociones ajenas con las propias y evitar conflicto a toda costa. El Plexo Solar indefinido absorbe tensión emocional y la experimenta amplificada, lo que puede generar una aversión al conflicto que te lleva a complacer, ceder, y tragarte tus verdades. La práctica es preguntar: "¿Esta emoción es mía o la estoy amplificando?"`,

  Root: `Tu Centro Raíz está indefinido, lo que significa que amplificás la presión adrenalínica del ambiente. La urgencia de otros se siente como tu urgencia — y generalmente más intensa.

Tu sabiduría potencial es distinguir presión genuina de presión amplificada. No todo es urgente aunque tu cuerpo lo sienta así. Podés aprender a usar la presión como combustible sin ser controlado por ella — elegir cuándo acelerar y cuándo soltar.

El condicionamiento del no-ser es vivir en modo urgencia permanente, intentando liberarte de una presión que no es tuya terminando tareas compulsivamente. La Raíz indefinida puede ser adicta al estrés sin saberlo — confundiendo la adrenalina con productividad. La práctica es detenerte y preguntar: "¿Realmente necesito hacer esto ahora, o estoy respondiendo a presión que no es mía?"`,
};

// ─── Variable Descriptions ───────────────────────────────────────────────────

export const DIGESTION_DESCRIPTIONS: Record<string, string> = {
  "Paz y Quietud": `Tu digestión óptima es en paz y quietud. Tu cuerpo procesa mejor los alimentos cuando estás en un ambiente silencioso y tranquilo, sin estimulación externa. Comer solo, sin pantallas, sin conversación intensa, sin ruido de fondo, permite que tu sistema digestivo funcione en su máxima capacidad. No es solo una preferencia; es una mecánica de tu diseño que afecta tu energía y claridad mental.`,

  "Sed caliente": `Tu digestión óptima se activa con bebidas y alimentos calientes. Tu sistema funciona mejor cuando la temperatura de lo que ingerís es elevada. Sopas, tés, comidas cocidas a temperatura alta — todo esto facilita tu proceso digestivo. Prestá atención a cómo te sentís después de comidas calientes vs frías; la diferencia energética puede ser notable.`,

  "Sed fría": `Tu digestión óptima se activa con bebidas y alimentos fríos o a temperatura ambiente. Tu sistema procesa mejor cuando lo que ingerís no está caliente. Ensaladas, frutas, bebidas frías, comida a temperatura ambiente — todo esto facilita tu digestión. Experimentá reduciendo comidas muy calientes y observá el impacto en tu energía y bienestar.`,

  "Gusto abierto": `Tu digestión óptima requiere variedad. Tu sistema funciona mejor cuando experimentás sabores diversos en cada comida — no monótonos. Platos con múltiples ingredientes, combinaciones de sabores, cocinas diversas. Tu paladar necesita estimulación variada para que el proceso digestivo se active completamente.`,

  "Gusto cerrado": `Tu digestión óptima requiere simplicidad. Tu sistema funciona mejor con sabores puros y definidos, sin mezclas complejas. Platos simples con pocos ingredientes, sabores claros y distinguibles. Tu cuerpo procesa mejor cuando puede identificar qué está digiriendo sin confusión gustativa.`,

  "Sonido alto": `Tu digestión óptima se activa en ambientes con sonido. Música, conversación, ruido de fondo — tu sistema digestivo funciona mejor cuando hay estimulación auditiva. Comer en silencio total puede dificultar tu digestión. Encontrá el nivel de sonido que te hace sentir más cómodo durante las comidas.`,

  "Sonido bajo": `Tu digestión óptima requiere ambiente sonoro bajo o silencioso. A diferencia del sonido alto, tu sistema funciona mejor sin mucha estimulación auditiva durante las comidas. Un ambiente tranquilo, quizás con música suave, sin conversaciones intensas ni ruidos fuertes, facilita tu proceso digestivo.`,

  "Luz directa": `Tu digestión óptima se activa con luz directa. Comer bajo luz brillante — luz natural del sol, iluminación directa — facilita tu proceso digestivo. Tu cuerpo responde positivamente a ambientes luminosos durante las comidas. Prestá atención a cómo te sentís comiendo al sol vs en ambientes oscuros.`,

  "Luz indirecta": `Tu digestión óptima se activa con luz indirecta o tenue. Comer bajo luz suave, difusa, quizás con velas o luz ambiental, facilita tu proceso digestivo. Ambientes muy brillantes durante las comidas pueden interferir con tu digestión. Tu sistema prefiere la suavidad lumínica para procesar los alimentos.`,
};

export const ENVIRONMENT_DESCRIPTIONS: Record<string, string> = {
  Costas: `Tu ambiente óptimo es Costas — lugares donde la tierra se encuentra con el agua. Playas, riberas, puertos, cualquier zona liminal entre elementos. Tu cuerpo y tu mente funcionan mejor en estos espacios de transición. Si no vivís cerca del agua, buscá ambientes que simulen esa cualidad: espacios abiertos con horizontes, bordes entre zonas diferentes, lugares donde algo termina y algo comienza.`,

  Cuevas: `Tu ambiente óptimo es Cuevas — espacios cerrados, contenidos, protegidos. Tu cuerpo funciona mejor cuando te sentís envuelto por el espacio: techos bajos, rincones acogedores, habitaciones pequeñas. No es claustrofobia invertida; es necesidad genuina de contención. Tu mejor trabajo y tus mejores decisiones suceden en espacios que se sienten como refugio.`,

  Mercados: `Tu ambiente óptimo es Mercados — espacios de intercambio activo con mucha gente y estímulo. Ferias, centros comerciales, plazas, coworkings bulliciosos. Tu energía se activa en ambientes donde hay movimiento humano, transacciones, diversidad. El aislamiento te apaga; la actividad comercial y social te enciende.`,

  Cocinas: `Tu ambiente óptimo es Cocinas — espacios donde se transforma materia prima en algo nuevo. No necesariamente una cocina literal; puede ser un taller, un estudio, un laboratorio. Lo que necesitás es un espacio de transformación activa donde las cosas se crean, se mezclan, se cocinan. Tu mejor trabajo sucede donde hay proceso de creación tangible.`,

  Montañas: `Tu ambiente óptimo es Montañas — espacios elevados con perspectiva amplia. Pisos altos, colinas, miradores, cualquier lugar donde podés ver desde arriba. Tu claridad mental y tu bienestar físico mejoran con la altura y la vista panorámica. Si vivís en planicie, buscá espacios elevados — un último piso, una terraza, un balcón con vista abierta.`,

  Valles: `Tu ambiente óptimo es Valles — espacios bajos, protegidos entre elevaciones. Tu cuerpo funciona mejor en lugares resguardados, no expuestos, rodeados de estructura natural o arquitectónica que te contenga sin encerrarte. Barrios entre edificios, valles geográficos, jardines hundidos, espacios que combinan protección con apertura.`,
};

export const STRONGEST_SENSE_DESCRIPTIONS: Record<string, string> = {
  Sentir: `Tu sentido más fuerte es Sentir — una percepción emocional-energética que va más allá de los cinco sentidos físicos. Percibís el campo emocional de las personas y los espacios antes de que la información llegue a tus otros sentidos. Cuando "sentís" que algo está bien o mal, esa percepción es más confiable que lo que ves u oyes. Confiá en esa sensación como tu herramienta de navegación primaria.`,

  Tacto: `Tu sentido más fuerte es el Tacto. Procesás información primariamente a través del contacto físico — la textura, la temperatura, la presión. Necesitás tocar las cosas para entenderlas. En relaciones, el contacto físico te comunica más que las palabras. En trabajo, materiales tangibles te conectan más que pantallas. Honrar esta necesidad táctil mejora tu claridad y bienestar.`,

  Gusto: `Tu sentido más fuerte es el Gusto. Tu relación con los sabores es una herramienta de percepción que va más allá de la comida. "Tengo buen gusto" para vos no es metáfora; es literal. Tu capacidad de discernir calidad, autenticidad y valor se canaliza a través del gusto — en lo que comés, en lo que elegís, en lo que recomendás. Tu paladar es tu brújula estética.`,

  Olfato: `Tu sentido más fuerte es el Olfato. Percibís información a través de olores que otros ni registran. "Me huele bien" o "me huele mal" son literales para vos — tu nariz te dice la verdad sobre personas, lugares y situaciones antes que tu mente. Los ambientes con olores que te agradan potencian tu claridad; los que no, te nublan. Confiá en lo que tu nariz te dice.`,

  "Visión externa": `Tu sentido más fuerte es la Visión Externa — la percepción visual periférica y panorámica. Ves el panorama completo, los patrones en el espacio, lo que está en los márgenes. Tu inteligencia visual es amplia: captás la configuración total de una situación de un vistazo. Ambientes con buena iluminación y vistas abiertas potencian tu capacidad perceptiva.`,

  "Visión interna": `Tu sentido más fuerte es la Visión Interna — la capacidad de visualizar, imaginar, y ver con los ojos cerrados. Tu percepción más potente no viene de lo que ves afuera sino de lo que ves adentro: imágenes mentales, visualizaciones, sueños vívidos. Confiar en tus imágenes internas como información válida — no como fantasía — fortalece tu sistema de navegación.`,

  Sonido: `Tu sentido más fuerte es el Sonido. Percibís información primariamente a través de lo que escuchás — tono de voz, música, sonidos ambientales, silencios. Tu oído te dice la verdad: escuchás la mentira en un tono de voz, la autenticidad en una melodía, el peligro en un silencio. Ambientes sonoros que te nutren son esenciales para tu bienestar y tu claridad.`,
};
