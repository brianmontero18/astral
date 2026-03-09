/**
 * Human Design — Gate themes & Channel descriptions
 *
 * Used by TransitViewer to show contextual info when the user clicks a card.
 * Sourced from the I Ching hexagram names + HD interpretations.
 */

// ─── Gate Themes ────────────────────────────────────────────────────────────────

export interface GateTheme {
  name: string;
  theme: string;
}

export const GATE_THEMES: Record<number, GateTheme> = {
  1:  { name: "Lo Creativo",        theme: "Autoexpresión creativa. Energía para contribuir algo único e individual al mundo." },
  2:  { name: "Lo Receptivo",       theme: "Dirección interior. Receptividad natural que guía sin esfuerzo hacia el camino correcto." },
  3:  { name: "Ordenar",            theme: "Innovación y dificultad inicial. Energía mutativa que trae orden del caos." },
  4:  { name: "Formulación",        theme: "Pensamiento lógico. Mentalizar respuestas y soluciones posibles antes de actuar." },
  5:  { name: "Patrones Fijos",     theme: "Ritmos naturales. Esperar el momento correcto alineándose con ciclos universales." },
  6:  { name: "Fricción",           theme: "Intimidad emocional. Barrera protectora que se abre solo cuando hay claridad." },
  7:  { name: "El Rol del Yo",      theme: "Liderazgo democrático. Guiar a otros hacia el futuro a través del ejemplo." },
  8:  { name: "Contribución",       theme: "Hacer una contribución. Expresar la autenticidad individual al mundo." },
  9:  { name: "Enfoque",            theme: "Concentración y atención al detalle. Determinación para profundizar." },
  10: { name: "Comportamiento del Yo", theme: "Amor propio y autenticidad. La puerta del despertar y la conducta correcta." },
  11: { name: "Ideas",              theme: "Paz e imaginación. Ideas e imágenes conceptuales que buscan expresión." },
  12: { name: "Cautela",            theme: "Articulación que espera el momento correcto. Expresión social medida." },
  13: { name: "El Oyente",          theme: "Escuchar y recopilar experiencias. Guardar la memoria colectiva del grupo." },
  14: { name: "Habilidades de Poder", theme: "Administrar recursos con poder. Fertilidad y abundancia material." },
  15: { name: "Extremos",           theme: "Abrazar los extremos del comportamiento humano. Amor por la humanidad." },
  16: { name: "Habilidades",        theme: "Entusiasmo y experimentación. Perfeccionar talentos a través de la práctica." },
  17: { name: "Opiniones",          theme: "Organizar patrones observados. Compartir perspectivas lógicas fundamentadas." },
  18: { name: "Corrección",         theme: "Detectar lo que necesita ser corregido. Integridad y juicio instintivo." },
  19: { name: "Querer",             theme: "Sensibilidad a las necesidades materiales y espirituales de la comunidad." },
  20: { name: "El Ahora",           theme: "Estar presente y consciente en el momento. Contemplación activa." },
  21: { name: "El Cazador",         theme: "Control y voluntad para dirigir recursos. Morderse — tomar el control." },
  22: { name: "Gracia",             theme: "Expresión emocional elegante. Abrir puertas a través de la gracia social." },
  23: { name: "Asimilación",        theme: "Traducir conocimiento complejo en algo simple y comprensible." },
  24: { name: "Racionalización",    theme: "Retornar mentalmente. Revisar y reconceptualizar ideas una y otra vez." },
  25: { name: "Inocencia",          theme: "Amor universal sin expectativas. Aceptar lo inesperado con espíritu inocente." },
  26: { name: "El Acumulador",      theme: "Memoria del ego y persuasión. Acumular poder para el momento correcto." },
  27: { name: "Nutrición",          theme: "Cuidar y nutrir a otros. Responsabilidad por el bienestar de la tribu." },
  28: { name: "El Jugador",         theme: "Luchar por encontrar propósito y sentido. Arriesgarse por algo que importa." },
  29: { name: "Decir Sí",           theme: "Compromiso y perseverancia. La capacidad de entregarse completamente." },
  30: { name: "Deseo",              theme: "Intensidad emocional y pasión por la experiencia. Fuego que quema por vivir." },
  31: { name: "Influencia",         theme: "Liderar democráticamente. Influir a través de la palabra y el ejemplo." },
  32: { name: "Continuidad",        theme: "Instinto para reconocer lo que tiene valor duradero. Preservar lo esencial." },
  33: { name: "Retiro",             theme: "Recordar y compartir la sabiduría ganada por la experiencia vivida." },
  34: { name: "Poder",              theme: "Energía pura sacral disponible. El poder de lo grande en acción." },
  35: { name: "Progreso",           theme: "Buscar nuevas experiencias para crecer. Hambre de cambio y aventura." },
  36: { name: "Crisis",             theme: "Experiencia emocional intensa que lleva a la madurez y la sabiduría." },
  37: { name: "Amistad",            theme: "Crear comunidad a través de acuerdos emocionales. Lealtad tribal." },
  38: { name: "El Luchador",        theme: "Luchar por encontrar propósito individual. Oposición como camino." },
  39: { name: "El Provocador",      theme: "Provocar espíritu y emoción en otros para que despierten su fuego." },
  40: { name: "Entrega",            theme: "Soltarse después del esfuerzo. Descanso del ego y liberación." },
  41: { name: "Contracción",        theme: "Inicio de nuevos ciclos de experiencia. Fantasía y deseo de sentir." },
  42: { name: "Crecimiento",        theme: "Llevar las cosas a su conclusión natural. Completar lo que se empezó." },
  43: { name: "Insight",            theme: "Perspectiva interior única. Un conocimiento profundo que necesita ser escuchado." },
  44: { name: "Alerta",             theme: "Instinto para reconocer patrones del pasado. Memoria corporal." },
  45: { name: "El Rey/Reina",       theme: "Reunir recursos y distribuirlos al grupo. Liderazgo material." },
  46: { name: "Determinación",      theme: "Amor por el cuerpo y la experiencia física. Empujar hacia arriba." },
  47: { name: "Comprensión",        theme: "Hacer sentido del sinsentido aparente. Opresión que busca claridad." },
  48: { name: "Profundidad",        theme: "Profundidad de conocimiento. Miedo a la inadecuación que impulsa a prepararse." },
  49: { name: "Revolución",         theme: "Rechazar o aceptar basado en principios y sensibilidad emocional." },
  50: { name: "Valores",            theme: "Preservar valores y cuidar la tribu. Responsabilidad por las normas." },
  51: { name: "Shock",              theme: "Competitividad e iniciación a través del shock. El trueno que despierta." },
  52: { name: "Quietud",            theme: "Concentración y quietud como base. La montaña que no se mueve." },
  53: { name: "Comienzo",           theme: "Presión para comenzar nuevos ciclos. Desarrollo y maduración." },
  54: { name: "Ambición",           theme: "Ambición y transformación material. Impulso por ascender." },
  55: { name: "Espíritu",           theme: "Espíritu emocional y abundancia. Potencial de melancolía y éxtasis." },
  56: { name: "El Viajero",         theme: "Estimulación a través de contar historias. El narrador itinerante." },
  57: { name: "Intuición",          theme: "Claridad intuitiva en el momento presente. Lo suave que penetra." },
  58: { name: "Vitalidad",          theme: "Alegría de vivir y energía vital. La capacidad de corregir con gozo." },
  59: { name: "Sexualidad",         theme: "Romper barreras para la intimidad. Dispersión de las defensas." },
  60: { name: "Limitación",         theme: "Aceptar limitaciones como catalizador. Mutación a través de la restricción." },
  61: { name: "Misterio",           theme: "Presión mental para conocer lo desconocido. Verdad interior." },
  62: { name: "Detalles",           theme: "Expresar detalles y hechos con precisión. Lo pequeño que importa." },
  63: { name: "Duda",               theme: "Presión lógica para cuestionar. La duda como motor de investigación." },
  64: { name: "Confusión",          theme: "Resolución mental a través de la memoria. Antes de la finalización." },
};

// ─── Channel Descriptions ───────────────────────────────────────────────────────

export interface ChannelInfo {
  name: string;
  gates: [number, number];
  circuit: string;
  description: string;
}

// Names MUST match backend HD_CHANNELS exactly (hd-channels.ts)
export const CHANNEL_INFO: Record<string, ChannelInfo> = {
  // Individual
  "1-8":   { name: "Canal de Inspiración",          gates: [1, 8],   circuit: "Individual",  description: "Conecta la creatividad individual (G) con la expresión (Garganta). Energía para modelar el mundo con contribuciones únicas y auténticas." },
  "2-14":  { name: "Canal del Pulso",                gates: [2, 14],  circuit: "Individual",  description: "Conecta la dirección (G) con la energía sacral. Un motor poderoso que responde a lo que vale la pena con recursos ilimitados." },
  "3-60":  { name: "Canal de la Mutación",           gates: [3, 60],  circuit: "Individual",  description: "Conecta la innovación (Sacral) con la restricción (Raíz). Transformación profunda que nace de aceptar las limitaciones." },
  "12-22": { name: "Canal de la Apertura",           gates: [12, 22], circuit: "Individual",  description: "Conecta la expresión social (Garganta) con la gracia emocional (Plexo Solar). Comunicación elegante que toca el alma." },
  "23-43": { name: "Canal de la Estructuración",     gates: [23, 43], circuit: "Individual",  description: "Conecta la simplificación (Garganta) con el insight (Ajna). Traducir conocimiento profundo en palabras simples." },
  "24-61": { name: "Canal del Conocimiento",         gates: [24, 61], circuit: "Individual",  description: "Conecta la racionalización (Ajna) con el misterio (Cabeza). Presión mental para comprender verdades universales." },
  "28-38": { name: "Canal de la Lucha",              gates: [28, 38], circuit: "Individual",  description: "Conecta la búsqueda de propósito (Bazo) con la lucha individual (Raíz). Perseverancia para encontrar sentido en la vida." },
  "39-55": { name: "Canal de la Emoción",            gates: [39, 55], circuit: "Individual",  description: "Conecta la provocación (Raíz) con el espíritu (Plexo Solar). Ola emocional que alterna entre melancolía y éxtasis creativo." },
  // Colectivo
  "4-63":  { name: "Canal de la Lógica",             gates: [4, 63],  circuit: "Colectivo",   description: "Conecta la formulación (Ajna) con la duda (Cabeza). Presión mental para encontrar respuestas verificables." },
  "5-15":  { name: "Canal del Ritmo",                gates: [5, 15],  circuit: "Colectivo",   description: "Conecta los patrones (Sacral) con los extremos (G). Fluir con los ritmos naturales de la vida." },
  "7-31":  { name: "Canal del Alfa",                 gates: [7, 31],  circuit: "Colectivo",   description: "Conecta el liderazgo (G) con la influencia (Garganta). Guiar al grupo con visión democrática." },
  "9-52":  { name: "Canal de la Concentración",      gates: [9, 52],  circuit: "Colectivo",   description: "Conecta el enfoque (Sacral) con la quietud (Raíz). Determinación para concentrarse profundamente." },
  "11-56": { name: "Canal de la Curiosidad",         gates: [11, 56], circuit: "Colectivo",   description: "Conecta las ideas (Ajna) con las historias (Garganta). Buscar y compartir experiencias estimulantes." },
  "13-33": { name: "Canal del Testimonio",           gates: [13, 33], circuit: "Colectivo",   description: "Conecta el oyente (G) con el retiro (Garganta). Recopilar experiencias y compartir la sabiduría del pasado." },
  "16-48": { name: "Canal de la Longitud de Onda",   gates: [16, 48], circuit: "Colectivo",   description: "Conecta el entusiasmo (Garganta) con la profundidad (Bazo). Perfeccionar talentos con práctica y dominio." },
  "17-62": { name: "Canal de la Aceptación",         gates: [17, 62], circuit: "Colectivo",   description: "Conecta las opiniones (Ajna) con los detalles (Garganta). Expresar patrones lógicos organizados." },
  "29-46": { name: "Canal del Descubrimiento",       gates: [29, 46], circuit: "Colectivo",   description: "Conecta el compromiso (Sacral) con el cuerpo (G). Decir sí a experiencias que transforman." },
  "30-41": { name: "Canal del Reconocimiento",       gates: [30, 41], circuit: "Colectivo",   description: "Conecta el deseo (Plexo Solar) con la fantasía (Raíz). Presión emocional para vivir nuevas experiencias." },
  "35-36": { name: "Canal de lo Transitorio",        gates: [35, 36], circuit: "Colectivo",   description: "Conecta el progreso (Garganta) con la crisis (Plexo Solar). Crecer a través de experiencias emocionales intensas." },
  "42-53": { name: "Canal de la Madurez",            gates: [42, 53], circuit: "Colectivo",   description: "Conecta el crecimiento (Sacral) con los comienzos (Raíz). Completar ciclos desde el inicio hasta la maduración." },
  "47-64": { name: "Canal de la Abstracción",        gates: [47, 64], circuit: "Colectivo",   description: "Conecta la comprensión (Ajna) con la confusión (Cabeza). Resolver mentalmente el caos de las memorias." },
  // Tribal
  "6-59":  { name: "Canal de Mating",                gates: [6, 59],  circuit: "Tribal",      description: "Conecta la fricción emocional (Plexo Solar) con la sexualidad (Sacral). Romper barreras para crear vínculos íntimos." },
  "18-58": { name: "Canal de la Corrección",         gates: [18, 58], circuit: "Tribal",      description: "Conecta el juicio (Bazo) con la vitalidad (Raíz). Alegría de corregir y perfeccionar lo imperfecto." },
  "19-49": { name: "Canal de la Síntesis",           gates: [19, 49], circuit: "Tribal",      description: "Conecta la sensibilidad (Raíz) con la revolución (Plexo Solar). Necesidades que desencadenan cambios profundos." },
  "21-45": { name: "Canal del Dinero",               gates: [21, 45], circuit: "Tribal",      description: "Conecta el control (Corazón) con la distribución (Garganta). Gestionar recursos y dirigir la tribu material." },
  "25-51": { name: "Canal de la Iniciación",         gates: [25, 51], circuit: "Tribal",      description: "Conecta la inocencia (G) con el shock (Corazón). Despertar a otros a través de experiencias inesperadas." },
  "26-44": { name: "Canal de la Transmisión",        gates: [26, 44], circuit: "Tribal",      description: "Conecta la persuasión (Corazón) con la alerta (Bazo). Instinto para vender y transmitir valor." },
  "27-50": { name: "Canal de la Preservación",       gates: [27, 50], circuit: "Tribal",      description: "Conecta la nutrición (Sacral) con los valores (Bazo). Cuidar y preservar a la tribu y sus normas." },
  "32-54": { name: "Canal de la Transformación",     gates: [32, 54], circuit: "Tribal",      description: "Conecta la continuidad (Bazo) con la ambición (Raíz). Transformar ambición en logros duraderos." },
  "37-40": { name: "Canal de la Comunidad",          gates: [37, 40], circuit: "Tribal",      description: "Conecta la amistad (Plexo Solar) con la entrega (Corazón). Acuerdos emocionales que sostienen la comunidad." },
  // Integración
  "10-20": { name: "Canal del Despertar",            gates: [10, 20], circuit: "Integración",  description: "Conecta el amor propio (G) con la presencia (Garganta). Despertar a la autenticidad en el momento presente." },
  "10-34": { name: "Canal de la Exploración",        gates: [10, 34], circuit: "Integración",  description: "Conecta la conducta (G) con el poder (Sacral). Explorar la vida respondiendo con poder auténtico." },
  "10-57": { name: "Canal del Perfeccionismo",       gates: [10, 57], circuit: "Integración",  description: "Conecta la autenticidad (G) con la intuición (Bazo). Supervivencia a través de la conducta intuitivamente correcta." },
  "20-34": { name: "Canal de Carisma",               gates: [20, 34], circuit: "Integración",  description: "Conecta la presencia (Garganta) con el poder (Sacral). Acción inmediata y magnética en el momento presente." },
  "20-57": { name: "Canal de la Mente Cerebral",     gates: [20, 57], circuit: "Integración",  description: "Conecta la presencia (Garganta) con la intuición (Bazo). Claridad intuitiva expresada en el ahora." },
  "34-57": { name: "Canal del Poder",                gates: [34, 57], circuit: "Integración",  description: "Conecta la fuerza sacral con la intuición (Bazo). Poder instintivo para sobrevivir y prosperar." },
};

// ─── Lookup helpers ─────────────────────────────────────────────────────────────

/** Get gate theme by gate number */
export function getGateTheme(gate: number): GateTheme | undefined {
  return GATE_THEMES[gate];
}

/** Get channel info by channel ID (e.g. "39-55" or "55-39") */
export function getChannelInfo(channelId: string): ChannelInfo | undefined {
  // Normalize: always use lower-higher gate order
  const parts = channelId.split("-").map(Number);
  if (parts.length !== 2) return undefined;
  const [a, b] = parts.sort((x, y) => x - y);
  return CHANNEL_INFO[`${a}-${b}`];
}

/** Find channel info by channel name (fuzzy match on "Canal de...") */
export function getChannelInfoByName(name: string): ChannelInfo | undefined {
  return Object.values(CHANNEL_INFO).find(
    (ch) => ch.name === name || name.includes(ch.name) || ch.name.includes(name)
  );
}
