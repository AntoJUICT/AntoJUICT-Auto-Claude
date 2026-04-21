# Interactive Task Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-phase task creation flow where the AI asks up to 3 targeted questions before generating a pre-filled task description.

**Architecture:** `TaskCreationWizard` gains a `phase` state (`'chat' | 'form'`). In `'chat'` phase a new `TaskChatPhase` component renders; when the AI decides it has enough information it returns `done: true` and the wizard transitions to `'form'` phase with the generated description pre-filled. AI calls go through a new Python runner (`task_chat_runner.py`) spawned as a subprocess per message, following the same pattern as `TitleGenerator`.

**Tech Stack:** React 19, TypeScript strict, Electron IPC, Python 3 + Claude Agent SDK (claude-haiku-4-5), react-i18next

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/backend/runners/task_chat_runner.py` | Python script — accepts conversation JSON on stdin, returns `{done, question}` or `{done, description}` on stdout |
| Modify | `apps/frontend/src/shared/constants/ipc.ts` | Add `TASK_CHAT_MESSAGE` channel |
| Create | `apps/frontend/src/main/ipc-handlers/task/chat-handlers.ts` | IPC handler — spawns runner, pipes stdin/stdout |
| Modify | `apps/frontend/src/main/ipc-handlers/task/index.ts` | Register new chat handler |
| Modify | `apps/frontend/src/preload/api/task-api.ts` | Add `taskChatMessage` to `TaskAPI` interface + implementation |
| Create | `apps/frontend/src/renderer/components/TaskChatPhase.tsx` | Chat UI — message list, input, step indicator, skip link, AI-done confirmation |
| Modify | `apps/frontend/src/renderer/components/TaskCreationWizard.tsx` | Add `phase` state; render `TaskChatPhase` in chat phase; show chat banner in form phase; skip chat when draft is restored |
| Modify | `apps/frontend/src/shared/i18n/locales/en/tasks.json` | Add i18n keys for chat phase UI |

---

## Task 1: IPC channel constant + i18n keys

**Files:**
- Modify: `apps/frontend/src/shared/constants/ipc.ts:25`
- Modify: `apps/frontend/src/shared/i18n/locales/en/tasks.json`

- [ ] **Step 1: Add TASK_CHAT_MESSAGE to IPC_CHANNELS**

In `apps/frontend/src/shared/constants/ipc.ts`, add after `TASK_CREATE: 'task:create',`:

```typescript
  TASK_CHAT_MESSAGE: 'task:chatMessage',
```

- [ ] **Step 2: Add i18n keys for chat phase**

In `apps/frontend/src/shared/i18n/locales/en/tasks.json`, add a `chat` section inside the top-level object (e.g. after the `"wizard"` key):

```json
"chat": {
  "opening": "What do you want to build or fix?",
  "stepIndicator": "step {{current}} of max {{max}}",
  "skip": "Skip questions and go to form →",
  "inputPlaceholder": "Type your answer...",
  "send": "Send",
  "aiReady": "I have enough to write a good task description.",
  "aiReadyQuestion": "Anything else to add, or shall I continue?",
  "addMore": "Add more",
  "generate": "Yes, generate →",
  "generating": "Generating description...",
  "summaryBanner": "Summarised from conversation",
  "viewConversation": "View conversation ↓",
  "error": "Something went wrong. Try again or skip.",
  "retry": "Retry"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/shared/constants/ipc.ts apps/frontend/src/shared/i18n/locales/en/tasks.json
git commit -m "feat(chat): add TASK_CHAT_MESSAGE IPC channel and i18n keys"
```

---

## Task 2: Python chat runner

**Files:**
- Create: `apps/backend/runners/task_chat_runner.py`

- [ ] **Step 1: Write the runner**

Create `apps/backend/runners/task_chat_runner.py`:

```python
"""
Task Chat Runner — reads conversation JSON from stdin, returns a single JSON line to stdout.

Input (stdin):
  {"messages": [{"role": "user"|"assistant", "content": "..."}]}

Output (stdout) — one of:
  {"done": false, "question": "..."}
  {"done": true, "description": "..."}
"""

import asyncio
import json
import sys


SYSTEM_PROMPT = """You are a task clarification assistant embedded in a task management app.
Your job is to ask targeted follow-up questions to help a developer write a detailed task description.

Rules:
1. Ask at most 3 questions in total (counting the opening question). After that you MUST generate the description.
2. After each user response, decide if you already have enough information to write a good description.
   If yes, return {"done": true, "description": "..."} immediately without asking another question.
3. Ask ONE question at a time. Keep questions short and specific.
4. When you have enough information, generate a description in this exact format:

**Wat:** [short description of what needs to change]

**Nu:** [current behavior]

**Verwacht:** [desired behavior]

**Acceptatiecriteria:**
- [criterion 1]
- [criterion 2]

5. Always respond in valid JSON only — no markdown, no preamble, just the JSON object.
6. The language of questions and description should match the user's language.

Response format — one of:
{"done": false, "question": "your question here"}
{"done": true, "description": "the full formatted description here"}
"""


async def run_chat(messages: list) -> None:
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

    # Build the prompt from conversation history
    conversation_text = ""
    for msg in messages:
        role = "User" if msg["role"] == "user" else "Assistant"
        conversation_text += f"{role}: {msg['content']}\n\n"

    prompt = (
        conversation_text.strip()
        + "\n\nAssistant (respond in JSON only):"
    )

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-haiku-4-5",
            system_prompt=SYSTEM_PROMPT,
            max_turns=1,
        )
    )

    async with client:
        await client.query(prompt)

        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text

    if not response_text.strip():
        print(json.dumps({"done": False, "question": "Can you describe what you want to change?"}))
        return

    # Strip markdown code fences if the model wrapped the JSON
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        parsed = json.loads(cleaned)
        print(json.dumps(parsed))
    except json.JSONDecodeError:
        # Model didn't return JSON — treat as a question
        print(json.dumps({"done": False, "question": cleaned[:300]}))


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        messages = payload.get("messages", [])
        asyncio.run(run_chat(messages))
    except Exception as e:
        print(json.dumps({"done": False, "question": f"Error: {e}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke-test the runner locally**

From the backend venv:

```bash
cd apps/backend
echo '{"messages":[{"role":"user","content":"fix the create button"}]}' | .venv/bin/python runners/task_chat_runner.py
```

Expected: a JSON line like `{"done": false, "question": "What is the current behavior..."}` on stdout, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/runners/task_chat_runner.py
git commit -m "feat(chat): add task_chat_runner Python script"
```

---

## Task 3: IPC handler (main process)

**Files:**
- Create: `apps/frontend/src/main/ipc-handlers/task/chat-handlers.ts`
- Modify: `apps/frontend/src/main/ipc-handlers/task/index.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/tests/chat-handler.test.ts` (if a test runner is configured for main-process code, otherwise skip and note it):

```typescript
// Minimal smoke: handler is registered without throwing
import { describe, it, expect, vi } from 'vitest';

// Mock electron ipcMain
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}));

describe('registerTaskChatHandlers', () => {
  it('registers without throwing', async () => {
    const { registerTaskChatHandlers } = await import(
      '../src/main/ipc-handlers/task/chat-handlers'
    );
    expect(() => registerTaskChatHandlers()).not.toThrow();
  });
});
```

Run: `cd apps/frontend && npm test -- chat-handler`
Expected: FAIL (module not found yet).

- [ ] **Step 2: Create the chat handler**

Create `apps/frontend/src/main/ipc-handlers/task/chat-handlers.ts`:

```typescript
import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import { pythonEnvManager, getConfiguredPythonPath } from '../../python-env-manager';
import { parsePythonCommand } from '../../python-detector';
import { getBestAvailableProfileEnv } from '../../rate-limit-detector';
import { getAPIProfileEnv } from '../../services/profile';
import { getOAuthModeClearVars } from '../../agent/env-utils';
import { getEffectiveSourcePath } from '../../updater/path-resolver';
import { getSentryEnvForSubprocess } from '../../sentry';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  done: boolean;
  question?: string;
  description?: string;
}

export function registerTaskChatHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.TASK_CHAT_MESSAGE,
    async (
      _,
      messages: ChatMessage[]
    ): Promise<IPCResult<ChatResponse>> => {
      const sourcePath = getEffectiveSourcePath();
      const runnerPath = path.join(sourcePath, 'runners', 'task_chat_runner.py');
      const pythonPath = getConfiguredPythonPath();
      const [pythonCmd, pythonArgs] = parsePythonCommand(pythonPath);

      if (!pythonEnvManager.isEnvReady()) {
        return {
          success: false,
          error: 'Python environment not ready'
        };
      }

      const apiProfileEnv = await getAPIProfileEnv();
      const isApiProfileActive = Object.keys(apiProfileEnv).length > 0;
      let profileEnv: Record<string, string> = {};
      if (!isApiProfileActive) {
        const result = getBestAvailableProfileEnv();
        profileEnv = result.env;
      }
      const oauthModeClearVars = getOAuthModeClearVars(apiProfileEnv);

      return new Promise((resolve) => {
        const child = spawn(
          pythonCmd,
          [...pythonArgs, runnerPath],
          {
            cwd: sourcePath,
            env: {
              ...pythonEnvManager.getPythonEnv(),
              ...getSentryEnvForSubprocess(),
              ...profileEnv,
              ...apiProfileEnv,
              ...oauthModeClearVars,
              PYTHONUNBUFFERED: '1',
            },
          }
        );

        let stdout = '';
        let stderr = '';

        const timeout = setTimeout(() => {
          child.kill();
          resolve({ success: false, error: 'Chat request timed out' });
        }, 30000);

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf-8');
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
        });

        child.on('exit', (code) => {
          clearTimeout(timeout);
          if (code === 0 && stdout.trim()) {
            try {
              const parsed: ChatResponse = JSON.parse(stdout.trim());
              resolve({ success: true, data: parsed });
            } catch {
              resolve({ success: false, error: 'Invalid JSON from chat runner' });
            }
          } else {
            console.warn('[TASK_CHAT] Runner failed:', { code, stderr: stderr.substring(0, 300) });
            resolve({ success: false, error: stderr.substring(0, 200) || 'Chat runner error' });
          }
        });

        child.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        });

        // Write conversation to stdin
        child.stdin?.write(JSON.stringify({ messages }));
        child.stdin?.end();
      });
    }
  );
}
```

- [ ] **Step 3: Register the handler in index.ts**

In `apps/frontend/src/main/ipc-handlers/task/index.ts`:

Add import after the existing imports:
```typescript
import { registerTaskChatHandlers } from './chat-handlers';
```

Add call inside `registerTaskHandlers()` after the existing registrations:
```typescript
  // Register chat handlers (task creation chat phase)
  registerTaskChatHandlers();
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/frontend && npm test -- chat-handler
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/main/ipc-handlers/task/chat-handlers.ts apps/frontend/src/main/ipc-handlers/task/index.ts
git commit -m "feat(chat): add TASK_CHAT_MESSAGE IPC handler"
```

---

## Task 4: Preload API

**Files:**
- Modify: `apps/frontend/src/preload/api/task-api.ts`

- [ ] **Step 1: Add interface + implementation**

In `apps/frontend/src/preload/api/task-api.ts`, add to the `TaskAPI` interface (after `checkWorktreeChanges`):

```typescript
  taskChatMessage: (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => Promise<IPCResult<{ done: boolean; question?: string; description?: string }>>;
```

Then add the implementation in `createTaskAPI()` (wherever the other methods are implemented):

```typescript
    taskChatMessage: (messages) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_CHAT_MESSAGE, messages),
```

- [ ] **Step 2: Type-check**

```bash
cd apps/frontend && npm run typecheck 2>&1 | grep -i "task-api\|chatMessage"
```

Expected: no errors related to the new method.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/preload/api/task-api.ts
git commit -m "feat(chat): expose taskChatMessage in preload API"
```

---

## Task 5: TaskChatPhase component

**Files:**
- Create: `apps/frontend/src/renderer/components/TaskChatPhase.tsx`

- [ ] **Step 1: Write a unit test**

Create `apps/frontend/src/renderer/components/__tests__/TaskChatPhase.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskChatPhase } from '../TaskChatPhase';

// Stub i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string,unknown>) => opts ? `${k}:${JSON.stringify(opts)}` : k }),
}));

const noop = () => {};

describe('TaskChatPhase', () => {
  it('renders opening question', () => {
    render(
      <TaskChatPhase
        messages={[{ role: 'assistant', content: 'What do you want to build?' }]}
        onSend={noop}
        onSkip={noop}
        onConfirmGenerate={noop}
        onAddMore={noop}
        isLoading={false}
        isAiReady={false}
        step={1}
        maxSteps={3}
      />
    );
    expect(screen.getByText('What do you want to build?')).toBeTruthy();
  });

  it('shows AI-ready confirmation when isAiReady=true', () => {
    render(
      <TaskChatPhase
        messages={[{ role: 'assistant', content: 'What do you want to build?' }]}
        onSend={noop}
        onSkip={noop}
        onConfirmGenerate={vi.fn()}
        onAddMore={noop}
        isLoading={false}
        isAiReady={true}
        step={2}
        maxSteps={3}
      />
    );
    expect(screen.getByText('tasks:chat.aiReady')).toBeTruthy();
  });

  it('calls onSkip when skip link is clicked', () => {
    const onSkip = vi.fn();
    render(
      <TaskChatPhase
        messages={[]}
        onSend={noop}
        onSkip={onSkip}
        onConfirmGenerate={noop}
        onAddMore={noop}
        isLoading={false}
        isAiReady={false}
        step={1}
        maxSteps={3}
      />
    );
    fireEvent.click(screen.getByText('tasks:chat.skip'));
    expect(onSkip).toHaveBeenCalled();
  });
});
```

Run: `cd apps/frontend && npm test -- TaskChatPhase`
Expected: FAIL (component not found yet).

- [ ] **Step 2: Create the component**

Create `apps/frontend/src/renderer/components/TaskChatPhase.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TaskChatPhaseProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onSkip: () => void;
  onConfirmGenerate: () => void;
  onAddMore: () => void;
  isLoading: boolean;
  isAiReady: boolean;
  step: number;
  maxSteps: number;
}

export function TaskChatPhase({
  messages,
  onSend,
  onSkip,
  onConfirmGenerate,
  onAddMore,
  isLoading,
  isAiReady,
  step,
  maxSteps,
}: TaskChatPhaseProps) {
  const { t } = useTranslation('tasks');
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiReady]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {msg.role === 'assistant' && (
                <span className="mr-2 text-xs opacity-60">🤖</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('chat.generating')}
            </div>
          </div>
        )}

        {/* AI-ready confirmation */}
        {isAiReady && !isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3 space-y-3 max-w-[85%]">
              <p className="text-sm font-medium">{t('chat.aiReady')}</p>
              <p className="text-sm text-muted-foreground">{t('chat.aiReadyQuestion')}</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={onAddMore}>
                  {t('chat.addMore')}
                </Button>
                <Button size="sm" onClick={onConfirmGenerate}>
                  {t('chat.generate')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area — hidden when AI is ready */}
      {!isAiReady && (
        <div className="mt-3 flex gap-2">
          <textarea
            className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('chat.inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <Button
            size="sm"
            className="h-10 px-3"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">{t('chat.send')}</span>
          </Button>
        </div>
      )}

      {/* Step indicator + skip */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('chat.stepIndicator', { current: step, max: maxSteps })}
        </span>
        <button
          type="button"
          className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          onClick={onSkip}
        >
          {t('chat.skip')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/frontend && npm test -- TaskChatPhase
```

Expected: all 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/renderer/components/TaskChatPhase.tsx apps/frontend/src/renderer/components/__tests__/TaskChatPhase.test.tsx
git commit -m "feat(chat): add TaskChatPhase component"
```

---

## Task 6: Modify TaskCreationWizard

**Files:**
- Modify: `apps/frontend/src/renderer/components/TaskCreationWizard.tsx`

This is the integration task. The wizard gets a `phase` state that controls which UI to show, and the chat logic that coordinates with the IPC handler.

- [ ] **Step 1: Add phase state and chat state to TaskCreationWizard**

In `apps/frontend/src/renderer/components/TaskCreationWizard.tsx`, add these imports at the top alongside existing imports:

```tsx
import { TaskChatPhase, type ChatMessage } from './TaskChatPhase';
```

Add the following state variables after the existing state declarations (after line ~129):

```tsx
  // Chat phase state
  const [phase, setPhase] = useState<'chat' | 'form'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStep, setChatStep] = useState(1);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isAiReady, setIsAiReady] = useState(false);
  const [chatFromConversation, setChatFromConversation] = useState(false);
```

- [ ] **Step 2: Start chat when dialog opens (and skip when draft exists)**

Inside the existing `useEffect` that runs on `open`/`projectId`, after the draft restore block, add phase initialization. Replace the end of that `useEffect` (the closing braces after setting `setIsDraftRestored(false)`) to add:

At the end of the `if (draft && !isDraftEmpty(draft))` branch, add:
```tsx
        setPhase('form'); // Existing draft — skip chat
        setChatFromConversation(false);
```

At the end of the `else` branch (no draft), add:
```tsx
        // Start fresh with chat phase
        setPhase('chat');
        setChatMessages([]);
        setChatStep(1);
        setIsAiReady(false);
        setIsChatLoading(false);
        setChatFromConversation(false);
```

Then also add phase reset inside `resetForm()`:
```tsx
    setPhase('chat');
    setChatMessages([]);
    setChatStep(1);
    setIsAiReady(false);
    setIsChatLoading(false);
    setChatFromConversation(false);
```

- [ ] **Step 3: Add chat opening message + send handler**

Add a `useEffect` that sends the opening question when phase becomes `'chat'` with empty messages:

```tsx
  useEffect(() => {
    if (phase !== 'chat' || chatMessages.length > 0 || !open) return;
    // Show opening question immediately (no API call needed)
    setChatMessages([{ role: 'assistant', content: t('tasks:chat.opening') }]);
  }, [phase, chatMessages.length, open, t]);
```

Add the send handler:

```tsx
  const handleChatSend = async (userText: string) => {
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: userText },
    ];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      const result = await window.electronAPI.taskChatMessage(newMessages);
      if (!result.success || !result.data) {
        // On error, stay in chat but show an error assistant message
        setChatMessages([
          ...newMessages,
          { role: 'assistant', content: t('tasks:chat.error') },
        ]);
        return;
      }

      const { done, question, description } = result.data;

      if (done && description) {
        setDescription(description);
        setChatFromConversation(true);
        setIsAiReady(true);
        // Don't transition yet — let user confirm
      } else if (question) {
        setChatMessages([
          ...newMessages,
          { role: 'assistant', content: question },
        ]);
        setChatStep((s) => Math.min(s + 1, 3));
      }
    } finally {
      setIsChatLoading(false);
    }
  };
```

Add the skip and confirm handlers:

```tsx
  const handleChatSkip = () => {
    setPhase('form');
    setChatFromConversation(false);
  };

  const handleConfirmGenerate = () => {
    setPhase('form');
  };

  const handleAddMore = () => {
    setIsAiReady(false);
    // Description already pre-filled; user can keep chatting
    // Add a blank assistant prompt to invite more input
    setChatMessages((msgs) => [
      ...msgs,
      { role: 'assistant', content: t('tasks:chat.inputPlaceholder') },
    ]);
  };
```

- [ ] **Step 4: Render TaskChatPhase in chat phase**

In the JSX return, inside `<TaskModalLayout>`, wrap the existing `<div className="space-y-6">` with a phase check:

Replace:
```tsx
      <div className="space-y-6">
        {/* Worktree isolation info banner */}
        ...
      </div>
```

With:
```tsx
      {phase === 'chat' ? (
        <TaskChatPhase
          messages={chatMessages}
          onSend={handleChatSend}
          onSkip={handleChatSkip}
          onConfirmGenerate={handleConfirmGenerate}
          onAddMore={handleAddMore}
          isLoading={isChatLoading}
          isAiReady={isAiReady}
          step={chatStep}
          maxSteps={3}
        />
      ) : (
        <div className="space-y-6">
          {/* Chat summary banner — only when description came from a chat */}
          {chatFromConversation && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-info/10 border border-info/30 rounded-lg text-sm">
              <span className="flex items-center gap-2 text-info font-medium">
                💬 {t('tasks:chat.summaryBanner')}
              </span>
            </div>
          )}

          {/* Keep the existing content of <div className="space-y-6"> exactly as-is:
              - Worktree isolation info banner
              - <TaskFormFields ... /> with all existing props
              - Git Options toggle + git options section
            All three blocks remain unchanged. Only the chat banner above is new. */}
        </div>
      )}
```

- [ ] **Step 5: Type-check and lint**

```bash
cd apps/frontend && npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Run all frontend unit tests**

```bash
cd apps/frontend && npm test
```

Expected: all tests pass (including new TaskChatPhase tests).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/renderer/components/TaskCreationWizard.tsx
git commit -m "feat(chat): integrate two-phase chat flow into TaskCreationWizard"
```

---

## Task 7: Manual smoke test

No automated test covers the full Electron flow. Do this manually in dev mode.

- [ ] **Step 1: Start the dev app**

```bash
npm run dev
```

- [ ] **Step 2: Open task creation dialog**

Click the `+` button in the sidebar to open the "New Task" dialog.

Expected: chat phase is shown with the opening question "What do you want to build or fix?".

- [ ] **Step 3: Test the happy path**

Type "fix the create button" → Send. Wait for AI question. Answer it. Continue until AI shows "I have enough..." → click "Yes, generate →".

Expected: wizard transitions to form phase with `description` pre-filled in the markdown format, and the "Summarised from conversation" banner is visible.

- [ ] **Step 4: Test skip**

Open dialog again. Click "Skip questions and go to form →".

Expected: form phase with empty description, no chat banner.

- [ ] **Step 5: Test draft restore**

Create a task halfway (fill some form fields), close without creating. Reopen.

Expected: form phase loads directly with draft content, no chat phase shown.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat(chat): complete interactive task chat feature"
```
