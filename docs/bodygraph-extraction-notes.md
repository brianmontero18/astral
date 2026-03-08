# Bodygraph Extraction — Decision Notes (MVP)

## Contexto
Objetivo: lectura **100% correcta** del bodygraph para calcular tránsitos. Si hay error, la confianza se pierde.

## Prueba con API externa (Astrology‑API)
Se probó `api.astrology-api.io` con datos reales y se comparó contra el bodygraph de **myHumanDesign (Jenna Zoe)**.

Resultado:
- Coincidencia general en tipo/estrategia/autoridad/perfil.
- **Diferencia crítica** en el *Design Moon* (API devolvió `16.2` vs myHumanDesign `20.5`).

Conclusión:
- **No usar APIs externas** en este MVP.
- Para exactitud y reputación, tomamos como canon el output de proveedores reconocidos.

## Estrategia MVP
- **Inputs aceptados**: **solo PDF** exportado **desde**:
  - MyHumanDesign (Jenna Zoe)
  - Genetic Matrix
- **Rechazo**: cualquier otro formato/fuente (incluye imágenes/screenshot).
- **Sistema tropical** como estándar.
- Si el archivo no cumple el formato esperado → pedir que lo regenere desde la fuente oficial y re‑suba.

## Implementación (upload + extracción)
- Backend **bloquea** HD no‑PDF en upload y valida fuente en extracción.
- Errores UX claros:
  - No es PDF → pedir PDF exportado desde MyHumanDesign o Genetic Matrix.
  - Fuente no soportada → reexportar desde fuente oficial.
  - No extraíble / formato inválido → reexportar y re‑subir.

## Assets de referencia
Se guardaron PDFs de ejemplo para ingeniería y validación:
- `test-assets/bodygraph-sources/myhumandesign-chart.pdf`
- `test-assets/bodygraph-sources/chart1773003080.pdf`

## Futuro
Si se necesita API:
- Considerar **API oficial de MyHumanDesign** (o proveedor equivalente con reputación en la comunidad).
- Validar siempre contra un bodygraph de referencia antes de adoptar.
