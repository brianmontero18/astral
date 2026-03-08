---
name: voicebox-specialist
type: reference
description: Expert on Voicebox local voice synthesis studio. Guides setup, voice cloning, TTS generation, API integration, and troubleshooting. Always validates against official docs before acting.
---

# Voicebox Specialist Skill

> **Purpose**: Expert guidance on Voicebox — voice cloning, speech generation, stories, API integration, and troubleshooting.
> **Reference**: `~/toolkit/docs/voicebox-manual.md` — user manual, setup guide, and API reference.
> **Invoked by**: user, executor, or any agent working with voice synthesis workflows.

---

## When to Use

- Setting up or troubleshooting Voicebox (backend, frontend, models)
- Creating voice profiles and cloning voices
- Generating speech via UI or API
- Building multi-voice stories/narratives
- Integrating Voicebox API into automation pipelines
- Transcribing audio with Whisper
- Diagnosing MLX/PyTorch backend issues on Apple Silicon
- Planning voice-powered features in projects

## When NOT to Use

- General audio editing unrelated to Voicebox (use dedicated audio tools)
- Memory architecture decisions (use `memory-architect`)
- Application code implementation (use `executor`)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh voicebox`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/voicebox-manual.md` for current setup, API reference, and known pain points
2. **Verify** against official Voicebox docs and repo before making changes (see Sources in manual)
3. **Check** detection rules below against the current state
4. **Test** changes by hitting the API (`curl http://localhost:17493/health`)
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Backend not running on port 17493 | BLOCKER | Start: `cd ~/voicebox && backend/venv/bin/uvicorn backend.main:app --reload --port 17493` |
| 2 | Backend shows "PyTorch" instead of "MLX" on Apple Silicon | WARNING | Install MLX deps: `backend/venv/bin/pip install -r backend/requirements-mlx.txt` |
| 3 | Python version 3.14+ detected | BLOCKER | Use Python 3.12 or 3.13. Recreate venv: `/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv backend/venv` |
| 4 | Model download stuck at 0% or fails | WARNING | Check disk space and HuggingFace connectivity. Clear cache: `rm -rf ~/.cache/huggingface/hub/models--Qwen*` |
| 5 | transformers version conflict (mlx-audio vs qwen-tts) | WARNING | Install the version needed: `transformers==5.0.0rc3` for MLX priority, `transformers==4.57.3` for qwen-tts priority |
| 6 | Port 17493 already in use | WARNING | Kill: `lsof -ti:17493 \| xargs kill -9` |
| 7 | No voice profiles created | SUGGESTION | Create first profile via UI or API: `POST /profiles` + `POST /profiles/{id}/samples` |
| 8 | Generation returns error on first run | WARNING | Model auto-downloads on first generation (~2-4GB). Wait for download to complete. |
| 9 | Backend requires internet despite models being cached | WARNING | HuggingFace checks config.json online. Workaround: `HF_HUB_OFFLINE=1` env var before starting backend. Issue #150. |
| 10 | API request hangs on first call after restart | WARNING | Model not auto-loaded on startup. Open UI and click a profile to trigger load, or use a generous timeout (60s+) on first API call. Issue #151. |

---

## Use Cases

### Voice cloning for content creation

```bash
# 1. Create a profile
curl -X POST http://localhost:17493/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "Narrator", "language": "en"}'

# 2. Upload a voice sample (5-30 seconds of clear speech)
curl -X POST http://localhost:17493/profiles/{profile_id}/samples \
  -F "file=@voice-sample.wav"

# 3. Generate speech with cloned voice
curl -X POST http://localhost:17493/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Welcome to the show.", "profile_id": "{profile_id}", "language": "en"}'
```

### Multi-voice podcast/narrative

Use Stories API to compose multi-speaker content:
1. Create profiles for each speaker
2. Create a story: `POST /stories`
3. Add items with text + assigned profile per segment
4. Reorder, trim, split clips via API
5. Export final audio: `GET /stories/{id}/export-audio`

### Automation pipeline

Voicebox API integrates into any workflow:
- CI/CD: generate audio assets as part of build
- Chatbots: real-time TTS via `/generate/stream`
- Game dev: batch generate dialogue lines via script
- Transcription: `POST /transcribe` for meeting notes

### Transcription

```bash
curl -X POST http://localhost:17493/transcribe -F "file=@meeting.wav"
```

---

## Refresh Mode

**Last refreshed**: 2026-02-26

To update the knowledge snapshot:

1. Read `~/toolkit/docs/voicebox-manual.md` — locate the **Sources** section at the bottom
2. Visit each URL in the Sources tables using WebSearch and FetchUrl:
   - **Official Docs**: check repo README, CONTRIBUTING.md, releases for new versions
   - **GitHub issues**: scan open issues for new pain points, regressions, or resolved bugs
   - **Community**: search for new blog posts, tutorials, reviews about Voicebox
   - **Related**: check Qwen3-TTS and mlx-audio repos for upstream changes
3. Compare findings with current snapshot content:
   - New version released? Update "Datos clave" and setup instructions
   - New issues discovered? Update "Known pain points" table
   - Bug fixed? Move from pain points to resolved, update detection rules
   - New feature added? Update API endpoints, flujo de uso, casos de uso
   - Dependency changes? Update setup instructions and troubleshooting
4. Update changed sections in `~/toolkit/docs/voicebox-manual.md`
5. Update the "Last refreshed" date in this skill and in the manual's Snapshot field
6. If detection rules changed, update the table above

**Search queries for refresh**:
- `site:github.com jamiepine/voicebox` (repo changes, new issues)
- `voicebox jamiepine Qwen3-TTS 2026` (community content)
- `site:github.com Blaizzy/mlx-audio qwen` (upstream MLX issues)

---

## Self-Check

Before providing the summary below, verify:
1. Backend health: `curl -s http://localhost:17493/health`
2. Backend type: logs should show "Backend: MLX" on Apple Silicon
3. At least one voice profile exists: `curl -s http://localhost:17493/profiles`
4. Model loaded: `curl -s http://localhost:17493/models/status`

---

## Summary Template

```
### Voicebox Status
- **Backend**: {running/down} (port 17493, backend: {MLX/PyTorch})
- **Frontend**: {running/down} (port {5173/5174})
- **Models**: Qwen3-TTS {loaded/not loaded} ({0.6B/1.7B})
- **Whisper**: {loaded/not loaded}
- **Profiles**: {N} voice profiles
- **Python**: {version} (venv: ~/voicebox/backend/venv)
- **Platform**: {Apple Silicon MLX / PyTorch CUDA / PyTorch CPU}
- **Issues found**: {list or "none"}
```

---

## Quick Command Reference

| I want to... | Command |
|--------------|---------|
| Start backend | `cd ~/voicebox && backend/venv/bin/uvicorn backend.main:app --reload --port 17493` |
| Start web frontend | `cd ~/voicebox/web && bun run dev` |
| Start desktop app | `cd ~/voicebox && bun run dev` |
| Check backend health | `curl http://localhost:17493/health` |
| List profiles | `curl http://localhost:17493/profiles` |
| Generate speech | `curl -X POST http://localhost:17493/generate -H "Content-Type: application/json" -d '{"text":"...", "profile_id":"...", "language":"en"}'` |
| Transcribe audio | `curl -X POST http://localhost:17493/transcribe -F "file=@audio.wav"` |
| Check model status | `curl http://localhost:17493/models/status` |
| Download model | `curl -X POST http://localhost:17493/models/download -H "Content-Type: application/json" -d '{"model_name":"..."}'` |
| Export story audio | `curl http://localhost:17493/stories/{id}/export-audio -o output.wav` |
| Kill stale backend | `lsof -ti:17493 \| xargs kill -9` |
| Open API docs | `open http://localhost:17493/docs` |
