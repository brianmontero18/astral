# Astral Architecture

Last updated: 2026-05-24.

This file is intentionally short. The canonical architecture map lives in
[`docs/architecture/project-overview.md`](docs/architecture/project-overview.md).
Keep detailed region ownership, entry files, state, tests, and cross-region
dependencies there so agents do not have to reconcile two competing maps.

## Read Order

1. [`AGENTS.md`](AGENTS.md) — repo rules, V1/V2 product constraints, Beads workflow.
2. [`docs/architecture/project-overview.md`](docs/architecture/project-overview.md) — current system map by region.
3. [`docs/architecture/chat-llm-system.md`](docs/architecture/chat-llm-system.md) — current chat/LLM architecture.
4. [`docs/INDEX.md`](docs/INDEX.md) — categorized docs index.

## Durable Invariants

- `users.profile` is the canonical active Human Design profile in V1.
- V1 has one active chart per user; re-upload/replace overwrites the active profile.
- `users.profile_asset_id` links the active profile to the source asset when there is one.
- Generic asset upload/deletion manages source files and does not redefine the active profile.
- Chat, report, transits, and bodygraph display read the active profile from `users.profile`.
- Chat uses `agent-service-v2.ts` with Vercel AI SDK and deterministic HD tools; the legacy v1 path and `FEATURE_CHAT_USE_TOOLS` do not exist.
- PDF extraction is deterministic only (`pdfjs-dist` + provider parsers). Image-only PDFs and unsupported providers are rejected instead of using Vision fallback.
- Bodygraph PDF export is SVG-to-PDF vector rendering via `pdfkit` + `svg-to-pdfkit`.
- Remote MCP is gated by `FEATURE_REMOTE_MCP`; V3 multi-profile capability work waits on the V2 multiple-profiles model.

## Maintenance Rule

When code changes architecture, update the region map first. If a historical doc
disagrees with the current map, mark the historical doc explicitly instead of
duplicating a second current-state explanation here.
