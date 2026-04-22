# Superpowers Pipeline Redesign — Plan A: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de volledige backend pipeline (spec/qa/runners) door vijf nieuwe pipeline-modules die het superpowers-process volgen: brainstorm → plan schrijven → uitvoeren → afronden.

**Architecture:** Vier Python runner-scripts (brainstorm_runner, plan_writer_runner, executor_runner, finisher_runner) in het bestaande `runners/` patroon. Elk script communiceert via stdin/stdout JSON. De bestaande Claude SDK client, worktree infrastructuur en recovery manager blijven intact. Nieuwe IPC-kanalen koppelen de backend aan de frontend.

**Tech Stack:** Python 3.12, Claude Agent SDK, asyncio, JSON IPC via stdin/stdout, TypeScript IPC handlers

---

### Task 1: Verwijder oude backend code

**Files:**
- Delete: `apps/backend/spec/` (hele map)
- Delete: `apps/backend/qa/` (hele map)
- Delete: `apps/backend/runners/spec_runner.py`
- Delete: `apps/backend/runners/pipeline_runner.py`

- [ ] **Stap 1: Verwijder spec/ map**

```bash
cd apps/backend
rm -rf spec/
```

Verify: `ls spec/` moet fout geven.

- [ ] **Stap 2: Verwijder qa/ map**

```bash
rm -rf qa/
```

Verify: `ls qa/` moet fout geven.

- [ ] **Stap 3: Verwijder oude runners**

```bash
rm runners/spec_runner.py runners/pipeline_runner.py
```

- [ ] **Stap 4: Controleer op kapotte imports**

```bash
cd apps/backend
grep -r "from spec\." . --include="*.py" -l
grep -r "from qa\." . --include="*.py" -l
grep -r "import spec" . --include="*.py" -l
grep -r "import qa" . --include="*.py" -l
```

Verwijder of comment elke gevonden import die verwijst naar `spec.` of `qa.`.

- [ ] **Stap 5: Commit**

```bash
git add -A
git commit -m "chore: remove old spec and qa pipeline"
```

---

### Task 2: Maak pipeline/ directory en prompt-bestanden

**Files:**
- Create: `apps/backend/pipeline/__init__.py`
- Create: `apps/backend/prompts/brainstorm.md`
- Create: `apps/backend/prompts/plan_writer.md`

- [ ] **Stap 1: Maak pipeline directory**

```bash
mkdir -p apps/backend/pipeline
touch apps/backend/pipeline/__init__.py
```

- [ ] **Stap 2: Schrijf brainstorm.md prompt**

Maak `apps/backend/prompts/brainstorm.md`:

```markdown
You are helping a developer plan a new feature for their software project.
Your goal is to understand exactly what they want to build.

Ask ONE clear, focused question at a time. Keep questions short.
Focus on: what the feature does, who uses it, edge cases, constraints.

When you have enough information to write a complete implementation plan, respond with exactly:
READY: true
SUMMARY:
<write a concise summary of what needs to be built, 3-8 bullet points>

Until then, ask your next question and nothing else.
```

- [ ] **Stap 3: Schrijf plan_writer.md prompt**

Maak `apps/backend/prompts/plan_writer.md`:

```markdown
You are writing an implementation plan for a software feature.

You will receive:
1. A feature summary (what to build)
2. Access to the project codebase

Your job:
1. Explore the codebase to understand relevant patterns and files
2. Write TWO documents:

## Document 1: functional_plan.md
A short, plain-language overview. No file paths, no code, no technical jargon.
Format:
```
## Wat wordt gebouwd
- <bullet: one user-facing feature>
- <bullet: one user-facing feature>
...

## Hoe het werkt
<2-3 sentences in plain Dutch about the approach>
```

## Document 2: implementation_plan.json
A machine-readable task list in this exact format:
{
  "feature": "<feature name>",
  "phases": [
    {
      "id": "phase_1",
      "name": "<phase name>",
      "subtasks": [
        {
          "id": "<unique-id>",
          "description": "<what to implement>",
          "files_to_modify": ["<path>"],
          "files_to_create": ["<path>"],
          "verification": {"type": "command", "command": "<verify command>"},
          "status": "pending"
        }
      ]
    }
  ]
}

Save functional_plan.md to: <spec_dir>/functional_plan.md
Save implementation_plan.json to: <spec_dir>/implementation_plan.json

Keep tasks small (one logical change per task). Aim for 3-8 tasks total.
```

- [ ] **Stap 4: Commit**

```bash
git add apps/backend/pipeline/__init__.py apps/backend/prompts/brainstorm.md apps/backend/prompts/plan_writer.md
git commit -m "feat(pipeline): add pipeline directory and prompt templates"
```

---

### Task 3: Implementeer brainstorm_runner.py

**Files:**
- Create: `apps/backend/runners/brainstorm_runner.py`

De brainstorm runner is een one-shot subprocess. Hij ontvangt de volledige gespreksgeschiedenis, stuurt die naar Claude, en geeft het antwoord terug.

- [ ] **Stap 1: Schrijf brainstorm_runner.py**

Maak `apps/backend/runners/brainstorm_runner.py`:

```python
#!/usr/bin/env python3
"""
Brainstorm runner — one-shot, takes conversation history, returns next Claude response.

Input  (stdin JSON):  {"messages": [{"role": "user"|"assistant", "content": str}], "project_dir": str}
Output (stdout JSON): {"response": str, "ready_to_plan": bool, "spec_summary": str | null}
"""
import asyncio
import json
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.client import create_client


def load_brainstorm_prompt() -> str:
    prompt_file = Path(__file__).parent.parent / "prompts" / "brainstorm.md"
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    return "Ask ONE question at a time to understand what the user wants to build. When ready, respond with READY: true\nSUMMARY:\n<summary>"


def build_messages(history: list[dict]) -> str:
    """Format conversation history as a single prompt string."""
    system = load_brainstorm_prompt()
    lines = [system, ""]
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        prefix = "User:" if role == "user" else "Assistant:"
        lines.append(f"{prefix} {content}")
    lines.append("Assistant:")
    return "\n".join(lines)


async def run(messages: list[dict], project_dir: str) -> dict:
    prompt = build_messages(messages)
    client = create_client(
        project_dir=Path(project_dir),
        spec_dir=Path(project_dir),
        model=None,
        agent_type="brainstorm",
        fast_mode=True,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        from core.error_utils import safe_receive_messages
        async for msg in safe_receive_messages(client, caller="brainstorm"):
            if type(msg).__name__ == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock":
                        response_text += block.text

    ready = "READY: true" in response_text
    spec_summary = None
    if ready and "SUMMARY:" in response_text:
        spec_summary = response_text.split("SUMMARY:", 1)[1].strip()
        response_text = response_text.split("READY: true")[0].strip()

    return {
        "response": response_text.strip() if not ready else "Super, ik heb genoeg informatie. Ik ga nu het plan schrijven.",
        "ready_to_plan": ready,
        "spec_summary": spec_summary,
    }


if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    messages = data.get("messages", [])
    project_dir = data.get("project_dir", ".")
    result = asyncio.run(run(messages, project_dir))
    print(json.dumps(result, ensure_ascii=False))
```

- [ ] **Stap 2: Test de runner handmatig**

```bash
cd apps/backend
echo '{"messages": [{"role": "user", "content": "Ik wil een delete knop toevoegen aan mijn Kanban taakkaarten"}], "project_dir": "."}' | .venv/Scripts/python.exe runners/brainstorm_runner.py
```

Verwacht: JSON met `response` (een vraag) en `ready_to_plan: false`.

- [ ] **Stap 3: Commit**

```bash
git add apps/backend/runners/brainstorm_runner.py
git commit -m "feat(pipeline): add brainstorm runner"
```

---

### Task 4: Implementeer plan_writer_runner.py

**Files:**
- Create: `apps/backend/runners/plan_writer_runner.py`

De plan writer ontvangt de feature-samenvatting, analyseert de codebase en schrijft `functional_plan.md` + `implementation_plan.json`.

- [ ] **Stap 1: Schrijf plan_writer_runner.py**

Maak `apps/backend/runners/plan_writer_runner.py`:

```python
#!/usr/bin/env python3
"""
Plan writer runner — analyzes codebase and writes functional_plan.md + implementation_plan.json.

Input  (stdin JSON):  {"spec_summary": str, "spec_dir": str, "project_dir": str}
Output (stdout JSON): {"status": "writing"|"complete"|"error", "message": str}
         Emits multiple lines during execution.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.client import create_client
from core.error_utils import safe_receive_messages


def load_plan_writer_prompt() -> str:
    prompt_file = Path(__file__).parent.parent / "prompts" / "plan_writer.md"
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    return ""


def emit(status: str, message: str) -> None:
    print(json.dumps({"status": status, "message": message}, ensure_ascii=False), flush=True)


async def run(spec_summary: str, spec_dir: str, project_dir: str) -> None:
    emit("writing", "Codebase wordt geanalyseerd...")

    spec_path = Path(spec_dir)
    project_path = Path(project_dir)

    system_prompt = load_plan_writer_prompt()
    prompt = f"""{system_prompt}

## Feature Summary
{spec_summary}

## Spec Directory
{spec_dir}

## Project Directory
{project_dir}

Explore the codebase, then write functional_plan.md and implementation_plan.json as described above.
"""

    client = create_client(
        project_dir=project_path,
        spec_dir=spec_path,
        model=None,
        agent_type="planner",
        fast_mode=False,
    )

    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="plan_writer"):
            pass  # Agent writes files directly via tools

    # Verify outputs were created
    functional_plan = spec_path / "functional_plan.md"
    impl_plan = spec_path / "implementation_plan.json"

    if not functional_plan.exists():
        emit("error", "functional_plan.md niet aangemaakt door agent")
        return
    if not impl_plan.exists():
        emit("error", "implementation_plan.json niet aangemaakt door agent")
        return

    emit("complete", "Plan klaar")


if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    asyncio.run(run(
        spec_summary=data.get("spec_summary", ""),
        spec_dir=data.get("spec_dir", "."),
        project_dir=data.get("project_dir", "."),
    ))
```

- [ ] **Stap 2: Commit**

```bash
git add apps/backend/runners/plan_writer_runner.py
git commit -m "feat(pipeline): add plan writer runner"
```

---

### Task 5: Maak executor_runner.py (thin wrapper)

**Files:**
- Create: `apps/backend/runners/executor_runner.py`
- Modify: `apps/backend/runners/executor_runner.py`

De executor is een thin wrapper die de bestaande verbeterde coder-logica aanroept.

- [ ] **Stap 1: Schrijf executor_runner.py**

Maak `apps/backend/runners/executor_runner.py`:

```python
#!/usr/bin/env python3
"""
Executor runner — runs all pending subtasks in a single agent session.

Delegates to the existing autonomous agent (agents/coder.py) which was already
refactored to run all subtasks in one session.

Input: CLI args --spec <spec_dir> --project <project_dir>
Output: Phase events via stdout (same as existing coder)
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.coder import run_autonomous_agent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True, help="Spec directory path")
    parser.add_argument("--project", required=True, help="Project directory path")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()

    asyncio.run(run_autonomous_agent(
        spec_dir=Path(args.spec),
        project_dir=Path(args.project),
        model=args.model,
    ))


if __name__ == "__main__":
    main()
```

- [ ] **Stap 2: Verify bestaande coder accepteert spec_dir + project_dir**

```bash
cd apps/backend
grep -n "def run_autonomous_agent" agents/coder.py
```

Verwacht: signature `run_autonomous_agent(spec_dir, project_dir, ...)`.

- [ ] **Stap 3: Commit**

```bash
git add apps/backend/runners/executor_runner.py
git commit -m "feat(pipeline): add executor runner"
```

---

### Task 6: Implementeer finisher_runner.py

**Files:**
- Create: `apps/backend/runners/finisher_runner.py`

- [ ] **Stap 1: Schrijf finisher_runner.py**

Maak `apps/backend/runners/finisher_runner.py`:

```python
#!/usr/bin/env python3
"""
Finisher runner — runs tests, creates PR, or merges based on user choice.

Input (stdin JSON): {
    "action": "test" | "pr" | "merge",
    "spec_dir": str,
    "project_dir": str,
    "pr_title": str | null
}
Output (stdout JSON lines): {"status": str, "message": str, "data": dict | null}
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def emit(status: str, message: str, data: dict | None = None) -> None:
    print(json.dumps({"status": status, "message": message, "data": data or {}}, ensure_ascii=False), flush=True)


def run_tests(project_dir: str) -> bool:
    """Run project tests and return success."""
    project_path = Path(project_dir)

    # Try npm test first (frontend)
    if (project_path / "package.json").exists():
        result = subprocess.run(
            ["npm", "test", "--", "--run"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
        emit("test_output", result.stdout + result.stderr)
        return result.returncode == 0

    # Try pytest (backend)
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"],
        cwd=project_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    emit("test_output", result.stdout + result.stderr)
    return result.returncode == 0


def create_pr(spec_dir: str, project_dir: str, pr_title: str | None) -> dict:
    """Create a GitHub PR from the current branch."""
    spec_path = Path(spec_dir)
    title = pr_title or spec_path.name

    # Get current branch
    branch_result = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    branch = branch_result.stdout.strip()

    # Push branch
    subprocess.run(["git", "push", "-u", "origin", branch], cwd=project_dir, check=True)

    # Create PR
    result = subprocess.run(
        ["gh", "pr", "create", "--title", title, "--fill"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    pr_url = result.stdout.strip()
    return {"pr_url": pr_url, "branch": branch}


def merge_branch(project_dir: str) -> bool:
    """Merge current worktree branch to main."""
    result = subprocess.run(
        ["git", "checkout", "main"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False
    result = subprocess.run(
        ["git", "merge", "--no-ff", "-"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main() -> None:
    data = json.loads(sys.stdin.read())
    action = data.get("action", "pr")
    spec_dir = data.get("spec_dir", ".")
    project_dir = data.get("project_dir", ".")
    pr_title = data.get("pr_title")

    if action == "test":
        emit("running", "Tests worden uitgevoerd...")
        success = run_tests(project_dir)
        if success:
            emit("complete", "Alle tests geslaagd", {"success": True})
        else:
            emit("error", "Tests gefaald", {"success": False})

    elif action == "pr":
        emit("running", "Pull Request wordt aangemaakt...")
        try:
            result = create_pr(spec_dir, project_dir, pr_title)
            emit("complete", f"PR aangemaakt: {result['pr_url']}", result)
        except Exception as e:
            emit("error", f"PR aanmaken mislukt: {e}")

    elif action == "merge":
        emit("running", "Branch wordt gemerged naar main...")
        success = merge_branch(project_dir)
        if success:
            emit("complete", "Gemerged naar main")
        else:
            emit("error", "Merge mislukt — los conflicten handmatig op")

    else:
        emit("error", f"Onbekende actie: {action}")


if __name__ == "__main__":
    main()
```

- [ ] **Stap 2: Commit**

```bash
git add apps/backend/runners/finisher_runner.py
git commit -m "feat(pipeline): add finisher runner"
```

---

### Task 7: Voeg nieuwe IPC-kanalen toe

**Files:**
- Modify: `apps/frontend/src/shared/constants/ipc.ts`

- [ ] **Stap 1: Lees het einde van ipc.ts om het patroon te begrijpen**

```bash
tail -50 apps/frontend/src/shared/constants/ipc.ts
```

- [ ] **Stap 2: Voeg pipeline kanalen toe aan ipc.ts**

Zoek het laatste export-object in `apps/frontend/src/shared/constants/ipc.ts` en voeg toe:

```typescript
// Pipeline (Superpowers flow)
PIPELINE_BRAINSTORM_MESSAGE: 'pipeline:brainstorm:message',
PIPELINE_BRAINSTORM_RESET: 'pipeline:brainstorm:reset',
PIPELINE_WRITE_PLAN: 'pipeline:plan:write',
PIPELINE_PLAN_PROGRESS: 'pipeline:plan:progress',
PIPELINE_GET_FUNCTIONAL_PLAN: 'pipeline:plan:get-functional',
PIPELINE_START_EXECUTION: 'pipeline:execution:start',
PIPELINE_STOP_EXECUTION: 'pipeline:execution:stop',
PIPELINE_FINISH: 'pipeline:finish',
PIPELINE_FINISH_PROGRESS: 'pipeline:finish:progress',
```

- [ ] **Stap 3: Voeg type toe voor pipeline phases**

In `apps/frontend/src/shared/types/task.ts`, update `TaskStatus`:

```typescript
// Voeg toe aan de bestaande TaskStatus union (controleer hoe het nu is gedefineerd):
export type PipelinePhase =
  | 'brainstorm'
  | 'plan_writing'
  | 'plan_review'
  | 'executing'
  | 'finishing'
  | 'done';
```

- [ ] **Stap 4: Commit**

```bash
git add apps/frontend/src/shared/constants/ipc.ts apps/frontend/src/shared/types/task.ts
git commit -m "feat(pipeline): add pipeline IPC channels and phase types"
```

---

### Task 8: Implementeer brainstorm IPC handler

**Files:**
- Create: `apps/frontend/src/main/ipc-handlers/pipeline-handlers.ts`
- Modify: `apps/frontend/src/main/ipc-handlers/index.ts`

- [ ] **Stap 1: Lees chat-handlers.ts als referentie**

```bash
cat apps/frontend/src/main/ipc-handlers/task/chat-handlers.ts
```

- [ ] **Stap 2: Schrijf pipeline-handlers.ts**

Maak `apps/frontend/src/main/ipc-handlers/pipeline-handlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import { getPythonCommand, getPythonArgs, getSourcePath } from '../utils/python-utils';
import { getSpawnEnv } from '../utils/env-utils';

function safeSend(getWindow: () => BrowserWindow | null, channel: string, ...args: unknown[]) {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function registerPipelineHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // ── Brainstorm ──────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_BRAINSTORM_MESSAGE,
    async (_, messages: Array<{ role: string; content: string }>, projectDir: string) => {
      const sourcePath = getSourcePath();
      const pythonCmd = getPythonCommand();
      const pythonArgs = getPythonArgs();
      const runnerPath = path.join(sourcePath, 'runners', 'brainstorm_runner.py');

      return new Promise<{ response: string; ready_to_plan: boolean; spec_summary: string | null }>(
        (resolve, reject) => {
          const child = spawn(pythonCmd, [...pythonArgs, runnerPath], {
            cwd: sourcePath,
            env: getSpawnEnv(),
          });

          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
          child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

          child.stdin?.write(JSON.stringify({ messages, project_dir: projectDir }));
          child.stdin?.end();

          const timeout = setTimeout(() => {
            child.kill();
            reject(new Error('Brainstorm runner timeout'));
          }, 60_000);

          child.on('close', (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
              reject(new Error(stderr || `Exit code ${code}`));
              return;
            }
            try {
              resolve(JSON.parse(stdout.trim()));
            } catch {
              reject(new Error(`Invalid JSON from brainstorm runner: ${stdout}`));
            }
          });
        },
      );
    },
  );

  // ── Plan writer ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_WRITE_PLAN,
    async (_, specSummary: string, specDir: string, projectDir: string) => {
      const sourcePath = getSourcePath();
      const pythonCmd = getPythonCommand();
      const pythonArgs = getPythonArgs();
      const runnerPath = path.join(sourcePath, 'runners', 'plan_writer_runner.py');

      const child = spawn(pythonCmd, [...pythonArgs, runnerPath], {
        cwd: sourcePath,
        env: getSpawnEnv(),
      });

      child.stdin?.write(JSON.stringify({ spec_summary: specSummary, spec_dir: specDir, project_dir: projectDir }));
      child.stdin?.end();

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            safeSend(getMainWindow, IPC_CHANNELS.PIPELINE_PLAN_PROGRESS, event);
          } catch { /* skip non-JSON */ }
        }
      });

      return new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Plan writer exited with code ${code}`));
        });
      });
    },
  );

  // ── Get functional plan ─────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.PIPELINE_GET_FUNCTIONAL_PLAN, async (_, specDir: string) => {
    const fs = await import('fs');
    const planPath = path.join(specDir, 'functional_plan.md');
    if (!fs.existsSync(planPath)) return null;
    return fs.readFileSync(planPath, 'utf-8');
  });

  // ── Finishing ───────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_FINISH,
    async (_, action: 'test' | 'pr' | 'merge', specDir: string, projectDir: string, prTitle?: string) => {
      const sourcePath = getSourcePath();
      const pythonCmd = getPythonCommand();
      const pythonArgs = getPythonArgs();
      const runnerPath = path.join(sourcePath, 'runners', 'finisher_runner.py');

      const child = spawn(pythonCmd, [...pythonArgs, runnerPath], {
        cwd: sourcePath,
        env: getSpawnEnv(),
      });

      child.stdin?.write(JSON.stringify({ action, spec_dir: specDir, project_dir: projectDir, pr_title: prTitle }));
      child.stdin?.end();

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            safeSend(getMainWindow, IPC_CHANNELS.PIPELINE_FINISH_PROGRESS, event);
          } catch { /* skip */ }
        }
      });

      return new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Finisher exited with code ${code}`));
        });
      });
    },
  );
}
```

- [ ] **Stap 3: Registreer in index.ts**

Open `apps/frontend/src/main/ipc-handlers/index.ts` en voeg toe:

```typescript
import { registerPipelineHandlers } from './pipeline-handlers';

// In setupIpcHandlers():
registerPipelineHandlers(getMainWindow);
```

- [ ] **Stap 4: Typecheck**

```bash
cd apps/frontend
npm run typecheck 2>&1 | head -50
```

Los eventuele fouten op. Verwacht: 0 errors gerelateerd aan pipeline-handlers.

- [ ] **Stap 5: Commit**

```bash
git add apps/frontend/src/main/ipc-handlers/pipeline-handlers.ts apps/frontend/src/main/ipc-handlers/index.ts
git commit -m "feat(pipeline): add pipeline IPC handlers (brainstorm, plan, finish)"
```

---

### Task 9: Voeg pipeline helper utilities toe aan preload

**Files:**
- Modify: `apps/frontend/src/preload/index.ts` (of equivalent preload bestand)

- [ ] **Stap 1: Lees het preload bestand**

```bash
cat apps/frontend/src/preload/index.ts | head -100
```

Begrijp het patroon voor het blootstellen van IPC kanalen aan de renderer.

- [ ] **Stap 2: Voeg pipeline API toe aan electronAPI**

Voeg toe in het preload script, volgend het bestaande patroon:

```typescript
pipeline: {
  sendBrainstormMessage: (messages: Array<{role: string; content: string}>, projectDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_BRAINSTORM_MESSAGE, messages, projectDir),
  writePlan: (specSummary: string, specDir: string, projectDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_WRITE_PLAN, specSummary, specDir, projectDir),
  getFunctionalPlan: (specDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_GET_FUNCTIONAL_PLAN, specDir),
  finish: (action: 'test' | 'pr' | 'merge', specDir: string, projectDir: string, prTitle?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_FINISH, action, specDir, projectDir, prTitle),
  onPlanProgress: (callback: (event: {status: string; message: string}) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_PLAN_PROGRESS, (_, event) => callback(event));
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PIPELINE_PLAN_PROGRESS);
  },
  onFinishProgress: (callback: (event: {status: string; message: string; data: Record<string, unknown>}) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_FINISH_PROGRESS, (_, event) => callback(event));
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PIPELINE_FINISH_PROGRESS);
  },
},
```

- [ ] **Stap 3: Voeg type toe in preload types**

In het preload types bestand (bijv. `apps/frontend/src/preload/types.ts` of inline):

```typescript
pipeline: {
  sendBrainstormMessage: (messages: Array<{role: string; content: string}>, projectDir: string) => Promise<{response: string; ready_to_plan: boolean; spec_summary: string | null}>;
  writePlan: (specSummary: string, specDir: string, projectDir: string) => Promise<void>;
  getFunctionalPlan: (specDir: string) => Promise<string | null>;
  finish: (action: 'test' | 'pr' | 'merge', specDir: string, projectDir: string, prTitle?: string) => Promise<void>;
  onPlanProgress: (cb: (event: {status: string; message: string}) => void) => () => void;
  onFinishProgress: (cb: (event: {status: string; message: string; data: Record<string, unknown>}) => void) => () => void;
};
```

- [ ] **Stap 4: Typecheck**

```bash
cd apps/frontend && npm run typecheck 2>&1 | head -30
```

- [ ] **Stap 5: Commit**

```bash
git add apps/frontend/src/preload/
git commit -m "feat(pipeline): expose pipeline API via preload"
```

---

### Task 10: Eindverificatie backend

- [ ] **Stap 1: Controleer dat oude code weg is**

```bash
ls apps/backend/spec/ 2>&1  # Moet fout geven
ls apps/backend/qa/ 2>&1    # Moet fout geven
ls apps/backend/runners/spec_runner.py 2>&1  # Moet fout geven
```

- [ ] **Stap 2: Controleer dat nieuwe runners bestaan**

```bash
ls apps/backend/runners/brainstorm_runner.py
ls apps/backend/runners/plan_writer_runner.py
ls apps/backend/runners/executor_runner.py
ls apps/backend/runners/finisher_runner.py
```

Alle vier moeten bestaan.

- [ ] **Stap 3: Python syntax check**

```bash
cd apps/backend
for f in runners/brainstorm_runner.py runners/plan_writer_runner.py runners/executor_runner.py runners/finisher_runner.py; do
  .venv/Scripts/python.exe -c "import ast; ast.parse(open('$f', encoding='utf-8').read()); print('$f OK')"
done
```

Verwacht: alle vier `OK`.

- [ ] **Stap 4: TypeScript typecheck**

```bash
cd apps/frontend && npm run typecheck 2>&1 | grep -E "error|Error" | head -20
```

Verwacht: 0 nieuwe errors.

- [ ] **Stap 5: Final commit**

```bash
git add -A
git commit -m "feat(pipeline): backend pipeline complete — ready for frontend"
```
