# UAT Test Plan — Astral Guide

> Plan de pruebas de aceptación completo.
> Cada caso incluye: precondiciones, pasos, resultado esperado.
> Breakpoints: Mobile (375px), Desktop (960px+).

---

## 1. ONBOARDING

### 1.1 Happy Path — Flujo completo

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 1.1.1 | Welcome screen | App sin usuario en localStorage | Abrir app | Pantalla "Astral Guide" con botón "DESCUBRIR MI CARTA" |
| 1.1.2 | Ingresar nombre | Step welcome visible | Click "DESCUBRIR MI CARTA" | Input "Tu nombre" visible, botón "CONTINUAR" deshabilitado |
| 1.1.3 | Nombre válido | Step name | Escribir "Brian" | Botón "CONTINUAR" se habilita |
| 1.1.4 | Avanzar a upload | Nombre escrito | Click "CONTINUAR" | Step upload: "Sincroniza tu energía", zona de drop con "Carta de Diseño Humano" |
| 1.1.5 | Subir PDF Genetic Matrix | Step upload | Click zona, seleccionar `chart1773003080.pdf` | Nombre del archivo visible, botón "CANALIZAR ENERGÍA" habilitado |
| 1.1.6 | Extracción exitosa | PDF cargado | Click "CANALIZAR ENERGÍA" | Spinner de carga → Step review con datos HD extraídos |
| 1.1.7 | Review — datos completos GM | Extracción GM exitosa | Verificar campos | Tipo: Generador Manifestante, Perfil: 6/2, Autoridad: Emocional (Plexo Solar), Definición: Definición dividida, Cruz: Cruz de Ángulo Izquierdo de Industria 1, Canales: 7 canales listados |
| 1.1.8 | Confirmar perfil | Step review | Click "EMBARCAR" | Transición a ChatView, NavBar con nombre del usuario, localStorage contiene `astral_user` |
| 1.1.9 | Subir PDF MyHumanDesign | Step upload | Subir PDF de MyHumanDesign | Extracción exitosa, campos HD poblados según formato MHD |

### 1.2 Validaciones

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 1.2.1 | Nombre vacío | Step name | Dejar input vacío, verificar botón | "CONTINUAR" permanece deshabilitado |
| 1.2.2 | Nombre solo espacios | Step name | Escribir "   " | "CONTINUAR" permanece deshabilitado |
| 1.2.3 | Sin archivo | Step upload | No seleccionar archivo | "CANALIZAR ENERGÍA" permanece deshabilitado |
| 1.2.4 | Nombre con caracteres especiales | Step name | Escribir "José María Ñoño" | Funciona normal, nombre se guarda correctamente |
| 1.2.5 | Nombre muy largo | Step name | Escribir nombre de 100+ caracteres | Se acepta, NavBar trunca con ellipsis (max 160px) |

### 1.3 Errores de extracción

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 1.3.1 | PDF de proveedor no soportado | Step upload | Subir PDF que NO sea de GM ni MHD | Error: "Solo aceptamos PDFs exportados desde MyHumanDesign o Genetic Matrix" — vuelve a step upload |
| 1.3.2 | PDF ilegible / corrupto | Step upload | Subir PDF vacío o corrupto | Error: "No pudimos leer el contenido del PDF" — vuelve a step upload |
| 1.3.3 | PDF con texto muy corto | Step upload | Subir PDF con <20 caracteres de texto | Error similar a ilegible — vuelve a step upload |
| 1.3.4 | Red caída durante extracción | Step extracting | Cortar red durante la llamada API | Error genérico capturado, mensaje de error visible, vuelve a step upload |
| 1.3.5 | Reintento tras error | Error visible en step upload | Click zona de upload, seleccionar otro PDF | Error se limpia, nuevo intento de extracción |
| 1.3.6 | Revertir en review | Step review con datos | Click "REVERTIR" | Vuelve a step upload, datos de extracción se limpian |

### 1.4 Edge Cases

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 1.4.1 | Refresh durante onboarding | Cualquier step | F5 / reload | App vuelve a welcome (no hay usuario en localStorage aún) |
| 1.4.2 | Estrategia no disponible | PDF sin campo Strategy | Completar extracción | Campo "Estrategia" muestra "—" |
| 1.4.3 | Campos opcionales vacíos | PDF con datos parciales | Completar extracción | Campos faltantes muestran "—", no crashea |

---

## 2. CHAT

### 2.1 Happy Path

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 2.1.1 | Estado inicial vacío | Usuario logueado, sin mensajes | Navegar a Chat | "Hola, {nombre}", 3 quick actions visibles, input vacío |
| 2.1.2 | Quick action — Reporte semanal | Chat vacío | Click "Reporte semanal completo" | Mensaje de usuario aparece, respuesta streaming con 6 secciones emoji (🔭⚡💼❤️🧭⚠️) |
| 2.1.3 | Quick action — Energía | Chat vacío | Click "¿Cómo está mi energía esta semana?" | Mensaje enviado, respuesta streaming coherente |
| 2.1.4 | Quick action — Tránsitos hoy | Chat vacío | Click "¿Qué tránsitos me afectan hoy?" | Respuesta menciona planetas y puertas reales del momento |
| 2.1.5 | Mensaje libre | Chat con historial | Escribir "¿Qué canales tengo?" y Enter | Respuesta describe los canales del usuario correctamente |
| 2.1.6 | Streaming progresivo | Cualquier envío | Observar durante respuesta | Texto aparece token por token, no de golpe |
| 2.1.7 | Auto-scroll | Respuesta larga | Observar scroll durante streaming | Chat scrollea automáticamente al último contenido |
| 2.1.8 | Historial persistente | Mensajes previos enviados | Refrescar página (F5) | Al volver a Chat, mensajes anteriores se cargan desde DB |

### 2.2 Renderizado (ReportRenderer)

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 2.2.1 | Secciones con emoji | Reporte semanal | Verificar output | 6 secciones en glass-panel con borde de color, icono + label en mayúscula |
| 2.2.2 | Colores por sección | Reporte renderizado | Verificar bordes | 🔭 violeta, ⚡ dorado, 💼 azul, ❤️ rosa, 🧭 verde, ⚠️ naranja |
| 2.2.3 | Listas con bullets | Pedir respuesta con bullets | "Listame mis canales con bullets" | Bullets renderizados como `<ul><li>`, con indentación correcta (no doble) |
| 2.2.4 | Listas numeradas | Pedir respuesta numerada | "Dame 5 pasos numerados" | Items renderizados como `<ol><li>` |
| 2.2.5 | Texto en bold | Respuesta con **negrita** | Verificar output | Texto entre ** renderizado como `<strong>`, peso 600 |
| 2.2.6 | Párrafos separados | Respuesta con múltiples párrafos | Verificar espaciado | Cada párrafo como `<p>` independiente, no muro de texto |
| 2.2.7 | Headers markdown | Respuesta con ### | Verificar output | Headers estilizados con color accent, tamaño mayor |
| 2.2.8 | Sin secciones emoji | Respuesta conversacional corta | Escribir pregunta simple | Texto renderizado como párrafos sin glass-panel |
| 2.2.9 | Respuesta mixta | Texto + bullets + párrafos | Verificar | Cada tipo de bloque renderizado correctamente sin mezcla |

### 2.3 Validaciones y errores

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 2.3.1 | Mensaje vacío | Chat activo | Click Enviar sin texto | Botón deshabilitado, no se envía nada |
| 2.3.2 | Solo espacios | Chat activo | Escribir "   " y Enter | No se envía (trim validation) |
| 2.3.3 | Doble envío rápido | Mensaje en streaming | Intentar enviar otro mensaje | Botón Enviar deshabilitado durante streaming, input bloqueado |
| 2.3.4 | Streaming falla | Backend caído parcialmente | Enviar mensaje | Fallback automático a non-streaming, respuesta aparece completa (no progresiva) |
| 2.3.5 | Ambos fallan | Backend totalmente caído | Enviar mensaje | Panel de error rojo visible, mensajes revertidos al estado pre-envío |
| 2.3.6 | Historial no carga | DB corrupta o error de red | Entrar a Chat | Chat funciona sin historial, mensajes nuevos sí se envían |

### 2.4 Input

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 2.4.1 | Enter envía | Chat activo | Escribir texto + Enter | Mensaje se envía |
| 2.4.2 | Shift+Enter nueva línea | Chat activo | Escribir texto + Shift+Enter | Nueva línea en el input, NO envía |
| 2.4.3 | Input se limpia tras envío | Mensaje escrito | Enviar | Input queda vacío tras envío |

---

## 3. TRÁNSITOS

### 3.1 Happy Path

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 3.1.1 | Carga inicial | Usuario logueado | Click tab "Tránsitos" | Spinner → vista completa con planetas, canales, impacto |
| 3.1.2 | Header con rango | Vista cargada | Verificar header | "Tránsitos de la Semana" + rango "X de mes al Y de mes" en español |
| 3.1.3 | Grid de planetas | Vista cargada | Verificar grid | 13 planetas en grid 2 columnas: Sol, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno, Plutón, Quirón, Nodo Norte, Nodo Sur |
| 3.1.4 | Datos de cada planeta | Vista cargada | Verificar una card | Glifo, nombre, signo zodiacal + grados, puerta HD + línea |
| 3.1.5 | Indicador retrógrado | Planeta retrógrado | Verificar badge | Badge "Rx" dorado visible al lado del nombre |
| 3.1.6 | Puerta del usuario resaltada | Tránsito toca puerta del user | Verificar card | Card con borde dorado (glass-panel-gold), texto "✦ ACTIVA TU PUERTA X" |
| 3.1.7 | Canales activados | Hay canales completos por tránsito | Verificar sección | Panel dorado "CANALES ACTIVADOS POR TRÁNSITOS" con lista de canales |
| 3.1.8 | Canales personales | Tránsito completa canal del user | Verificar sección | "CANALES PERSONALES ACTIVADOS" con channelName (id), "Tu Puerta X + Planeta en Puerta Y" |
| 3.1.9 | Centros condicionados | Tránsito activa centro indefinido | Verificar sección | "CENTROS CONDICIONADOS" con nombre en español + planetas |
| 3.1.10 | Puertas reforzadas | Tránsito toca puerta existente | Verificar sección | "PUERTAS REFORZADAS" con pills "Puerta X — Planeta" |
| 3.1.11 | Timestamp | Vista cargada | Verificar footer | "Última actualización: fecha/hora" en formato es-AR |

### 3.2 Cards expandibles (Feature nueva)

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 3.2.1 | Expand planet card | Vista cargada | Click en card de Sol | Card se expande: nombre de la puerta + descripción temática. Chevron ▾ rota 180° |
| 3.2.2 | Collapse planet card | Card expandida | Click en misma card | Contenido se colapsa, chevron vuelve a posición original |
| 3.2.3 | Accordion — solo uno | Card de Sol expandida | Click en card de Luna | Sol se colapsa, Luna se expande |
| 3.2.4 | Expand canal activado | Sección canales activados | Click en "Canal de la Comunidad" | Expande: circuito (ej: "TRIBAL") + descripción del canal |
| 3.2.5 | Expand canal personal | Sección canales personales | Click en canal personal | Expande: circuito + descripción del canal |
| 3.2.6 | Accordion cross-section | Planet card expandida | Click en canal activado | Planet se colapsa, canal se expande |
| 3.2.7 | Gate theme correcto | Expandir varias cards | Verificar cada puerta | Nombre y tema coinciden con la puerta HD mostrada (no con otra) |
| 3.2.8 | Canal info correcto | Expandir canal | Verificar descripción | Descripción coincide con el canal mostrado, circuito correcto |
| 3.2.9 | Cursor pointer | Vista cargada | Hover sobre cualquier card | Cursor cambia a pointer en planets, canales activados y canales personales |
| 3.2.10 | Expand card dorada | Tránsito toca puerta user | Click en card dorada | Expande con border-top dorado (rgba 212,175,55), tema visible |
| 3.2.11 | Expand card normal | Tránsito NO toca puerta user | Click en card normal | Expande con border-top gris sutil (rgba 255,255,255), tema visible |

### 3.3 Datos de las 64 puertas

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 3.3.1 | Todas las puertas tienen tema | Cualquier configuración de tránsitos | Expandir cada planet card | Todas muestran nombre + descripción (nunca vacío) |
| 3.3.2 | Puerta 22 = Gracia | Sol en Puerta 22 | Expandir Sol | "Gracia" — "Expresión emocional elegante..." |
| 3.3.3 | Puerta 55 = Espíritu | Marte en Puerta 55 | Expandir Marte | "Espíritu" — "Espíritu emocional y abundancia..." |
| 3.3.4 | Puerta 41 = Contracción | Plutón en Puerta 41 | Expandir Plutón | "Contracción" — "Inicio de nuevos ciclos..." |

### 3.4 Nombres de canales (sync backend)

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 3.4.1 | Canal de la Comunidad | Canal 37-40 activado | Expandir | Circuito "TRIBAL", descripción sobre amistad y Plexo Solar |
| 3.4.2 | Canal de la Emoción | Canal 39-55 activado | Expandir | Circuito "INDIVIDUAL", descripción sobre provocación y espíritu |
| 3.4.3 | Canal de Mating | Canal 6-59 activado | Expandir | Circuito "TRIBAL", descripción sobre fricción emocional e intimidad |
| 3.4.4 | Todos los canales matchean | Todos los canales posibles | Expandir cada canal activado | Ningún canal muestra chevron sin contenido al expandir |

### 3.5 Errores

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 3.5.1 | Error de carga | Backend caído | Navegar a Tránsitos | Panel de error: "Error cargando tránsitos: ..." |
| 3.5.2 | Sin canales activados | Semana sin canales completos | Verificar | Texto italic: "No hay canales completos activados por tránsitos esta semana." |
| 3.5.3 | Sin impacto personal | Usuario sin puertas | Verificar | Secciones de impacto (personal, condicionados, reforzados) no aparecen |

---

## 4. MIS CARTAS (Assets)

### 4.1 Happy Path

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 4.1.1 | Ver lista de cartas | Usuario con 1+ assets | Click tab "Mis Cartas" | Lista de cartas con filename, tipo, tamaño, fecha |
| 4.1.2 | Preview PDF | Asset PDF en lista | Click "VER" | Modal fullscreen con iframe mostrando PDF |
| 4.1.3 | Preview imagen | Asset PNG/JPG en lista | Click "VER" | Modal fullscreen con `<img>` del asset |
| 4.1.4 | Cerrar preview | Modal abierto | Click fuera del modal | Modal se cierra |
| 4.1.5 | Subir nueva carta | Lista visible | Click "AGREGAR NUEVA CARTA", seleccionar archivo | Upload automático, lista se refresca con nuevo asset |
| 4.1.6 | Eliminar carta | Asset en lista | Click "ELIMINAR" → Confirmar en dialog | Asset desaparece de la lista |
| 4.1.7 | Tipo de archivo display | Assets mixtos | Verificar labels | "hd" → "Diseño Humano", "natal" → "Carta Natal" |
| 4.1.8 | Tamaño formateado | Asset de varios tamaños | Verificar | Bytes < 1024: "X B", KB, MB correctamente formateados |

### 4.2 Validaciones

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 4.2.1 | Archivo > 10MB | Tab Mis Cartas | Intentar subir archivo de 15MB | Error 400: "File exceeds 10MB limit" |
| 4.2.2 | Tipo no soportado | Tab Mis Cartas | Intentar subir .docx | Error 400: "Invalid file type..." (si pasa el filtro de accept del input) |
| 4.2.3 | Cancelar eliminación | Asset en lista | Click "ELIMINAR" → Cancelar en confirm | Asset permanece, nada cambia |
| 4.2.4 | Eliminar asset en preview | Modal abierto del asset | Click "ELIMINAR" → Confirmar | Modal se cierra, asset eliminado |

### 4.3 Edge Cases

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 4.3.1 | Lista vacía | Usuario nuevo sin assets | Navegar a Mis Cartas | Mensaje "El vacío cósmico" (o similar empty state) |
| 4.3.2 | Error de red al subir | Red intermitente | Intentar upload | Error capturado y mostrado en panel |
| 4.3.3 | Re-subir mismo archivo | Asset ya subido | Subir el mismo PDF otra vez | Se crea nuevo asset (duplicado válido) |
| 4.3.4 | Nombre con caracteres especiales | Archivo con ñ, acentos, espacios | Subir | Se sube correctamente, nombre se muestra bien |

---

## 5. PERFIL

### 5.1 Happy Path

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 5.1.1 | Abrir panel | Usuario logueado | Click en botón con nombre | Dropdown con datos HD completos |
| 5.1.2 | Datos correctos | Panel abierto | Verificar campos | Tipo, Estrategia, Autoridad, Perfil, Definición, Cruz, Centros definidos/indefinidos, Canales |
| 5.1.3 | Centros en español | Panel abierto | Verificar centros | "Cabeza", "Ajna", "Garganta", "Centro G", "Corazón", "Bazo", "Sacral", "Plexo Solar", "Raíz" |
| 5.1.4 | Cerrar panel | Panel abierto | Click en cualquier lugar fuera | Panel se cierra |
| 5.1.5 | Toggle | Panel abierto | Click en botón de nombre otra vez | Panel se cierra |

### 5.2 Edge Cases

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 5.2.1 | Campos opcionales vacíos | Perfil con datos parciales | Abrir panel | Campos faltantes muestran "—" |
| 5.2.2 | Scroll en panel largo | Muchos canales/datos | Abrir panel | Panel scrolleable, max-height 60vh |
| 5.2.3 | Nombre largo en botón | Nombre de 50+ chars | Verificar NavBar | Texto truncado con ellipsis |

---

## 6. NAVEGACIÓN Y SESIÓN

### 6.1 NavBar

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 6.1.1 | Tab activo resaltado | Cualquier vista | Verificar tab | Tab activo: dorado, underline, bold. Inactivos: muted |
| 6.1.2 | Switch Chat → Tránsitos | En Chat | Click "Tránsitos" | Vista cambia, tab se actualiza |
| 6.1.3 | Switch Tránsitos → Mis Cartas | En Tránsitos | Click "Mis Cartas" | Vista cambia, tab se actualiza |
| 6.1.4 | Switch ida y vuelta | Cualquiera | Ir a Tránsitos, volver a Chat | Chat mantiene mensajes, tránsitos se recargan |

### 6.2 Persistencia de sesión

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 6.2.1 | Reload mantiene sesión | Usuario logueado | F5 / refrescar | App carga con usuario, muestra Chat con historial |
| 6.2.2 | Nueva pestaña | Usuario logueado | Abrir localhost:5173 en otra tab | Misma sesión, mismo usuario |
| 6.2.3 | localStorage corrupto | Modificar manualmente | Escribir JSON inválido en localStorage `astral_user` | App limpia localStorage, muestra onboarding |
| 6.2.4 | Usuario eliminado en DB | userId válido en localStorage pero borrado en DB | Recargar app | getUser falla, localStorage se limpia, onboarding |

### 6.3 Logout

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 6.3.1 | Salir | Usuario logueado | Click "Salir" | App vuelve a onboarding, localStorage limpio |
| 6.3.2 | Re-onboarding tras salir | Post-logout | Completar onboarding de nuevo | Nuevo usuario creado en DB, nueva sesión |
| 6.3.3 | Salir no tiene confirmación | Usuario logueado | Click "Salir" | Se ejecuta inmediatamente, sin dialog |

---

## 7. RESPONSIVE — MOBILE (375px)

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 7.1 | NavBar no overflow | 375px | Verificar header | Tabs "CHAT", "TRÁNSITOS", "MIS CARTAS" caben sin scroll horizontal, `whiteSpace: nowrap` |
| 7.2 | Botón perfil truncado | 375px, nombre largo | Verificar | Nombre truncado, botones no se superponen |
| 7.3 | ProfilePanel responsive | 375px | Abrir perfil | Panel con `maxWidth: calc(100vw - 32px)`, scroll interno si necesario |
| 7.4 | Planet grid 2 cols | 375px | Tab Tránsitos | Grid de 2 columnas, cards comprimen contenido |
| 7.5 | Card expandida mobile | 375px | Click planet card | Descripción se muestra sin overflow, texto wraps correctamente |
| 7.6 | Chat input | 375px | Escribir mensaje | Input ocupa ancho completo, botón enviar visible |
| 7.7 | Reporte secciones | 375px | Generar reporte | Secciones con glass-panel respetan ancho, no overflow-x |
| 7.8 | Onboarding upload | 375px | Step upload | Zona de upload centrada, nombre de archivo visible |
| 7.9 | Asset preview modal | 375px | Click "VER" en asset | Modal fullscreen, PDF/imagen responsive |
| 7.10 | maxWidth 760px | 375px | Cualquier vista | Contenido centrado, nunca excede viewport |

---

## 8. RESPONSIVE — DESKTOP (960px+)

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 8.1 | Contenido centrado | 960px+ | Cualquier vista | maxWidth 760px, margin 0 auto |
| 8.2 | Planet grid 2 cols | 960px | Tab Tránsitos | Grid de 2 columnas con más espacio |
| 8.3 | Card expandida desktop | 960px | Click planet card | Descripción expandida no rompe grid, columna vecina no se desplaza |
| 8.4 | Chat ancho correcto | 960px | Chat con mensajes | Mensajes respetan maxWidth, no se estiran a full width |
| 8.5 | ProfilePanel posición | 960px | Abrir perfil | Dropdown alineado a la derecha, no se sale de viewport |
| 8.6 | Hover en planet cards | 960px | Hover sobre card | Border cambia de color (dorado más intenso en cards del user, primary-dim en otras) |

---

## 9. SCROLL Y LAYOUT

| # | Caso | Precondición | Pasos | Resultado esperado |
|---|------|-------------|-------|-------------------|
| 9.1 | No scroll bounce root | Cualquier vista | Intentar scroll más allá del contenido | Root `overflow: hidden`, sin bounce |
| 9.2 | Scroll en vista activa | Tránsitos con mucho contenido | Scroll down | Solo el contenido scrollea, NavBar fija |
| 9.3 | Chat auto-scroll | Respuesta streaming | Observar | Container scrollea al fondo durante streaming |
| 9.4 | Chat scroll manual | Historial largo | Scroll up manualmente | Se puede leer historial, auto-scroll solo al recibir mensaje |
| 9.5 | No scrollIntoView | Cualquier interacción | Verificar en DevTools | Nunca se usa `scrollIntoView()`, siempre `scrollTop = scrollHeight` |
| 9.6 | minHeight: 0 en flex | Verificar CSS | Inspeccionar containers | Flex children tienen `minHeight: 0` para overflow correcto |

---

## 10. API — BACKEND DIRECTO

> Estos tests se ejecutan contra `localhost:3000/api` directamente.

### 10.1 Health

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 10.1.1 | Health OK | `GET /api/health` | 200, `{ status: "ok", ts: "..." }` |

### 10.2 Users CRUD

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 10.2.1 | Crear usuario | `POST /api/users` con name + profile | 201, `{ id: "uuid" }` |
| 10.2.2 | Crear sin name | `POST /api/users` sin name | 400 |
| 10.2.3 | Obtener usuario | `GET /api/users/:id` | 200, datos completos |
| 10.2.4 | Usuario inexistente | `GET /api/users/fake-id` | 404 |
| 10.2.5 | Actualizar usuario | `PUT /api/users/:id` con datos | 200, `{ ok: true }` |
| 10.2.6 | Eliminar usuario | `DELETE /api/users/:id` | 200, `{ ok: true }` |

### 10.3 Assets

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 10.3.1 | Upload PDF | `POST /api/users/:id/assets` multipart con PDF | 201, AssetMeta |
| 10.3.2 | Upload > 10MB | Upload archivo grande | 400, mensaje de tamaño |
| 10.3.3 | Upload tipo inválido | Upload .exe | 400, mensaje de tipo |
| 10.3.4 | HD no PDF | Upload PNG con fileType=hd | 400, "Subi un PDF exportado..." |
| 10.3.5 | Listar assets | `GET /api/users/:id/assets` | 200, `{ assets: [...] }` camelCase |
| 10.3.6 | Descargar asset | `GET /api/assets/:id` | 200, Content-Type correcto, body = archivo |
| 10.3.7 | Eliminar asset | `DELETE /api/assets/:id` | 200, `{ ok: true }` |
| 10.3.8 | Asset inexistente | `GET /api/assets/fake-id` | 404 |

### 10.4 Chat

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 10.4.1 | Chat sync | `POST /api/chat` con userId + messages | 200, `{ reply: "...", transits_used: "..." }` |
| 10.4.2 | Chat stream | `POST /api/chat/stream` | SSE: múltiples `data: {"content":"..."}` + `data: {"done":true}` |
| 10.4.3 | Chat sin messages | `POST /api/chat` sin messages | 400 |
| 10.4.4 | Chat sin user válido | `POST /api/chat` con userId inexistente | 404 |
| 10.4.5 | Historial | `GET /api/users/:id/messages` | 200, `{ messages: [{role, content, created_at}] }` |

### 10.5 Transits

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 10.5.1 | Tránsitos sin user | `GET /api/transits` | 200, planets + activatedChannels, sin impact |
| 10.5.2 | Tránsitos con user | `GET /api/transits?userId=xxx` | 200, planets + activatedChannels + impact |
| 10.5.3 | Tránsitos con timezone | `GET /api/transits?timeZone=America/Argentina/Buenos_Aires` | 200, weekRange en hora local |
| 10.5.4 | User inexistente | `GET /api/transits?userId=fake` | Tránsitos se cargan pero sin impact (graceful) |

### 10.6 Extraction

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 10.6.1 | Extraer PDF GM | `POST /api/extract-profile` con assetId de PDF GM | 200, `{ profile: UserProfile }` completo |
| 10.6.2 | Extraer PDF MHD | `POST /api/extract-profile` con assetId de PDF MHD | 200, `{ profile: UserProfile }` completo |
| 10.6.3 | Sin assetIds | `POST /api/extract-profile` sin body | 400 |
| 10.6.4 | Asset inexistente | `POST /api/extract-profile` con id falso | Error "Asset not found" |

---

## 11. CROSS-CUTTING

### 11.1 Estilos visuales

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 11.1.1 | Fondo cosmos | Verificar body | Background #0A0910, orbs decorativos visibles |
| 11.1.2 | Glassmorphism | Verificar panels | `.glass-panel`: blur backdrop, border semitransparente |
| 11.1.3 | Fuentes | Verificar tipografía | Serif: Cormorant Garamond / Georgia. Sans: Inter / system-ui |
| 11.1.4 | Color dorado | Verificar acentos | Dorado #D4AF37 en elementos activos, highlights |
| 11.1.5 | Animaciones | Cargar cualquier vista | fadeIn, fadeInSlow suaves en paneles |

### 11.2 Integridad de datos HD

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 11.2.1 | 64 puertas mapeadas | Verificar hd-data.ts | Puertas 1-64 todas presentes con nombre y tema |
| 11.2.2 | 36 canales mapeados | Verificar hd-data.ts | 36 canales: 8 Individual + 13 Colectivo + 9 Tribal + 6 Integración |
| 11.2.3 | Nombres sync backend | Comparar CHANNEL_INFO vs HD_CHANNELS | Todos los nombres idénticos |
| 11.2.4 | Centros en español | Verificar CENTER_DISPLAY | 9 centros: Head→Cabeza, Ajna→Ajna, Throat→Garganta, G→Centro G, Heart→Corazón, Spleen→Bazo, Sacral→Sacral, SolarPlexus→Plexo Solar, Root→Raíz |

### 11.3 Seguridad básica

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|-------------------|
| 11.3.1 | No secrets en frontend | Verificar Network tab | Ninguna API key expuesta en requests del frontend |
| 11.3.2 | OPENAI_API_KEY en backend | Verificar .env | Key solo en backend, nunca enviada al cliente |
| 11.3.3 | UUID como auth | Verificar localStorage | Solo UUID, sin tokens ni passwords |
| 11.3.4 | XSS en chat | Enviar `<script>alert(1)</script>` como mensaje | Se renderiza como texto, no se ejecuta |
| 11.3.5 | XSS en nombre | Onboarding con nombre `<img onerror=alert(1) src=x>` | Se renderiza como texto en NavBar |

---

## 12. FLUJO E2E COMPLETO

> Ejecutar de principio a fin sin interrupciones.

| Step | Acción | Verificación |
|------|--------|-------------|
| 1 | Abrir app sin sesión | Welcome screen visible |
| 2 | Click "DESCUBRIR MI CARTA" | Step nombre |
| 3 | Escribir "QA Tester" | Botón habilitado |
| 4 | Click "CONTINUAR" | Step upload |
| 5 | Subir PDF Genetic Matrix | Nombre visible |
| 6 | Click "CANALIZAR ENERGÍA" | Spinner → Review |
| 7 | Verificar tipo, perfil, autoridad, definición, cruz, canales | Todos presentes |
| 8 | Click "EMBARCAR" | Chat view, "Hola, QA Tester" |
| 9 | Click "Reporte semanal completo" | Streaming, 6 secciones emoji |
| 10 | Escribir "Listame mis canales con bullets" + Enter | Respuesta con bullets formateados |
| 11 | Click tab "Tránsitos" | Grid de planetas cargado |
| 12 | Click en Sol | Expande con nombre puerta + tema |
| 13 | Click en un canal activado | Expande con circuito + descripción |
| 14 | Click en canal personal | Expande con circuito + descripción |
| 15 | Click tab "Mis Cartas" | Lista con 1 asset (el PDF subido) |
| 16 | Click "VER" en el asset | Modal con PDF |
| 17 | Cerrar modal | Lista visible |
| 18 | Click nombre en NavBar | Panel perfil con datos HD completos |
| 19 | F5 (recargar) | Sesión persiste, Chat con historial |
| 20 | Click "Salir" | Onboarding, sesión limpia |
| 21 | Verificar localStorage vacío | `astral_user` eliminado |

---

## Notas para QA

- **Backend sin hot-reload**: reiniciar manualmente si se cambia código backend.
- **Proxy Vite**: en dev, `/api/*` se redirige a `localhost:3000`. Verificar que ambos estén levantados.
- **Swiss Ephemeris**: tránsitos son cálculos reales. Los datos cambian cada día.
- **OpenAI**: las respuestas del LLM varían. Verificar estructura y coherencia, no texto exacto.
- **Cache de tránsitos**: se cachean por semana ISO. Un restart de backend limpia el cache.
- **Screenshots recomendados**: mobile 375px y desktop 960px para cada sección.
