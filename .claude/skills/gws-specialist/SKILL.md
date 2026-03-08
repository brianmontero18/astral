---
name: gws-specialist
type: reference
description: Expert on Google Workspace CLI — access Drive, Calendar, and Docs via gws + gcloud ADC. Always validates against official docs before acting.
---

# Google Workspace CLI Specialist Skill

> **Purpose**: Expert guidance on gws CLI — accessing Google Workspace from agents and terminal.
> **Reference**: `~/toolkit/docs/gws-manual.md` — user manual and operational guide.
> **Invoked by**: user, executor, or any agent needing Google Workspace access.

---

## When to Use

- Reading or writing Google Docs from agents
- Creating formatted documents with headings, bold, code blocks, images
- Searching or listing files in Google Drive
- Checking calendar events
- Troubleshooting auth, scopes, or token issues with gws
- Adding new Google Workspace scopes to the ADC

## When NOT to Use

- Sending email (gmail.send scope not configured)
- Admin operations (no admin perms on corporate account)
- General file operations on local filesystem (use filesystem tools)
- Memory/task tracking (use letta-specialist or beads-specialist)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh gws`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/gws-manual.md` — especially "Google Docs API Patterns" for doc creation/formatting
2. **Verify** against official docs before making changes (see Sources in the manual)
3. **Check** detection rules below against the current state
4. **Execute** using `~/toolkit/scripts/gws-auth.sh` _(Prevents: 403 errors from missing token — raw gws lacks ADC injection)_
5. **Update** the manual if something changed

---

## Detection Rules

### Infrastructure

> **Detect:** `gws` binary not found (`which gws` fails). **Severity:** BLOCKER.
> **Fix:** `npm install -g @googleworkspace/cli --registry https://registry.npmjs.org`

> **Detect:** gcloud ADC not configured or expired (`gcloud auth application-default print-access-token` fails). **Severity:** BLOCKER.
> **Fix:** Run `gcloud auth application-default login --scopes=...` (see manual for full command with all scopes)

> **Detect:** 403 "insufficient authentication scopes" on API call. **Severity:** WARNING.
> **Fix:** Re-auth adding the missing scope to `--scopes` flag. All scopes must be listed together — scopes are not incremental.

> **Detect:** `gws-auth.sh` missing from `~/toolkit/scripts/`. **Severity:** BLOCKER.
> **Fix:** Recreate from manual (see Wrapper Script section)

> **Detect:** Agent using raw `gws` instead of `gws-auth.sh`. **Severity:** WARNING.
> **Fix:** Always use wrapper — raw gws lacks token injection and will get 403s

> **Detect:** gws version outdated (`gws --version` vs latest on npm). **Severity:** SUGGESTION.
> **Fix:** `npm update -g @googleworkspace/cli`. Check breaking changes in releases before updating.

> **Detect:** Agent trying to use `gws mcp` command. **Severity:** BLOCKER.
> **Fix:** MCP was removed in v0.8.0 (PR #275). Use CLI via Bash tool instead.

### Google Docs operations

> **Detect:** Agent using `docs +write` for long text or text with special characters. **Severity:** WARNING.
> **Fix:** `+write` fails silently. Always use `batchUpdate` with `insertText` request. For complex JSON, write to temp file and use `--json "$(cat /tmp/file.json)"`. _(Prevents: content that appears written but is actually empty)_

> **Detect:** Agent trying to format text before inserting it. **Severity:** WARNING.
> **Fix:** Insert text first, then read the doc to get paragraph indices, then apply formatting in a separate `batchUpdate`. Formatting needs exact character indices that only exist after insertion.

> **Detect:** Agent building `batchUpdate` with multiple `insertText` in ascending index order. **Severity:** WARNING.
> **Fix:** Multiple insertions in one batchUpdate must go from highest to lowest index. Each insertion shifts all subsequent indices. _(Prevents: corrupted text positions)_

> **Detect:** Agent trying to anchor a comment to specific text in Google Docs. **Severity:** WARNING.
> **Fix:** Anchored comments on Google Docs do NOT work via API — known bug since 2016 (Google Issue Tracker #36763384, #357985444). Comments appear in sidebar without text highlight. Use unanchored comments instead.

> **Detect:** Agent inserting an image from a non-public URL (CDN with auth, redirects, SVG). **Severity:** WARNING.
> **Fix:** `insertInlineImage` requires publicly accessible URLs. No SVG. No redirects. GitHub avatars (`avatars.githubusercontent.com`) work reliably. Assume any non-static-hosting URL will fail.

> **Detect:** Agent using `--json` inline with `!` or complex nested quotes. **Severity:** WARNING.
> **Fix:** Write JSON to temp file, then `--json "$(cat /tmp/file.json)"`. Bash interprets `!` as history expansion, breaking the JSON. _(Prevents: invalid JSON parse errors or silent data corruption)_

> **Detect:** Agent creates a doc but doesn't share it. **Severity:** SUGGESTION.
> **Fix:** New docs are only visible to the creator. Use `gws-auth.sh drive permissions create` to share. See manual for syntax.

---

## Use Cases

```bash
# Search Drive files
gws-auth.sh drive files list --params '{"pageSize": 10, "q": "name contains '\''feature'\''"}'

# Create a Google Doc
gws-auth.sh docs documents create --json '{"title": "New Document"}'

# Write content (use batchUpdate, NOT +write)
gws-auth.sh docs documents batchUpdate --params '{"documentId": "DOC_ID"}' \
  --json '{"requests": [{"insertText": {"location": {"index": 1}, "text": "Hello world"}}]}'

# Read a Google Doc (to get indices for formatting)
gws-auth.sh docs documents get --params '{"documentId": "DOC_ID"}'

# Format text (after inserting)
gws-auth.sh docs documents batchUpdate --params '{"documentId": "DOC_ID"}' \
  --json '{"requests": [{"updateParagraphStyle": {"range": {"startIndex": 1, "endIndex": 12}, "paragraphStyle": {"namedStyleType": "HEADING_1"}, "fields": "namedStyleType"}}]}'

# List today's calendar events
gws-auth.sh calendar events list --params '{"calendarId":"primary","timeMin":"TODAY_00:00:00Z","timeMax":"TOMORROW_00:00:00Z","singleEvents":true}'

# Inspect API schema (no token needed — local introspection)
gws schema drive.files.list --resolve-refs
```

---

## Refresh Mode

**Schedule**: weekly
**Procedure**:
1. Check https://github.com/googleworkspace/cli/releases for new versions
2. Compare release notes against manual's "Limitaciones conocidas" and "CLI reference"
3. If breaking changes: update manual, test wrapper, update this skill's detection rules
4. Update `last_refreshed` in `config/tools.json`

---

## Severity Reference

| Level | Meaning | Action |
|-------|---------|--------|
| BLOCKER | Skill cannot function — gws unusable | Fix before proceeding |
| WARNING | Skill works but with degraded behavior or risk | Fix soon, can continue cautiously |
| SUGGESTION | Improvement opportunity, no functional impact | Fix when convenient |

---

## Self-Check

Before providing the summary below, verify:
- [ ] The manual was read for the specific topic being addressed
- [ ] All detection rules were evaluated against current state (none skipped)
- [ ] Every API command in the output uses `gws-auth.sh`, not raw `gws` (`gws schema` is exempt — local introspection)
- [ ] Google Docs operations follow the canonical flow: create → insert text → read indices → format
- [ ] No `+write` used for anything beyond trivial short text
- [ ] batchUpdate insertions go from highest to lowest index
- [ ] Output JSON from gws was parsed correctly (gws returns JSON by default)
- [ ] Severity assignments are consistent with the Severity Reference table above

---

## Summary Template

```
### Google Workspace CLI: {action}
- **Service**: {drive|calendar|docs|sheets|...}
- **Command**: gws-auth.sh {full command}
- **Result**: {summary of what happened}
- **Detection rules checked**: {all checked or list of violations found}
- **Issues**: {any detection rule violations found, or "None"}
```
