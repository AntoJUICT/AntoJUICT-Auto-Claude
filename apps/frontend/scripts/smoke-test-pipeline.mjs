/**
 * Smoke test: luistert naar TASK_STATUS_CHANGE events in de renderer.
 * De pipeline emitteert statuswijzigingen via IPC naar de renderer (niet naar de main process store).
 */
import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:9222/devtools/page/CE8F0CC2EBF1F120F99D282C2EDF1211';
const PROJECT_ID = '8076e0c7-0807-4983-b760-59ff08ea64a0'; // JUICTEmployees

let msgId = 1;
const pending = new Map();
let ws;

async function cdpCall(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInRenderer(expression) {
  const result = await cdpCall('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function main() {
  ws = new WebSocket(WS_URL);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result || {});
    }
  });

  console.log('[smoke] Verbonden met renderer');

  // Stap 1: Registreer listener voor TASK_STATUS_CHANGE events VOOR de taak start
  // We injecteren een global die events bijhoudt
  await evalInRenderer(`
    window.__smokeTestEvents = [];
    window.__smokeTaskId = null;
    window.__smokeCleanup = window.electronAPI.onTaskStatusChange((taskId, status) => {
      if (taskId === window.__smokeTaskId) {
        console.log('[SMOKE_EVENT] taskId=' + taskId + ' status=' + status);
        window.__smokeTestEvents.push({ taskId, status, ts: Date.now() });
      }
    });
    'listener_registered'
  `);
  console.log('[smoke] TASK_STATUS_CHANGE listener geregistreerd');

  // Stap 2: Maak taak aan
  const rawTask = await evalInRenderer(`
    (async () => {
      const result = await window.electronAPI.createTask(
        '${PROJECT_ID}',
        'Pipeline smoke test v3 — event listener',
        'Test dat de superpowers pipeline brainstorming status emitteert via IPC',
      );
      window.__smokeTaskId = result?.data?.id;
      return JSON.stringify(result?.data);
    })()
  `);

  const task = JSON.parse(rawTask || '{}');
  console.log('[smoke] Taak aangemaakt:', task.id, '| status:', task.status);
  if (!task.id) { console.error('[smoke] Geen task ID!'); ws.close(); process.exit(1); }

  // Stap 3: Start de taak
  console.log('[smoke] Taak starten...');
  await evalInRenderer(`window.electronAPI.startTask('${task.id}')`);
  console.log('[smoke] TASK_START verzonden. Wacht op brainstorming event (max 45s)...');

  // Stap 4: Poll de geïnjecteerde event buffer
  const deadline = Date.now() + 45000;
  let lastStatus = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    const eventsRaw = await evalInRenderer('JSON.stringify(window.__smokeTestEvents)');
    const events = JSON.parse(eventsRaw || '[]');

    if (events.length > lastStatus?.length ?? -1) {
      for (const ev of events) {
        console.log('[smoke] EVENT: status=' + ev.status);
      }
    }

    const statuses = events.map(e => e.status);
    lastStatus = events;

    if (statuses.includes('brainstorming')) {
      console.log('\n[smoke] ✅ GESLAAGD — pipeline emitteerde brainstorming status!');
      // Check verdere voortgang
      if (statuses.includes('spec_review')) console.log('[smoke] Bonus: spec_review ook al ontvangen');
      if (statuses.includes('error')) console.log('[smoke] Note: pipeline eindigde in error (auth verwacht)');
      break;
    } else if (statuses.includes('error') && !statuses.includes('brainstorming')) {
      console.log('\n[smoke] ⚠️ Pipeline startte maar ging direct naar error zonder brainstorming');
      console.log('[smoke] Statussen:', statuses.join(' → '));
      break;
    } else if (statuses.length > 0) {
      console.log('[smoke] Ontvangen statussen tot nu:', statuses.join(' → '));
    }
  }

  // Cleanup
  await evalInRenderer('if (window.__smokeCleanup) { window.__smokeCleanup(); }');
  ws.close();
  process.exit(0);
}

main().catch(err => { console.error('[smoke] FOUT:', err.message); process.exit(1); });
