# Superpowers Pipeline Redesign

**Goal:** De volledige pipeline van de app vervangen door het superpowers-process: brainstorm → plan schrijven → gebruiker keurt goed → uitvoeren → afronden. Alle oude pipeline-code wordt verwijderd.

**Architecture:** Vijf duidelijke, lineaire fases die exact het superpowers CLI-process volgen. De backend krijgt vijf nieuwe modules (brainstorm, plan_writer, executor, finisher). De frontend krijgt vijf bijbehorende views. De bestaande Claude SDK / worktree / recovery infrastructuur blijft intact.

**Tech Stack:** Python (backend pipeline), TypeScript/React (frontend views), Claude Agent SDK, Electron IPC

---

## Fase 1 — Brainstorm

**Wat het doet:** Chat-gesprek tussen gebruiker en Claude. Claude stelt één gerichte vraag tegelijk om te begrijpen wat er gebouwd moet worden. Wanneer Claude genoeg informatie heeft, sluit hij de brainstorm af en maakt hij een gestructureerde samenvatting.

**Backend:**
- Nieuw bestand: `apps/backend/pipeline/brainstorm.py`
- Werkt als multi-turn conversatie via Claude Agent SDK
- Elke gebruikersboodschap wordt doorgestuurd naar Claude, het antwoord (één vraag of afsluiting) komt terug
- Slaat brainstorm-uitkomst op als `spec.md` in de spec-directory

**Frontend:**
- Nieuw scherm: `BrainstormView` — chat-interface (zelfde patroon als bestaand Insights-scherm)
- Gebruiker typt antwoorden, Claude antwoorden verschijnen streaming
- Knop "Schrijf plan" wordt actief zodra Claude aangeeft genoeg te weten

**Verwijderd:**
- `apps/backend/spec/` — volledige map (gatherer, researcher, writer, critic, complexity assessor, orchestrator, alle fases)
- `apps/backend/runners/spec_runner.py`
- Frontend: spec-pipeline views en fase-logica

---

## Fase 2 — Plan schrijven

**Wat het doet:** Claude analyseert de codebase op basis van de brainstorm-uitkomst en schrijft twee documenten: een functioneel overzicht voor de gebruiker en een technisch plan voor de agent.

**Backend:**
- Nieuw bestand: `apps/backend/pipeline/plan_writer.py`
- Één agent-sessie met een writing-plans-stijl prompt
- Output:
  - `functional_plan.md` — kort, functionele bullets, geen technische details
  - `implementation_plan.json` — bestaand formaat (tasks met id, description, files_to_modify, status)

**Frontend:**
- Na klik op "Schrijf plan" in BrainstormView: loading state met progressmelding ("Plan wordt opgesteld...")
- Geen interactie vereist — automatische overgang naar PlanReviewView zodra klaar

---

## Fase 3 — Plan goedkeuren

**Wat het doet:** Gebruiker ziet het functionele overzicht en keurt het goed of vraagt om aanpassing.

**Backend:** Geen agent-sessie — pipeline wacht op gebruikersinput via IPC.

**Frontend:**
- Nieuw scherm: `PlanReviewView`
- Toont `functional_plan.md` als bullet-lijst (geen technische details)
- Twee knoppen: "Goedkeuren →" en "Aanpassen"
- "Aanpassen" → terug naar BrainstormView met volledige chatgeschiedenis bewaard, gebruiker kan bijsturen
- Na bijsturing: "Schrijf plan" herstart alleen de plan_writer fase (niet de hele brainstorm)
- Optioneel: gebruiker kan individuele taken bewerken via inline edit voor goedkeuring

---

## Fase 4 — Uitvoeren

**Wat het doet:** Eén agent-sessie werkt door alle taken in volgorde. Live tasklist toont voortgang. Stopt alleen bij een blocker.

**Backend:**
- `apps/backend/pipeline/executor.py` — bouwt voort op de verbeterde `coder.py` (één sessie voor alle taken)
- Prompt: writing-plans-stijl, agent markeert elke taak `completed` in `implementation_plan.json`
- Bij blocker: status `blocked` + bericht aan gebruiker via IPC

**Frontend:**
- Nieuw scherm: `ExecutionView`
- Tasklist bovenaan: ☐ Taak 1 / ☐ Taak 2 / ☐ Taak 3 ...
- Live aanvinken terwijl agent werkt (☐ → ✅)
- Terminal stream eronder (wat doet de agent precies)
- Bij blocker: inline melding met vraag aan gebruiker

**Verwijderd:**
- `apps/backend/qa/` — QA reviewer, fixer, loop (volledig verwijderd)
- Oude coder-loop met per-subtask sessies
- Frontend: Kanban fase-views, QA-views, fase-bouncing logica

---

## Fase 5 — Afronden

**Wat het doet:** Gebruiker kiest wat er na de uitvoering gebeurt.

**Backend:**
- Nieuw bestand: `apps/backend/pipeline/finisher.py`
- Opties: tests draaien, PR aanmaken, direct mergen
- Voert de gekozen actie uit en rapporteert resultaat

**Frontend:**
- Nieuw scherm: `FinishingView`
- Drie knoppen: "Tests draaien" / "PR aanmaken" / "Direct mergen"
- Resultaat wordt getoond (test output, PR-link, merge-bevestiging)

---

## Wat wordt verwijderd

### Backend
| Pad | Reden |
|---|---|
| `apps/backend/spec/` | Vervangen door brainstorm + plan_writer |
| `apps/backend/qa/` | Vervangen door finisher |
| `apps/backend/runners/spec_runner.py` | Niet meer nodig |
| `apps/backend/agents/coder.py` (grootste deel) | Vervangen door executor.py |
| Complexity assessor logica | Niet meer nodig |

### Frontend
| Component | Reden |
|---|---|
| Spec pipeline views (gatherer, researcher, etc.) | Vervangen door BrainstormView |
| QA review/fixer views | Vervangen door FinishingView |
| Kanban fase-logica (planning/coding/QA fases) | Vervangen door lineaire 5-staps flow |
| Spec review / plan review UI (huidige) | Vervangen door PlanReviewView |

---

## Wat blijft

- Claude Agent SDK client (`core/client.py`)
- Worktree infrastructuur (`core/worktree.py`)
- Recovery manager (voor executor blocker-detectie)
- Git / PR integratie (gebruikt door finisher)
- Linear integratie (optioneel, blijft werken)
- Terminal stream infrastructuur
- IPC handler patroon

---

## Nieuwe directory structuur (backend)

```
apps/backend/pipeline/
├── brainstorm.py     ← fase 1
├── plan_writer.py    ← fase 2
├── executor.py       ← fase 4 (bouwt op verbeterde coder.py)
└── finisher.py       ← fase 5
```

## Nieuwe directory structuur (frontend)

```
apps/frontend/src/renderer/components/pipeline/
├── BrainstormView.tsx    ← fase 1
├── PlanReviewView.tsx    ← fase 3
├── ExecutionView.tsx     ← fase 4
└── FinishingView.tsx     ← fase 5
```
