# Human Design — Technical Reference

> Referencia técnica para el cálculo de tránsitos HD en Astral.
> Validada contra 3 fuentes independientes (marzo 2026).

---

## 1. Rave Mandala — Mapeo Zodíaco → 64 Puertas

El zodíaco (360°) se divide en **64 puertas** de exactamente **5.625°** cada una.
Las puertas siguen la secuencia del Rave Mandala de Ra Uru Hu (NO son secuenciales 1-64).

### Offset crítico

La secuencia NO empieza en 0° Aries:
- **Gate 25** empieza en 28°15' Piscis = **358.25°** absolutos
- **Gate 41** empieza en 2°0' Acuario = **302°** absolutos

Fórmula para convertir longitud eclíptica → puerta HD:

```
adjusted = ((longitude - 302) % 360 + 360) % 360
slot = floor(adjusted / 5.625)
gate = GATE_SEQUENCE[slot]
```

### Secuencia completa (empezando en 302°)

| Slot | Gate | Grados absolutos | Posición zodiacal |
|------|------|-------------------|-------------------|
| 0 | 41 | 302.000° – 307.625° | 2°0' – 7°37'30" Acuario |
| 1 | 19 | 307.625° – 313.250° | 7°37'30" – 13°15' Acuario |
| 2 | 13 | 313.250° – 318.875° | 13°15' – 18°52'30" Acuario |
| 3 | 49 | 318.875° – 324.500° | 18°52'30" – 24°30' Acuario |
| 4 | 30 | 324.500° – 330.125° | 24°30' Acuario – 0°7'30" Piscis |
| 5 | 55 | 330.125° – 335.750° | 0°7'30" – 5°45' Piscis |
| 6 | 37 | 335.750° – 341.375° | 5°45' – 11°22'30" Piscis |
| 7 | 63 | 341.375° – 347.000° | 11°22'30" – 17°0' Piscis |
| 8 | 22 | 347.000° – 352.625° | 17°0' – 22°37'30" Piscis |
| 9 | 36 | 352.625° – 358.250° | 22°37'30" – 28°15' Piscis |
| 10 | 25 | 358.250° – 3.875° | 28°15' Piscis – 3°52'30" Aries |
| 11 | 17 | 3.875° – 9.500° | 3°52'30" – 9°30' Aries |
| 12 | 21 | 9.500° – 15.125° | 9°30' – 15°7'30" Aries |
| 13 | 51 | 15.125° – 20.750° | 15°7'30" – 20°45' Aries |
| 14 | 42 | 20.750° – 26.375° | 20°45' – 26°22'30" Aries |
| 15 | 3 | 26.375° – 32.000° | 26°22'30" Aries – 2°0' Tauro |
| 16 | 27 | 32.000° – 37.625° | 2°0' – 7°37'30" Tauro |
| 17 | 24 | 37.625° – 43.250° | 7°37'30" – 13°15' Tauro |
| 18 | 2 | 43.250° – 48.875° | 13°15' – 18°52'30" Tauro |
| 19 | 23 | 48.875° – 54.500° | 18°52'30" – 24°30' Tauro |
| 20 | 8 | 54.500° – 60.125° | 24°30' Tauro – 0°7'30" Géminis |
| 21 | 20 | 60.125° – 65.750° | 0°7'30" – 5°45' Géminis |
| 22 | 16 | 65.750° – 71.375° | 5°45' – 11°22'30" Géminis |
| 23 | 35 | 71.375° – 77.000° | 11°22'30" – 17°0' Géminis |
| 24 | 45 | 77.000° – 82.625° | 17°0' – 22°37'30" Géminis |
| 25 | 12 | 82.625° – 88.250° | 22°37'30" – 28°15' Géminis |
| 26 | 15 | 88.250° – 93.875° | 28°15' Géminis – 3°52'30" Cáncer |
| 27 | 52 | 93.875° – 99.500° | 3°52'30" – 9°30' Cáncer |
| 28 | 39 | 99.500° – 105.125° | 9°30' – 15°7'30" Cáncer |
| 29 | 53 | 105.125° – 110.750° | 15°7'30" – 20°45' Cáncer |
| 30 | 62 | 110.750° – 116.375° | 20°45' – 26°22'30" Cáncer |
| 31 | 56 | 116.375° – 122.000° | 26°22'30" Cáncer – 2°0' Leo |
| 32 | 31 | 122.000° – 127.625° | 2°0' – 7°37'30" Leo |
| 33 | 33 | 127.625° – 133.250° | 7°37'30" – 13°15' Leo |
| 34 | 7 | 133.250° – 138.875° | 13°15' – 18°52'30" Leo |
| 35 | 4 | 138.875° – 144.500° | 18°52'30" – 24°30' Leo |
| 36 | 29 | 144.500° – 150.125° | 24°30' Leo – 0°7'30" Virgo |
| 37 | 59 | 150.125° – 155.750° | 0°7'30" – 5°45' Virgo |
| 38 | 40 | 155.750° – 161.375° | 5°45' – 11°22'30" Virgo |
| 39 | 64 | 161.375° – 167.000° | 11°22'30" – 17°0' Virgo |
| 40 | 47 | 167.000° – 172.625° | 17°0' – 22°37'30" Virgo |
| 41 | 6 | 172.625° – 178.250° | 22°37'30" – 28°15' Virgo |
| 42 | 46 | 178.250° – 183.875° | 28°15' Virgo – 3°52'30" Libra |
| 43 | 18 | 183.875° – 189.500° | 3°52'30" – 9°30' Libra |
| 44 | 48 | 189.500° – 195.125° | 9°30' – 15°7'30" Libra |
| 45 | 57 | 195.125° – 200.750° | 15°7'30" – 20°45' Libra |
| 46 | 32 | 200.750° – 206.375° | 20°45' – 26°22'30" Libra |
| 47 | 50 | 206.375° – 212.000° | 26°22'30" Libra – 2°0' Escorpio |
| 48 | 28 | 212.000° – 217.625° | 2°0' – 7°37'30" Escorpio |
| 49 | 44 | 217.625° – 223.250° | 7°37'30" – 13°15' Escorpio |
| 50 | 1 | 223.250° – 228.875° | 13°15' – 18°52'30" Escorpio |
| 51 | 43 | 228.875° – 234.500° | 18°52'30" – 24°30' Escorpio |
| 52 | 14 | 234.500° – 240.125° | 24°30' Escorpio – 0°7'30" Sagitario |
| 53 | 34 | 240.125° – 245.750° | 0°7'30" – 5°45' Sagitario |
| 54 | 9 | 245.750° – 251.375° | 5°45' – 11°22'30" Sagitario |
| 55 | 5 | 251.375° – 257.000° | 11°22'30" – 17°0' Sagitario |
| 56 | 26 | 257.000° – 262.625° | 17°0' – 22°37'30" Sagitario |
| 57 | 11 | 262.625° – 268.250° | 22°37'30" – 28°15' Sagitario |
| 58 | 10 | 268.250° – 273.875° | 28°15' Sagitario – 3°52'30" Capricornio |
| 59 | 58 | 273.875° – 279.500° | 3°52'30" – 9°30' Capricornio |
| 60 | 38 | 279.500° – 285.125° | 9°30' – 15°7'30" Capricornio |
| 61 | 54 | 285.125° – 290.750° | 15°7'30" – 20°45' Capricornio |
| 62 | 61 | 290.750° – 296.375° | 20°45' – 26°22'30" Capricornio |
| 63 | 60 | 296.375° – 302.000° | 26°22'30" Capricornio – 2°0' Acuario |

### Subdivisión dentro de cada puerta

```
1 puerta = 5.625° = 6 líneas × 0.9375°
1 línea  = 0.9375° = 6 colores × 0.15625°
1 color  = 0.15625° = 6 tonos × 0.026042°
1 tono   = 0.026042° = 5 bases × 0.005208°
```

Para el MVP solo se calculan puerta + línea. Color/tono/base son para lecturas avanzadas.

---

## 2. Los 9 Centros — Gate-to-Center Mapping

Cada una de las 64 puertas pertenece a exactamente 1 de los 9 centros del bodygraph.

| Centro | Puertas | Total |
|--------|---------|-------|
| **Head** (Cabeza) | 64, 61, 63 | 3 |
| **Ajna** | 47, 24, 4, 17, 43, 11 | 6 |
| **Throat** (Garganta) | 62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16 | 11 |
| **G** (Centro G / Identidad) | 7, 1, 13, 10, 15, 2, 46, 25 | 8 |
| **Heart** (Corazón / Ego / Will) | 21, 40, 26, 51 | 4 |
| **Spleen** (Bazo / Esplénico) | 48, 57, 44, 50, 32, 28, 18 | 7 |
| **Sacral** | 5, 14, 29, 59, 9, 3, 42, 27, 34 | 9 |
| **SolarPlexus** (Plexo Solar / Emocional) | 6, 37, 22, 36, 30, 55, 49 | 7 |
| **Root** (Raíz) | 53, 60, 52, 19, 39, 41, 58, 38, 54 | 9 |
| **Total** | | **64** |

**Fuente**: freehumandesignchart.com/the-64-human-design-gates/

### Normalización de nombres

La extracción con GPT-4o Vision produce nombres en español. El código usa IDs canónicos en inglés.
Mapa de normalización:

| Extracción (español) | ID canónico | Variantes comunes |
|----------------------|-------------|-------------------|
| Cabeza | Head | — |
| Ajna | Ajna | — |
| Garganta | Throat | — |
| Centro G | G | G Center, Identity, Self |
| Corazón/Ego | Heart | Corazón, Will, Ego |
| Bazo | Spleen | Splenic, Esplénico |
| Sacral | Sacral | — |
| Solar Plexus | SolarPlexus | Plexo Solar, Emotional |
| Raíz | Root | — |

---

## 3. Los 36 Canales

Un canal conecta 2 puertas en 2 centros diferentes. Cuando ambas puertas están activas (natal o tránsito), el canal se define y los 2 centros quedan conectados.

### Por circuito

**Individual (Conocimiento + Centrado):**

| Canal | Nombre | Centros |
|-------|--------|---------|
| 1-8 | Inspiración | G → Throat |
| 2-14 | El Pulso | G → Sacral |
| 3-60 | Mutación | Sacral → Root |
| 12-22 | Apertura | Throat → SolarPlexus |
| 23-43 | Estructuración | Throat → Ajna |
| 24-61 | Conocimiento | Ajna → Head |
| 28-38 | Lucha | Spleen → Root |
| 39-55 | Emoción | Root → SolarPlexus |

**Colectivo (Lógico + Abstracto):**

| Canal | Nombre | Centros |
|-------|--------|---------|
| 4-63 | Lógica | Ajna → Head |
| 5-15 | Ritmo | Sacral → G |
| 7-31 | El Alfa | G → Throat |
| 9-52 | Concentración | Sacral → Root |
| 11-56 | Curiosidad | Ajna → Throat |
| 13-33 | Testimonio | G → Throat |
| 16-48 | Longitud de Onda | Throat → Spleen |
| 17-62 | Aceptación | Ajna → Throat |
| 29-46 | Descubrimiento | Sacral → G |
| 30-41 | Reconocimiento | SolarPlexus → Root |
| 35-36 | Lo Transitorio | Throat → SolarPlexus |
| 42-53 | Madurez | Sacral → Root |
| 47-64 | Abstracción | Ajna → Head |

**Tribal (Ego + Defensa):**

| Canal | Nombre | Centros |
|-------|--------|---------|
| 6-59 | Mating | SolarPlexus → Sacral |
| 18-58 | Corrección | Spleen → Root |
| 19-49 | Síntesis | Root → SolarPlexus |
| 21-45 | Dinero | Heart → Throat |
| 25-51 | Iniciación | G → Heart |
| 26-44 | Transmisión | Heart → Spleen |
| 27-50 | Preservación | Sacral → Spleen |
| 32-54 | Transformación | Spleen → Root |
| 37-40 | Comunidad | SolarPlexus → Heart |

**Integración (las 4 puertas: 10, 20, 34, 57):**

| Canal | Nombre | Centros |
|-------|--------|---------|
| 10-20 | Despertar | G → Throat |
| 10-34 | Exploración | G → Sacral |
| 10-57 | Perfeccionismo | G → Spleen |
| 20-34 | Carisma | Throat → Sacral |
| 20-57 | Mente Cerebral | Throat → Spleen |
| 34-57 | Poder | Sacral → Spleen |

**Total: 36 canales**

---

## 4. Tránsitos — Cómo Impactan el Bodygraph

### Cadena de cálculo

```
Swiss Ephemeris       →  degreeToGate()    →  analyzeTransitImpact()  →  LLM
(longitud planetaria)    (puerta + línea)     (cruce con bodygraph)      (interpretación)
```

Swiss Ephemeris calcula astronomía pura (dónde está cada planeta en grados).
`degreeToGate()` convierte grados a puertas HD usando el Rave Mandala.
`analyzeTransitImpact()` cruza las puertas en tránsito con el bodygraph del usuario.
El LLM interpreta los datos calculados (no los infiere).

### 4 tipos de impacto

| Tipo | Condición | Significado |
|------|-----------|-------------|
| **Canal personal** | Usuario tiene gate A, tránsito tiene gate B del mismo canal | Canal temporalmente completo. Ambos centros se conectan. La experiencia más significativa. |
| **Canal educacional** | Tránsito tiene gates A y B, usuario no tiene ninguna | Energía colectiva de condicionamiento. Menos personal. |
| **Puerta reforzada** | Tránsito activa gate que el usuario ya tiene | Amplificación de energía existente. |
| **Centro condicionado** | Tránsito activa gate en centro indefinido del usuario | Definición temporal. Mayor vulnerabilidad al condicionamiento. |

### Reglas fundamentales

1. Los tránsitos **NUNCA quitan definición**, solo agregan temporalmente
2. El **Sol** es el tránsito dominante (~6 días por puerta, define el tema del día)
3. La **Tierra** siempre está opuesta al Sol (+180°, encarna el tema)
4. La **Luna** cicla en ~28 días (ciclo emocional)
5. **Planetas lentos** (Júpiter, Saturno, Nodos) = tránsitos largos, mayor riesgo de identificación
6. Canales personales (bridge gates) son más impactantes que educacionales

### Jerarquía de importancia

1. Bridge gates que completan split definition del usuario
2. Bridge gates en la cruz de encarnación
3. Bridge gates en centros indefinidos
4. Bridge gates en centros definidos
5. Puertas reforzadas
6. Canales educacionales

---

## 5. Planetas en el Sistema HD

| Planeta | Velocidad | Duración por puerta | Notas |
|---------|-----------|---------------------|-------|
| Sol | ~1°/día | ~6 días | Tema principal del día |
| Tierra | ~1°/día | ~6 días | Siempre opuesta al Sol |
| Luna | ~13°/día | ~10 horas | Ciclo emocional, muy rápida |
| Mercurio | ~1.2°/día | ~5 días | Comunicación, puede ser retrógrado |
| Venus | ~1.2°/día | ~5 días | Relaciones, valores |
| Marte | ~0.5°/día | ~11 días | Energía, acción |
| Júpiter | ~0.08°/día | ~70 días | Expansión, ley |
| Saturno | ~0.03°/día | ~187 días | Estructura, disciplina |
| Urano | ~0.01°/día | ~1.5 años | Cambio, innovación |
| Neptuno | ~0.006°/día | ~2.5 años | Espiritualidad, ilusión |
| Plutón | ~0.004°/día | ~3.7 años | Transformación profunda |
| Quirón | ~0.02°/día | ~280 días | Herida/sanación |
| Nodo Norte | ~0.05°/día | ~112 días | Dirección evolutiva |
| Nodo Sur | = Nodo Norte + 180° | = Nodo Norte | Siempre opuesto |

---

## Fuentes

- [Barney + Flow — Gate + Zodiac Degrees](https://www.barneyandflow.com/gate-zodiac-degrees) (tabla completa 64 puertas)
- [Embody Your Design — Cheat Sheet](https://www.embodyyourdesign.com/blog/cheatsheet-astrology-positions-of-human-design-gates) (tabla independiente)
- [Free Human Design Chart — Gates](https://freehumandesignchart.com/the-64-human-design-gates/) (gate-to-center mapping)
- [Christie Inge — Transits](https://christieinge.com/how-the-human-design-transits-affect-your-chart/) (personal vs educational channels)
- [HD for Success — Planet Transits](https://www.humandesignforsuccess.com/quick-tip-how-the-sun-and-planets-transit-through-the-gates/)
- [Jovian Archive — Gates & Hexagrams](https://jovianarchive.com/pages/gates-and-hexagrams-in-human-design)
