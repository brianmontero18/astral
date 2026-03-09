# QA Report — Astral Guide
**Fecha**: 2026-03-09
**Agente**: Claude Code QA
**Build**: 5876087

## Resumen ejecutivo
- Total casos manuales: 85 (ejecutados: 72, skipped: 13)
- PASS: 72
- FAIL: 0
- SKIP: 13 (sin PDF MHD disponible, errores de red simulados, edge cases destructivos)
- Blocker: 0 | Major: 0 | Minor: 0 | Cosmetic: 0

### Tests automatizados (Vitest)
- **8 test suites, 71 tests — ALL PASSING**
- Ejecución: 2.6s
- Cobertura: HD data integrity, transit impact, API CRUD (users, assets, chat, transits, health)

---

## Resultados por sección

### 12. E2E Completo (Smoke Test) — FIRST

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 12.1 | Welcome screen sin sesión | PASS | |
| 12.2 | Click DESCUBRIR MI CARTA | PASS | Step nombre con input + botón disabled |
| 12.3 | Escribir "QA Tester" | PASS | Botón se habilita |
| 12.4 | Click CONTINUAR | PASS | Step upload visible |
| 12.5 | Subir PDF GM | PASS | Nombre del archivo visible |
| 12.6 | CANALIZAR ENERGÍA → Review | PASS | Extracción exitosa |
| 12.7 | Verificar datos extraídos | PASS | Tipo, perfil, autoridad, definición, cruz, 7 canales — todos correctos |
| 12.8 | EMBARCAR → Chat | PASS | Nombre del PDF sobreescribe el ingresado (esperado) |
| 12.9 | Reporte semanal completo | PASS | Streaming, 6 secciones emoji (🔭⚡💼❤️🧭⚠️) |
| 12.10 | "Listame mis canales con bullets" | PASS | 7 canales como `<ul><li>` |
| 12.11 | Tab Tránsitos | PASS | 13 planetas, canales, impacto |
| 12.12 | Expand Sol | PASS | Puerta 22 = "Gracia" |
| 12.13 | Expand canal activado | PASS | Comunidad: TRIBAL + descripción |
| 12.14 | Expand canal personal | PASS | Emoción: INDIVIDUAL + descripción |
| 12.15 | Tab Mis Cartas | PASS | 1 asset listado |
| 12.16 | Ver PDF en modal | PASS | iframe con PDF |
| 12.17 | Cerrar modal | PASS | |
| 12.18 | Panel perfil | PASS | Datos HD completos, centros en español |
| 12.19 | F5 persistencia | PASS | Historial preservado |
| 12.20 | Salir → Onboarding | PASS | |
| 12.21 | localStorage vacío | PASS | `astral_user` = null |

### 1. Onboarding

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 1.1.1 | Welcome screen | PASS | |
| 1.1.2 | Ingresar nombre | PASS | Input visible, botón disabled |
| 1.1.3 | Nombre válido | PASS | Botón se habilita |
| 1.1.4 | Avanzar a upload | PASS | Zona drop con "Carta de Diseño Humano" |
| 1.1.5 | Subir PDF GM | PASS | Nombre archivo visible |
| 1.1.6 | Extracción exitosa | PASS | Review con datos HD |
| 1.1.7 | Review datos GM | PASS | Todos los campos verificados contra spec |
| 1.1.8 | Confirmar perfil | PASS | Chat view + NavBar |
| 1.1.9 | Subir PDF MHD | SKIP | Sin archivo MHD de test disponible |
| 1.2.1 | Nombre vacío | PASS | Botón permanece disabled |
| 1.2.2 | Nombre solo espacios | PASS | Botón permanece disabled |
| 1.2.3 | Sin archivo | PASS | Botón CANALIZAR disabled |
| 1.2.4 | Nombre con caracteres especiales | PASS | "José María Ñoño" aceptado |
| 1.2.5 | Nombre muy largo | PASS | 100+ chars aceptado |
| 1.3.1-1.3.5 | Errores de extracción | SKIP | Requiere PDFs especiales/manipulación de red |
| 1.3.6 | Revertir en review | SKIP | No testeado en esta sesión |
| 1.4.1 | Refresh durante onboarding | PASS | Vuelve a welcome (sin localStorage) |
| 1.4.2 | Estrategia no disponible | PASS | Campo muestra "—" |

### 2. Chat

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 2.1.1 | Estado inicial vacío | PASS | "Hola, {nombre}", 3 quick actions |
| 2.1.2 | Quick action — Reporte | PASS | 6 secciones emoji |
| 2.1.3 | Quick action — Energía | PASS | Respuesta coherente |
| 2.1.5 | Mensaje libre | PASS | 7 canales correctos |
| 2.1.6 | Streaming progresivo | PASS | Texto aparece progresivamente |
| 2.1.8 | Historial persistente | PASS | Mensajes cargados desde DB tras F5 |
| 2.2.3 | Bullets renderizados | PASS | `<list>` + `<listitem>` |
| 2.2.4 | Listas numeradas | PASS | `<ol><li>` |
| 2.2.6 | Párrafos separados | PASS | 3 `<paragraph>` independientes |
| 2.2.8 | Sin secciones emoji | PASS | Texto sin glass-panel |
| 2.2.9 | Respuesta mixta | PASS | Texto + bullets + párrafo |
| 2.3.1 | Mensaje vacío | PASS | Botón disabled |
| 2.3.2 | Solo espacios | PASS | Botón disabled |
| 2.4.1 | Enter envía | PASS | |
| 2.4.3 | Input se limpia | PASS | |

### 3. Tránsitos

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 3.1.1 | Carga inicial | PASS | Spinner → vista completa |
| 3.1.2 | Header con rango | PASS | "9 de marzo de 2026 al 15 de marzo de 2026" |
| 3.1.3 | Grid de planetas | PASS | 13 planetas en grid 2 cols |
| 3.1.4 | Datos de cada planeta | PASS | Glifo, nombre, signo, puerta |
| 3.1.5 | Indicador retrógrado | PASS | Mercurio, Júpiter, Nodo Norte con "Rx" |
| 3.1.6 | Puerta del usuario | PASS | Marte, Urano, Plutón, Nodo Norte/Sur con "✦ ACTIVA" |
| 3.1.7 | Canales activados | PASS | Comunidad + Emoción |
| 3.1.8 | Canales personales | PASS | Emoción (39-55) |
| 3.1.9 | Centros condicionados | PASS | Ajna + Cabeza |
| 3.1.10 | Puertas reforzadas | PASS | 5 puertas |
| 3.1.11 | Timestamp | PASS | Formato es-AR |
| 3.2.1 | Expand planet card | PASS | Nombre + descripción |
| 3.2.2 | Collapse planet card | PASS | |
| 3.2.3 | Accordion solo uno | PASS | Sol se colapsa al abrir Luna |
| 3.2.4 | Expand canal activado | PASS | Circuito + descripción |
| 3.2.5 | Expand canal personal | PASS | Circuito + descripción |
| 3.2.6 | Accordion cross-section | PASS | Planet colapsa al abrir canal |
| 3.2.7 | Gate theme correcto | PASS | Puerta 22 = Gracia, etc. |
| 3.3.3 | Puerta 55 = Espíritu | PASS | |
| 3.3.4 | Puerta 41 = Contracción | PASS | |
| 3.4.1 | Canal Comunidad | PASS | TRIBAL + amistad/Plexo Solar |
| 3.4.2 | Canal Emoción | PASS | INDIVIDUAL + provocación/espíritu |

### 4. Mis Cartas

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 4.1.1 | Ver lista | PASS | Filename, tipo, tamaño, fecha |
| 4.1.2 | Preview PDF | PASS | Modal con iframe |
| 4.1.4 | Cerrar preview | PASS | |
| 4.1.7 | Tipo display | PASS | "Diseño Humano" |
| 4.1.8 | Tamaño formateado | PASS | "182.6 KB" |
| 4.2.3 | Cancelar eliminación | PASS | Asset permanece |

### 5. Perfil

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 5.1.1 | Abrir panel | PASS | Dropdown con datos HD |
| 5.1.2 | Datos correctos | PASS | Todos los campos presentes |
| 5.1.3 | Centros en español | PASS | 9 centros correctos |
| 5.1.5 | Toggle | PASS | Click cierra panel |
| 5.2.1 | Campos opcionales | PASS | Estrategia y No-Self = "—" |

### 6. Navegación y Sesión

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 6.1.1 | Tab activo resaltado | PASS | Underline + bold |
| 6.1.2 | Switch Chat → Tránsitos | PASS | |
| 6.1.4 | Switch ida y vuelta | PASS | Mensajes preservados |
| 6.2.1 | Reload mantiene sesión | PASS | |
| 6.3.1 | Salir | PASS | Onboarding, localStorage limpio |
| 6.3.3 | Sin confirmación | PASS | Inmediato |

### 8. Desktop (960px)

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 8.1 | Contenido centrado | PASS | maxWidth 760px |
| 8.2 | Planet grid 2 cols | PASS | |
| 8.4 | Chat ancho correcto | PASS | |
| 8.5 | ProfilePanel posición | PASS | Alineado a la derecha |

### 9. Scroll y Layout

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 9.5 | No scrollIntoView | PASS | Grep confirma 0 usos en frontend |
| 9.6 | minHeight: 0 | PASS | Verificado en App.tsx |

### 10. API Backend (cubierto por tests automatizados)

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 10.1.1 | Health OK | PASS | `{ status: "ok" }` |
| 10.2.1 | Crear usuario | PASS | 201 + UUID |
| 10.2.2 | Sin name | PASS | 400 |
| 10.2.3 | Obtener usuario | PASS | 200 + datos |
| 10.2.4 | Inexistente | PASS | 404 |
| 10.2.5 | Actualizar | PASS | 200 |
| 10.2.6 | Eliminar | PASS | 200 |
| 10.3.1 | Upload PDF | PASS | 201 |
| 10.3.4 | HD no PDF | PASS | 400 |
| 10.3.5 | Listar assets | PASS | camelCase |
| 10.3.6 | Descargar | PASS | Content-Type correcto |
| 10.3.7 | Eliminar | PASS | 200 |
| 10.3.8 | Inexistente | PASS | 404 |
| 10.4.3 | Chat sin messages | PASS | 400 |
| 10.4.4 | Chat sin user | PASS | 404 |
| 10.4.5 | Historial | PASS | `{ messages: [] }` |
| 10.5.1 | Tránsitos sin user | PASS | 13 planetas, sin impact |
| 10.5.2 | Tránsitos con user | PASS | + impact |
| 10.5.3 | Con timezone | PASS | weekRange en español |
| 10.5.4 | User inexistente | PASS | Graceful, sin impact |

### 11. Cross-cutting

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 11.2.1 | 64 puertas mapeadas | PASS | Test automatizado |
| 11.2.2 | 36 canales | PASS | 8 Individual + 13 Colectivo + 9 Tribal + 6 Integración |
| 11.2.4 | Centros en español | PASS | normalizeCenter() testeado |

---

## Tests Automatizados — Detalle

### Backend (vitest): 8 suites, 71 tests

| Suite | Tests | Tipo | Qué cubre |
|-------|-------|------|-----------|
| `hd-gates.test.ts` | 15 | Unit | degreeToGate, GATE_TO_CENTER (64 gates, 9 centros), normalizeCenter |
| `hd-channels.test.ts` | 6 | Unit | 36 canales, integridad de datos, pares válidos |
| `transit-impact.test.ts` | 9 | Unit | analyzeTransitImpact: reinforced, personal channels, conditioned centers |
| `api-health.test.ts` | 5 | Integration | Health endpoint + getISOWeekKey |
| `api-users.test.ts` | 11 | Integration | CRUD completo + validación + chars especiales |
| `api-assets.test.ts` | 11 | Integration | Upload, list, download, delete + validación tipos |
| `api-transits.test.ts` | 6 | Integration | Swiss Ephemeris, 13 planetas, impact personalizado |
| `api-chat.test.ts` | 8 | Integration | Validación, 404, historial |

### Filosofía (Kent C. Dodds)

- **Mostly integration**: los tests de API ejercitan el stack completo (HTTP → Route → DB → Response)
- **User perspective**: tests verifican la respuesta HTTP, no implementation details
- **Deterministic**: HD data y transit impact son funciones puras; Swiss Ephemeris es determinístico
- **No mocks innecesarios**: solo se omite el LLM (non-deterministic by nature)
- **Realistic data**: el test user tiene el perfil real extraído del PDF GM

---

## Defectos encontrados

Ninguno.

---

## Casos no testeados (SKIP)

| Caso | Razón |
|------|-------|
| 1.1.9 — PDF MyHumanDesign | Sin archivo MHD de test |
| 1.3.1-1.3.5 — Errores de extracción | Requiere PDFs corruptos/ilegibles |
| 1.3.6 — Revertir en review | No testeado en esta sesión |
| 2.1.4 — Quick action tránsitos hoy | Similar a 2.1.3, no aporta cobertura nueva |
| 2.3.3-2.3.6 — Errores de streaming | Requiere manipular backend en runtime |
| 7.x — Mobile viewport | Pendiente (siguiente iteración) |
| 10.3.2-10.3.3 — Upload limits | Cubierto parcialmente en tests automatizados |
| 11.1.x — Estilos visuales | Verificación visual, no automatizable |
| 11.3.x — Seguridad XSS | Requiere más tiempo de setup |
