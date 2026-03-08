# BDG PDF Input Contract - MVP

## Scope
- MVP **solo PDF** para bodygraph HD.
- Fuentes aceptadas: **MyHumanDesign (Jenna Zoe)** y **Genetic Matrix** (tropical).
- Cualquier otro formato/fuente se **rechaza** (fail-closed).

## Inputs aceptados
- Archivo **PDF** exportado desde la fuente oficial (no screenshot, no scan, no recortes).
- Texto **extraible** (no imagen dentro del PDF).
- Debe contener **26** valores `gate.line` (13 Design + 13 Personality) con orden estable por proveedor.

## Orden canonico de planetas (por proveedor)
> Este orden se usa para mapear posiciones del PDF a planetas.

### MyHumanDesign
Orden (Design 1-13, luego Personality 1-13):
1. Sun
2. Earth
3. North Node
4. South Node
5. Moon
6. Mercury
7. Venus
8. Mars
9. Jupiter
10. Saturn
11. Uranus
12. Neptune
13. Pluto

### Genetic Matrix
Orden (Design 1-13, luego Personality 1-13):
1. Sun
2. Earth
3. Moon
4. North Node
5. South Node
6. Mercury
7. Venus
8. Mars
9. Jupiter
10. Saturn
11. Uranus
12. Neptune
13. Pluto

## Criterios de rechazo (UX)
Se debe mostrar un error claro y accionable en cualquiera de estos casos:
- **No es PDF**: el archivo no es `application/pdf`.
- **Fuente no soportada**: no coincide con los templates de MyHumanDesign o Genetic Matrix.
- **PDF no extraible**: el texto no se puede leer (scan/screenshot embebido).
- **Formato invalido**: no hay 26 `gate.line` o algun valor esta fuera de rango (gate 1-64, line 1-6).

## Mensajes sugeridos al usuario
- **No es PDF**: "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas."
- **Fuente no soportada**: "Solo aceptamos PDFs oficiales de MyHumanDesign o Genetic Matrix. Reexporta el bodygraph desde la fuente oficial."
- **No extraible / formato invalido**: "No pudimos leer tu PDF. Reexporta el bodygraph desde la fuente oficial y vuelve a subirlo."

## Instrucciones de re-export
- Reexportar el bodygraph **en PDF** desde MyHumanDesign o Genetic Matrix.
- No usar capturas de pantalla, fotos, scans ni PDFs editados.
- Mantener el PDF completo sin recortes.

## Referencias
- `.beads/docs/BDG-PDF-PARSING.md`
- `docs/bodygraph-extraction-notes.md`
- `test-assets/bodygraph-sources/myhumandesign-chart.pdf`
- `test-assets/bodygraph-sources/chart1773003080.pdf`
