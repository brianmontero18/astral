// ─── Contenido de la landing ────────────────────────────────────────────────
// Todo el copy/data vive acá. Para cambiar textos, precios, secciones o copy
// NO hace falta tocar los componentes: se edita solo este archivo.
// Las imágenes son assets self-contained en /public/landing/.

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Qué incluye", href: "#que-incluye" },
  { label: "Informe premium", href: "#informe" },
  { label: "Planes", href: "#planes" },
];

export interface SectionHeadingContent {
  kicker: string;
  title: string;
  lead?: string;
}

// ─── Hero ───
export const HERO = {
  title: "Astral Guide",
  subtitle:
    "Tu carta de Diseño Humano convertida en claridad práctica para decidir, trabajar y comunicar sin forzarte.",
  primaryCta: "Empezar mi lectura",
  secondaryCta: "Ver experiencia",
  image: {
    src: "/landing/hero-bodygraph.png",
    alt: "Ilustración conceptual de un mandala / bodygraph que mezcla líneas vectoriales con formas botánicas en tonos verde bosque, salvia y dorado.",
  },
};

// ─── Filosofía ───
export type PhilosophyIconKey = "map" | "forum" | "book";

export interface PhilosophyCard {
  icon: PhilosophyIconKey;
  title: string;
  body: string;
}

export const PHILOSOPHY_HEADING: SectionHeadingContent = {
  kicker: "Filosofía",
  title: "Diseño Humano, pero aplicado",
};

export const PHILOSOPHY_CARDS: PhilosophyCard[] = [
  {
    icon: "map",
    title: "Tu carta como mapa de energía",
    body: "Descubrí cómo fluye tu energía vital y cuáles son tus mecánicas naturales para operar en el mundo sin agotarte.",
  },
  {
    icon: "forum",
    title: "Tu chat como guía contextual",
    body: "Consultá dudas específicas sobre tu diseño en tiempo real. Obtené consejos aplicados a situaciones concretas de tu vida.",
  },
  {
    icon: "book",
    title: "Tu informe como mentoría escrita",
    body: "Un documento extenso y profundo que analiza cada aspecto de tu carta, entregando claridad accionable para tu día a día.",
  },
];

// ─── El Sistema ───
export interface SystemFeature {
  img: string;
  alt: string;
  title: string;
  body: string;
  reverse: boolean;
}

export const SYSTEM_HEADING: SectionHeadingContent = {
  kicker: "Producto",
  title: "El Sistema",
};

export const SYSTEM_FEATURES: SystemFeature[] = [
  {
    img: "/landing/feature-mi-carta.png",
    alt: "Vista del BodyGraph con centros definidos en tonos dorados y salvia sobre fondo verde bosque.",
    title: "Mi Carta",
    body: "Visualizá tu BodyGraph con un diseño claro y estético. Entendé de un vistazo tus centros definidos y sin definir.",
    reverse: false,
  },
  {
    img: "/landing/feature-chat.png",
    alt: "Interfaz de chat con un asistente respondiendo sobre el perfil de Diseño Humano del usuario.",
    title: "Chat Personalizado",
    body: "Interactuá con un asistente entrenado en tu diseño específico. Resolvé dudas sobre cómo aplicar tu estrategia y autoridad.",
    reverse: true,
  },
  {
    img: "/landing/feature-transitos.png",
    alt: "Dashboard de tránsitos astrales impactando una carta de Diseño Humano.",
    title: "Tránsitos (Próximamente)",
    body: "Conocé cómo el clima astral actual interactúa con tu diseño base y qué energías temporales tenés disponibles.",
    reverse: false,
  },
  {
    img: "/landing/feature-informe.png",
    alt: "Documento editorial con análisis de texto y sutiles marcas botánicas de fondo.",
    title: "Informe Premium",
    body: "Accedé a un análisis profundo de tu perfil, cruz de encarnación, canales y puertas, estructurado para fácil lectura.",
    reverse: true,
  },
];

// ─── Mentores ───
export interface Mentor {
  img: string;
  name: string;
  role: string;
  body: string;
}

export const MENTORS_HEADING: SectionHeadingContent = {
  kicker: "Quiénes están detrás",
  title: "Creado por una mentora y un constructor",
  lead: "Astral Guide nace de una intersección poco común: la profundidad del Diseño Humano aplicado a negocio y la precisión de un producto de IA construido con criterio.",
};

export const MENTORS: Mentor[] = [
  {
    img: "/landing/mentor-daniela.png",
    name: "Daniela Medina",
    role: "Mentora de negocios holísticos y Diseño Humano",
    body: "Daniela aporta la mirada humana: lectura de patrones, ritmo personal, transformación y negocio alineado. Su trabajo está en traducir información profunda en claridad práctica para mujeres que crean, venden y acompañan.",
  },
  {
    img: "/landing/mentor-brian.png",
    name: "Brian Montero",
    role: "Ingeniero de software y builder de sistemas de IA",
    body: "Brian aporta la arquitectura técnica: producto, IA, sistemas y confiabilidad. Construye la capa que permite que Astral sea personalizada, contextual y precisa, sin convertir lo humano en una respuesta genérica.",
  },
];

export const MENTORS_QUOTE =
  '"No queríamos otra app mística ni otro chatbot genérico. Queríamos una guía que se sintiera humana, pero que estuviera construida con rigor."';

export const MENTORS_CTA = "Entrar a Astral";

// ─── Cómo funciona ───
export interface Step {
  n: string;
  title: string;
  body: string;
}

export const HOW_HEADING: SectionHeadingContent = {
  kicker: "Proceso",
  title: "Cómo funciona",
};

export const STEPS: Step[] = [
  {
    n: "1",
    title: "Cargás tu carta",
    body: "Ingresá tus datos de nacimiento precisos para generar tu BodyGraph único.",
  },
  {
    n: "2",
    title: "Astral entiende tu contexto",
    body: "Nuestro sistema analiza la síntesis de tu diseño, no solo las partes aisladas.",
  },
  {
    n: "3",
    title: "Recibís guía aplicada",
    body: "Comenzá a interactuar y leer tu informe para tomar decisiones alineadas.",
  },
];

// ─── Informe Premium ───
export interface ReportCard {
  title: string;
  body: string;
}

export const REPORT_HEADING: SectionHeadingContent = {
  kicker: "Profundidad",
  title: "Informe Premium",
  lead: "Una inmersión total en tu mecánica energética, diseñada para ser tu manual de usuario personal.",
};

export const REPORT_CARDS: ReportCard[] = [
  {
    title: "Cómo trabajás mejor",
    body: "Entendé tus ritmos productivos ideales, qué tipo de entornos te potencian y cómo evitar el burnout según tu tipo y centros.",
  },
  {
    title: "Cómo decidir",
    body: "Dominá tu Autoridad Interna. Aprendé a reconocer la sensación física o el proceso de tiempo que necesitás para decisiones correctas.",
  },
  {
    title: "Dinámicas de relación",
    body: "Descubrí cómo tu aura interactúa con los demás, tus canales de comunicación óptimos y qué dinámicas atraés naturalmente.",
  },
  {
    title: "Propósito y dirección",
    body: "Explorá tu Perfil y Cruz de Encarnación para alinear tu trayectoria de vida con tu verdadero rol en el colectivo.",
  },
];

// ─── Planes ───
export interface Plan {
  name: string;
  blurb: string;
  price: string;
  suffix?: string;
  features: string[];
  cta: string;
  featured: boolean;
}

export const PLANS_HEADING: SectionHeadingContent = {
  kicker: "Acceso",
  title: "Planes",
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    blurb: "Lo esencial para conocer tu diseño.",
    price: "$0",
    features: [
      "Cálculo de Carta Natal",
      "Resumen de Tipo y Estrategia",
      "Autoridad Interna básica",
    ],
    cta: "Crear cuenta",
    featured: false,
  },
  {
    name: "Premium",
    blurb: "La experiencia completa de autoconocimiento.",
    price: "$49",
    suffix: "/único",
    features: [
      "Todo lo de Basic",
      "Informe de +30 páginas detallado",
      "Análisis de Cruz de Encarnación",
      "Acceso ilimitado al Chat IA",
    ],
    cta: "Obtener Premium",
    featured: true,
  },
  {
    name: "Basic",
    blurb: "Profundizá en tu mecánica base.",
    price: "$19",
    suffix: "/único",
    features: [
      "Todo lo de Free",
      "Análisis de Centros Definidos/Sin Definir",
      "Detalle de Perfil (Líneas)",
      "10 consultas al Chat IA",
    ],
    cta: "Obtener Basic",
    featured: false,
  },
];

// ─── Footer ───
export const FOOTER = {
  brand: "Astral Guide",
  links: ["Privacidad", "Términos", "Contacto"],
  copy: "© 2026 Astral Guide. Wisdom of the stars.",
};
