---
version: alpha
name: Astral Guide
description: >
  Editorial premium con identidad de plant-medicine. Verde profundo + crema +
  un único acento dorado. Calmo, espacioso, lectura serif, controles sans en
  caps tracked. Sin glassmorphism. Sin sombras pesadas. Tipografía y vacío
  hacen el trabajo de jerarquía.

colors:
  # Brand palette (raw)
  forest-deep: '#21291e'     # Texto sobre crema, fondos más profundos, sello
  forest:      '#294c38'     # Surface principal (cards, inputs sobre app bg)
  sage:        '#8aa897'     # Sage saturado (acentos secundarios)
  sage-soft:   '#adc2b6'     # App background base
  cream:       '#f8f4e8'     # Texto principal sobre forest, ivory
  cream-soft:  '#f1ebdb'     # Cream para banners cálidos
  tan:         '#d7c7ad'     # Khaki cálido (acento secundario)
  gold:        '#cfac6c'     # Acento primario único
  gold-deep:   '#9d7f4d'     # Bronce, hover dorado, iconografía

  # Roles semánticos
  primary:           '{colors.gold}'
  secondary:         '{colors.tan}'
  surface-app:       '{colors.sage-soft}'
  surface-card:      '{colors.forest}'
  surface-deepest:   '{colors.forest-deep}'
  surface-warm:      '{colors.cream-soft}'

  on-surface-card:        '{colors.cream}'              # Texto sobre forest
  on-surface-card-muted:  'rgba(248, 244, 232, 0.72)'
  on-surface-card-faint:  'rgba(248, 244, 232, 0.45)'
  on-surface-app:         '{colors.forest-deep}'        # Texto sobre sage-soft
  on-surface-app-muted:   'rgba(33, 41, 30, 0.62)'
  on-surface-app-faint:   'rgba(33, 41, 30, 0.40)'

  border-subtle-dark:     'rgba(248, 244, 232, 0.10)'   # Sobre forest
  border-subtle-light:    'rgba(33, 41, 30, 0.14)'      # Sobre sage-soft
  border-gold:            'rgba(207, 172, 108, 0.32)'

  feedback-error-bg:      'rgba(196, 96, 96, 0.16)'
  feedback-error-fg:      '#9a3737'
  feedback-error-border:  'rgba(196, 96, 96, 0.40)'
  feedback-success-fg:    '{colors.gold}'

typography:
  # Display (auth hero)
  display:
    fontFamily: serif
    fontSize:   'clamp(2.05rem, 5vw, 3rem)'   # ≈ 33–48px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: 0.005em
  # Headlines (page titles, view headers)
  headline-lg:
    fontFamily: serif
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  headline-md:
    fontFamily: serif
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0
  headline-sm:
    fontFamily: serif
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0
  # Body (long-form content, reports, intake)
  body-lg:
    fontFamily: serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: 0
  body-md:
    fontFamily: sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0.01em
  body-sm:
    fontFamily: sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0.02em
  # Labels (form labels, button text)
  label-md:
    fontFamily: sans
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.16em
    textTransform: uppercase
  label-sm:
    fontFamily: sans
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.18em
    textTransform: uppercase
  # Kicker (over-titles, section headers)
  kicker:
    fontFamily: sans
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.20em
    textTransform: uppercase
  # Caption (footnotes, helper text)
  caption:
    fontFamily: sans
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: 0.04em

rounded:
  none:  0
  sm:    6px      # icon buttons, chips
  md:    10px     # standard buttons, inputs
  lg:    14px     # edit cards, banners
  xl:    18px     # primary cards (chat user bubble, asset-empty)
  2xl:   24px     # auth shell card (desktop)
  pill:  999px
  full:  50%

spacing:
  xs:   4px
  sm:   8px
  md:   12px
  lg:   16px
  xl:   24px
  2xl:  32px
  3xl:  40px
  # Semánticos
  gutter:        16px      # padding horizontal en views
  content-max:   760px     # ancho máximo de cualquier vista interior
  auth-max:      1180px    # auth shell

components:
  button-primary:
    backgroundColor: 'linear-gradient(135deg, #f1d59a 0%, #c19b5b 100%)'
    textColor: '{colors.surface-deepest}'
    borderColor: '#e8c984'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: '14px 28px'
    minHeight: 50px
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 12px 28px rgba(157,127,77,0.38)'
    hover: { transform: 'translateY(-1px)' }
  button-secondary:
    backgroundColor: 'rgba(248, 244, 232, 0.04)'
    textColor: '{colors.on-surface-card}'
    borderColor: 'rgba(248, 244, 232, 0.16)'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: '14px 28px'
  button-ghost-icon:
    backgroundColor: transparent
    textColor: '{colors.on-surface-card-faint}'
    rounded: '{rounded.sm}'
    size: 28px
    hover: { textColor: '{colors.on-surface-card-muted}', backgroundColor: 'rgba(248,244,232,0.06)' }
  card:
    backgroundColor: '{colors.surface-card}'
    borderColor: '{colors.border-subtle-dark}'
    rounded: '{rounded.xl}'
    padding: 24px
    textColor: '{colors.on-surface-card}'
  card-gold:
    backgroundColor: 'rgba(207, 172, 108, 0.08)'
    borderColor: '{colors.border-gold}'
    rounded: '{rounded.xl}'
    padding: 20px
  input:
    backgroundColor: 'rgba(248, 244, 232, 0.04)'
    textColor: '{colors.on-surface-card}'
    borderColor: '{colors.border-subtle-dark}'
    typography: '{typography.body-md}'
    rounded: '{rounded.md}'
    padding: '12px 14px'
  pill:
    backgroundColor: 'rgba(248, 244, 232, 0.04)'
    textColor: '{colors.on-surface-card}'
    rounded: '{rounded.pill}'
    padding: '6px 14px'
    typography: '{typography.label-sm}'
  feedback-error:
    backgroundColor: '{colors.feedback-error-bg}'
    textColor: '{colors.feedback-error-fg}'
    borderColor: '{colors.feedback-error-border}'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
    typography: '{typography.body-sm}'
---

# Astral Guide — Design System

## Overview

App de Diseño Humano para coaches y marcas personales del bienestar. La estética
es **editorial premium con base botánica**: verde profundo de bosque sobre sage
suave, crema ivory para el texto, **un único acento dorado** que jerarquiza y
guía la atención. Cero glassmorphism, cero sombras heavy, cero gradientes
chillones. Tipografía y espacio en blanco hacen el trabajo de la jerarquía.

Emocionalmente: calma, claridad, autoridad sin gritar. La app respira como un
papel de revista, no como un dashboard SaaS.

## Colors

Tres tonos hacen el 90% del trabajo: **forest** (cards), **sage-soft** (app bg),
**cream** (texto sobre cards). El **gold** es el único acento — usalo con
escasez, marca lo importante (CTAs primarios, links destacados, kickers,
borde-izquierdo de section reports). Cualquier otro color que aparezca probablemente
sea una decisión del usuario o un sistema (rojo error, etc.) y debe ser excepción.

Texto sobre forest → `cream` (alto), `cream` con alpha 0.72 (medio), 0.45 (bajo).
Texto sobre sage-soft → `forest-deep` (alto), `forest-deep` con alpha 0.62 (medio), 0.40 (bajo).

No usar negro puro ni blanco puro. No usar el `gold` para texto largo (es accent).

## Typography

Dos familias y nada más: **Cormorant Garamond** (serif) para títulos, displays
y body de lectura largo (reportes, intake). **Inter** (sans) para UI: labels,
buttons, inputs, captions, body funcional.

Toda label de UI (button, kicker, page-header-kicker, sección report) va en
**uppercase con letter-spacing 0.16–0.22em**. Esa cadencia tipográfica es la
firma del sistema — respetala incluso cuando agregues componentes nuevos.

Number-only escala oficial: 10, 11, 12, 13, 14, 15, 18, 20, 22, 28, display fluido.
No introducir tamaños fuera de esa lista sin justificar.

## Layout

- **Ancho de contenido**: `760px` máximo en cualquier vista interior, centrado
  con `margin: 0 auto`. Esto vale para chat, tránsitos, cartas, profile, intake.
- **Auth shell**: `1180px` máximo (excepción justificada — flow standalone).
- **Mobile breakpoint**: `640px`. Arriba de eso, layout de escritorio estándar.
- **Scroll vertical**: viven en la **vista** (`overflowY: auto`), nunca en el
  root. Root es flex column, `height: 100vh`, `overflow: hidden`. Las vistas
  internas son `flex: 1, minHeight: 0, overflowY: auto`.
- **Grid de spacing**: ritmo de 4 (xs) → 40 (3xl). Gaps comunes: `12`, `16`, `24`.
  Padding interior de cards: `18–28px`.

## Elevation & Depth

Sistema **tonal**, no de sombras.

- Card sobre app bg: surface-card (`#294c38`) sobre sage-soft (`#adc2b6`).
  El contraste de tono es la elevación.
- Border `rgba(cream, 0.10)` sobre cards refuerza el filo sin agregar peso.
- Sombras solo se usan en el **botón primario gold** (define profundidad cálida)
  y en el hover sutil de botones secundarios. Nunca en cards.
- Animación de entrada: `fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)`. Sutil.

## Shapes

Esquinas suaves, escala definida (ver `rounded` en frontmatter):

- `sm 6px`: icon buttons, chips pequeños, chat-feedback.
- `md 10px`: botones estándar, inputs, banners.
- `lg 14px`: cards de edición de chat, error banners.
- `xl 18px`: cards principales (chat user bubble, asset-empty placeholder).
- `2xl 24px`: card central de auth en desktop (mobile baja a 20px).
- `pill 999px`: pills de info, user pills, support nav.
- `full 50%`: avatares, dots, orbs.

Excepción: las section cards del reporte usan `4px 14px 14px 4px` — borde
izquierdo afilado para anclar el barrita de color, derechos suaves. Es la única
asimetría intencional del sistema.

## Components

Cada componente abajo: rol, variantes, tokens en uso. Los nombres de clase actuales
están entre paréntesis para facilitar la migración a un nuevo design system.

### Button
- **Primary** (`.astral-auth-primary`, `.chat-quick-action--primary` con tweaks):
  Gold gradient, uppercase tracked, alta jerarquía. Una vez por vista máximo.
- **Secondary** (`.astral-auth-secondary`, `.btn-secondary`): Ghost sobre forest
  con borde sutil cream-alpha. Acompaña al primary.
- **Ghost icon** (`.chat-feedback-button`, `.chat-copy-button`, `.chat-icon-button`):
  Cuadrado 28px, transparent, hover sube a alpha background. Para acciones
  inline en mensajes.

### Card
- **Default** (`.glass-panel`, `.chat-assistant-card`, `.profile-panel`):
  Forest surface, border cream-alpha 0.10, padding 18–28px.
- **Gold** (`.glass-panel-gold`): Misma forma con tinte dorado. Para destacar
  bloques de impacto (canales activados, banners de acción).
- **Empty placeholder** (`.asset-empty`): Borde dashed `rgba(forest, 0.18)` sobre
  app bg. Icon 56px + headline-sm + body-sm centrados.

### Input
- **Text field** (`.astral-auth-input`, `.intake-textarea`): Borde subtle, padding
  12×14, font-size 14, sin outline. Focus puede subir border a gold.
- **Underlined minimal** (`.astral-auth-field-minimal`): Solo border-bottom,
  para campos hero como el email de login.

### Pill / Chip
- Background alpha cream sobre forest, padding 6×14, label-sm uppercase.
  Usado en user pill (NavBar), retro indicators (Rx en planet card), gate chips
  en puertas reforzadas.

### Page header
- Pattern: `kicker (gold uppercase)` → `headline-lg serif` → `body-md muted`.
  Centrado, marginBottom 28px. Establece la entrada visual de toda vista interior.

### Profile field
- Pattern: `label uppercase 10px gold-deep alpha` → `value serif 14px main`.
  Se compone en `.profile-grid` (2 columnas) o `.profile-wide` (full width).
  Reusable en onboarding review, ProfilePanel, futuras vistas de cuenta.

### Section card (report)
- Borde-izquierdo de color (gold/sage/tan según sección), header con icon SVG
  + label uppercase del color, body en body-lg serif. Animación staggered fadeIn.

### Feedback banner
- **Error**: rojo apagado (`#9a3737` sobre rosa pálido). Border, rounded lg.
- **Success/Info**: tinte gold sobre cream-alpha, mismo shape.

## Patterns

### Streaming pending
Mientras el LLM no devolvió el primer chunk, mostrar 3 dots gold animados con
`pulse 1.2s` + label "Canalizando tu lectura…". Cuando llega contenido, switch
a renderer sin transición.

### Empty states
- Card placeholder con borde dashed (no continuous).
- Icon circular 56px gold-deep en background gold-faint.
- Headline-sm serif + body-sm muted explicando para qué sirve la sección y qué
  acción tomar.
- Nunca un solo line de texto suelto.

### Error states
- Inline banner sobre la vista (no modal, no toast).
- Mensaje específico cuando se puede inferir (network, auth, timeout); fallback
  genérico "Probá de nuevo" si no.

### Mobile
- A <640px: shell de auth se apila vertical, secondary action rows pierden el `·`
  divider y se apilan, support pill mantiene su ancho natural (no se estira a 100%).
- En todas las vistas interiores, `760px` con `width: 100%` ya hace el trabajo.

## Do's and Don'ts

**Do**
- Usar el gold con escasez. Cada uso debe ganarse jerarquía.
- Respetar 760px de ancho de contenido en cualquier vista interior nueva.
- Composer nuevas pantallas reusando `.page-header*`, `.profile-grid`/`.profile-field`,
  `.glass-panel`, `.astral-auth-primary/secondary` antes de agregar CSS nuevo.
- Mantener uppercase + letter-spacing 0.16–0.22em para toda label/CTA. Esa
  tipografía es la firma del sistema.
- Para listas de campos clave-valor, mirar primero a `.profile-grid` antes de
  reinventar el patrón.

**Don't**
- No usar drop shadows en cards. La elevación es tonal.
- No usar negro puro (`#000`) ni blanco puro (`#fff`). Tomar de la paleta.
- No introducir gradientes nuevos fuera del gold de los CTAs primarios.
- No usar emojis decorativos en UI. Para iconografía, SVG inline con
  `strokeWidth: 1.7`.
- No usar `scrollIntoView()`. Manejar scroll con `el.scrollTop = el.scrollHeight`
  sobre el contenedor.
- No agregar font-sizes fuera de la escala (10, 11, 12, 13, 14, 15, 18, 20, 22, 28).
- No agregar libs de UI (Mantine, Chakra, Radix, etc.). Inline styles + CSS
  utility classes en `index.css`.

## Implementation notes

- Source of truth: `frontend/src/index.css` (tokens en `:root`).
- Fuentes via Google Fonts (`Cormorant Garamond`, `Inter`).
- Sin Tailwind ni CSS-in-JS. Estilos inline para variantes locales, clases
  utility en `index.css` para componentes y patrones reusables.
- Las clases `.profile-*`, `.page-header*`, `.astral-auth-*`, `.chat-*` están
  pensadas para reuso. Antes de crear una clase nueva, verificar si una
  existente cubre el caso.
