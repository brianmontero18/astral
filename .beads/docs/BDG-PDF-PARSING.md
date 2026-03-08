# BDG PDF Parsing — Canonical Notes

## Scope
MVP: **PDF-only** extraction for Human Design bodygraphs.
Sources allowed: **MyHumanDesign** + **Genetic Matrix** (tropical).
Reject any other format/source.

See: `.beads/docs/BDG-PDF-CONTRACT.md` for input contract + UX rejection copy.

## Evidence (spike results)
Both PDFs are **text-extractable** and yield deterministic `gate.line` lists.
- MyHumanDesign PDF: 26 `gate.line` values detected in stable order.
- Genetic Matrix PDF: 26 `gate.line` values detected after anchor; filter `0.1` coords.

## Parsing Heuristics
### MyHumanDesign PDF
- Extract all `\b\d{1,2}\.\d\b`.
- Expect **exactly 26** values.
- Order in PDF is stable:
  - **Design (13)** then **Personality (13)**.
- Planet order (map list positions → planet):
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

### Genetic Matrix PDF
- Anchor from `www.geneticmatrix.com` onward.
- Extract all `\b\d{1,2}\.\d\b`.
- Filter **`0.1`** (coords noise).
- Expect **exactly 26** values.
- Order in PDF is stable:
  - **Design (13)** then **Personality (13)**.
- Planet order (map list positions → planet):
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

## Validation Rules (fail‑closed)
- Must extract **26** gate.line values.
- Gate in **1–64**, line in **1–6**.
- If any mismatch → reject and instruct user to re‑export PDF.

## Reference Fixtures
- `test-assets/bodygraph-sources/myhumandesign-chart.pdf`
- `test-assets/bodygraph-sources/chart1773003080.pdf`
