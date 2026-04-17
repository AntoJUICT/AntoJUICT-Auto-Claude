# Kanban Superpowers Token Optimization — Design

**Date:** 2026-04-17
**Status:** Design — awaiting implementation plan
**Scope:** Kanban task execution pipeline only (planner, coder, qa_reviewer, qa_fixer). Does NOT change roadmap, ideation, or the spec-creation pipeline.

## Problem

The kanban pipeline ships large static system prompts on every SDK call:

- `apps/backend/prompts/coder.md` — 33KB (~8k tokens)
- `apps/backend/prompts/planner.md` — 28KB (~7k tokens)
- `apps/backend/prompts/qa_reviewer.md` — 16KB (~4k tokens)
- `apps/backend/prompts/qa_fixer.md` — ~12KB (~3k tokens)

A medium task (≈5 subtasks × ≈10 SDK turns per subtask, plus 2-3 QA cycles) sends ~475k system-prompt tokens, mostly unchanged across calls. No prompt caching is configured in `apps/backend/core/client.py`. No token differentiation per agent stage.

The user reports token usage that is out of proportion to the work being done — both in per-task execution and in auxiliary flows (roadmap, ideation). This spec addresses the kanban pipeline only; roadmap and ideation are deferred.

## Goals

1. Reduce total API tokens per kanban task by **~50-65%** (estimate; verified by token-measurement after rollout).
2. Bring Auto-Claude token usage to within ~1.0-1.3× of an equivalent direct Claude Code + superpowers terminal session.
3. Add a visual-review feature: auto-start a local dev server when a card enters Human Review, open in external browser.

## Non-goals

- Roadmap and ideation token optimization (separate spec).
- Spec-pipeline refactoring (gatherer/researcher/writer/critic, complexity_assessor stay as-is).
- Spec chunking / selective spec injection (separate concern, out of scope).
- Bundling superpowers inside Auto-Claude (users install the plugin themselves).
- Backwards compatibility with pre-superpowers behavior (no feature flag, no legacy prompt fallback).

## Key Decisions

| Decision | Choice |
|----------|--------|
| Scope within kanban | planner, coder, qa_reviewer, qa_fixer (4 stages) |
| Integration model | Hybrid: small Auto-Claude shell prompts (~1-2KB) delegate "how" to superpowers skills |
| Orchestration | Planner/QA: direct skill invocation. Coder: `subagent-driven-development` with fresh context per subtask |
| Deployment | Prerequisite: user installs superpowers plugin via `/plugin install superpowers@claude-plugins-official` |
| Fallback when superpowers missing | Hard error at agent spawn; no legacy prompt path kept |
| Prompt caching | `cache_control: {"type": "ephemeral"}` on shell prompt prefix in `core/client.py` |
| Visual review | Auto-start dev server on "Human Review" status; external browser; manual stop + 60min idle timeout |
| Dev-command detection | Auto-detect (`package.json` scripts, `Procfile`, `docker-compose.yml`, `Makefile`); confirm-on-first-use; persisted per project |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Kanban UI (Electron renderer)                                    │
│  ├─ Card: preview badge ("Starting…" / "Ready :5174" / "None")   │
│  └─ First-time modal: "Use `npm run dev`?"                       │
└───────────────┬──────────────────────────────────────────────────┘
                │ IPC
┌───────────────▼──────────────────────────────────────────────────┐
│ Electron main                                                    │
│  ├─ preview/dev-server-manager.ts   (spawn + lifecycle)          │
│  ├─ preview/command-detector.ts     (scan project files)         │
│  ├─ preview/port-allocator.ts       (pool 5173-5199)             │
│  └─ ipc-handlers/preview-handlers.ts                             │
└───────────────┬──────────────────────────────────────────────────┘
                │ spawns agents via claude-agent-sdk
┌───────────────▼──────────────────────────────────────────────────┐
│ Backend agents (shell prompts invoke superpowers skills)         │
│  ├─ planner.md    → Skill("writing-plans")                       │
│  ├─ coder.md      → Skill("subagent-driven-development")         │
│  │                    ↳ per subtask: Skill("executing-plans")    │
│  │                                 + Skill("test-driven-dev...")│
│  ├─ qa_reviewer.md → Skill("verification-before-completion")     │
│  │                 + Skill("requesting-code-review")             │
│  └─ qa_fixer.md    → Skill("receiving-code-review")              │
│                    + Skill("systematic-debugging")               │
│                                                                  │
│  core/client.py: startup verifies ~/.claude/skills/*/SKILL.md    │
│                  sets cache_control on shell prompt              │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### Backend

**Prompts (`apps/backend/prompts/`):**

- `planner.md` — shrink from 28KB → ~1-2KB. Contents: role, spec-location convention, output format (`implementation_plan.json` schema ref), required output paths, then: "Invoke the `writing-plans` skill to produce the plan."
- `coder.md` — shrink from 33KB → ~1-2KB. Contents: role, worktree path convention, `.auto-claude/specs/` structure, then: "Invoke `subagent-driven-development`. Each subtask subagent should use `executing-plans` and `test-driven-development`."
- `qa_reviewer.md` — shrink from 16KB → ~1KB. Role, QA criteria location, acceptance format, then invoke `verification-before-completion` and `requesting-code-review`.
- `qa_fixer.md` — shrink to ~1KB. Role, QA_FIX_REQUEST.md location, then invoke `receiving-code-review` and `systematic-debugging`.

Each shell keeps the existing Auto-Claude critical rules that are not covered by superpowers (i18n, cross-platform abstraction, no console.log, Claude Agent SDK only).

**Client (`apps/backend/core/client.py`):**

- New startup check at `create_client()`: verify presence of `~/.claude/skills/{writing-plans,executing-plans,subagent-driven-development,test-driven-development,verification-before-completion,requesting-code-review,receiving-code-review,systematic-debugging}/SKILL.md`. If any missing, raise `SuperpowersNotInstalledError` with install command in the message. Agent spawn aborts; error surfaces to the kanban UI.
- Add `cache_control: {"type": "ephemeral"}` marker at the end of the shell system prompt when constructing the `ClaudeSDKClient` request. Applies to all four stages. Implementation plan to verify how `claude-agent-sdk` exposes cache_control on the system parameter and adjust accordingly (may be via structured `system` blocks list rather than plain string).
- No changes to model selection (stays Sonnet per phase_config.py).

### Frontend (Electron)

**Main process (`apps/frontend/src/main/preview/`):** new module.

- `dev-server-manager.ts` — exposes `start(projectPath, worktreePath, cmd, port)`, `stop(taskId)`, `status(taskId)`. Spawns child process with `cwd = worktreePath`. Passes the allocated port via `PORT=<n>` env var AND substitutes any `${PORT}` placeholder in the command string (so users can write `vite --port ${PORT}` if their tool ignores the env var). Waits for readiness by polling `http://localhost:<port>` with 200-OK (or 10s timeout → failure state). Tracks idle timer (60 min; reset on renderer keep-alive ping). Kills process + releases port on stop / timeout / crash.
- `command-detector.ts` — scans in order: `package.json` scripts (`dev`, `start`), `Procfile` (web: line), `docker-compose.yml` services with exposed ports, `Makefile` targets matching `dev|serve|run`. Returns best guess or `null`.
- `port-allocator.ts` — maintains in-memory set of allocated ports in range 5173-5199. Returns first free port; throws if pool exhausted.

**IPC handler (`apps/frontend/src/main/ipc-handlers/preview-handlers.ts`):** expose `preview:start`, `preview:stop`, `preview:status`, `preview:detect` to renderer via `window.electronAPI.preview.*`. Handles auto-open of URL via `shell.openExternal()`.

**Project config:** extend existing project-settings store with `devCommand?: string` and `devPort?: number` fields. Persisted in `.auto-claude/project-config.json`.

**Renderer (`apps/frontend/src/renderer/`):**

- Kanban card: badge component showing preview state (Idle / Starting / Ready (:port) / Failed / Stopped / None). "Stop Preview" and "Open" buttons when Ready.
- First-time modal: on entering Human Review with no `devCommand` set, show modal "We detected `<cmd>` — use this to start the preview?" with Confirm / Edit / Skip.

All new UI text uses `react-i18next` with new keys in `en/kanban.json` and `fr/kanban.json`.

## Data Flow (kanban task)

1. User creates task → spec pipeline runs as today → produces `.auto-claude/specs/XXX-name/spec.md` + requirements.
2. **Planner stage:** Auto-Claude spawns planner agent with new shell prompt. Agent invokes `writing-plans` skill, reads spec, writes `implementation_plan.json`.
3. **Coder stage:** Auto-Claude spawns coder orchestrator with new shell prompt. Orchestrator invokes `subagent-driven-development`. For each subtask in the plan, dispatches a fresh subagent. Each subagent gets the subtask description + invokes `executing-plans` + `test-driven-development`. Fresh context per subtask → no accumulated history.
4. **QA reviewer stage:** shell-prompt agent invokes `verification-before-completion` then `requesting-code-review`. Produces `qa_report.md`.
5. If QA fails: **QA fixer stage** runs via its shell prompt → invokes `receiving-code-review` + `systematic-debugging`. Writes fixes. Loop to QA reviewer. (Existing Auto-Claude retry-limit logic unchanged.)
6. QA passes → card transitions to **Human Review**.
7. Preview flow:
   a. `preview-handlers` reads `devCommand` from project config.
   b. If missing: detector runs → if found → first-time modal to user. If skipped or none found → card shows "No preview available"; skip to step (e).
   c. `port-allocator` picks free port. `dev-server-manager.start()` spawns subprocess in worktree dir.
   d. Poll for readiness. On ready: `shell.openExternal('http://localhost:<port>')`; update card to "Ready :<port>".
   e. User approves or rejects.
   f. On approve/reject/manual stop/60min idle/crash: `dev-server-manager.stop()` kills subprocess, releases port, updates card.
8. Approved → existing merge flow runs (unchanged).

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Superpowers plugin not installed at agent spawn | `SuperpowersNotInstalledError` surfaces in kanban; card shows install command; task stays in current status |
| Skill invocation fails mid-task | Subtask marked failed; existing `coder_recovery` pipeline picks up (retained as safety net) |
| Dev command not auto-detectable | Card shows "No preview available" badge; approve/reject still works |
| Dev server exits non-zero within 10s | Card shows "Preview failed: <last stderr line>" + Retry button |
| Port pool exhausted | Card shows "No free port — stop another preview"; user can Stop elsewhere |
| Dev server crashes during review | Watchdog detects; card shows "Stopped unexpectedly" + Restart button |
| User closes Auto-Claude | All running preview subprocesses killed on app quit (`beforeQuit` hook) |

## Testing

**Backend (pytest):**

- Unit: new shell prompt files load correctly; `create_client()` startup check finds/misses skills and raises appropriate error.
- Integration: coder invocation path reaches `subagent-driven-development` (mock SDK response); cache_control marker present in request payload.

**Frontend unit (Vitest):**

- `command-detector` across fixtures: Vite, Next.js, CRA, monorepo with multiple frontends, Procfile, docker-compose, no-dev-server.
- `port-allocator`: allocate/release lifecycle; exhaustion throws; released ports reused.
- First-time modal: detection hit → modal shown; confirm persists to project config; edit; skip.

**Frontend E2E (Playwright):**

- Full flow: create task → plan → code → QA pass → Human Review → preview server starts → URL reachable from Playwright fetch → user clicks Stop → subprocess terminated, port freed.

**Token measurement:**

- Instrument existing usage-monitor to log `usage.input_tokens`, `usage.output_tokens`, `usage.cache_creation_input_tokens`, `usage.cache_read_input_tokens` per SDK response, tagged by agent stage.
- Baseline: run a representative task on the current branch before applying this spec; record totals.
- After: run the same task after implementation; compare. **Target: ≥50% reduction in total input tokens; non-zero `cache_read_input_tokens` on coder subtask turn 2+.**

## Token Savings (estimated)

Per medium task (5 subtasks × 10 turns + 2 QA cycles):

| Metric | Before | After (no cache) | After (with cache) |
|--------|--------|------------------|-------------------|
| System-prompt overhead | ~475k tokens | ~30k | ~30k input + ~3k cache-read reuse |
| Total API tokens | baseline | **~30-45% less** | **~50-65% less** |
| Coder subtask turn 2+ | 8k+ each | 2-3k each | ~0.3k cache-read + new content |

Ratio vs. direct Claude Code + superpowers terminal session: **~1.0-1.3×** (residual overhead: Auto-Claude shell metadata, Auto-Claude MCP tool defs, spec injection).

## Rollout

Single PR to `claude/copy-aperant-main-cMFRy` (this fork's active branch). No feature flag. The hard-error startup check ensures users who haven't installed superpowers see a clear install instruction immediately rather than running with broken prompts.

Changelog entry: breaking change — requires superpowers plugin installation.

## Open Questions / Future Work

- Spec chunking (selective spec injection per subtask) — separate spec.
- Applying the same pattern to roadmap and ideation flows — separate specs.
- Bundling superpowers as a default install during Auto-Claude onboarding — revisit once user-feedback arrives.
