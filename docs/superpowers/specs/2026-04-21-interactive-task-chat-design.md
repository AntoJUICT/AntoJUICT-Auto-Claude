# Design: Interactieve Chat bij Taak Aanmaken

**Datum:** 2026-04-21
**Status:** Goedgekeurd

## Probleemstelling

Gebruikers vullen bij het aanmaken van een taak een beschrijving in die te summier is. De huidige `TaskCreationWizard` is een enkel formulier dat geen begeleiding biedt bij het formuleren van een goede spec.

## Oplossing: Twee-fasen Dialog

De `TaskCreationWizard` krijgt twee fasen. Fase 1 is een chat-interface waarbij de AI gerichte vragen stelt. Zodra de AI genoeg weet, genereert hij een volwaardige beschrijving die automatisch in het bestaande formulier wordt ingevuld (fase 2). De gebruiker past nog aan en maakt de taak aan.

## UX Flow

```
TaskCreationWizard opent
        ↓
  [FASE 1 — Chat]
  AI: "Wat wil je bouwen of oplossen?"
  Gebruiker antwoordt
  AI stelt max 2 vervolgvragen
  AI: "Ik heb genoeg om een goede taak te schrijven.
       Wil je nog iets toevoegen, of zal ik doorgaan?"
  → [Nog iets toevoegen] of [Ja, genereer →]
        ↓
  AI genereert gestructureerde description
        ↓
  [Fade/slide naar fase 2]
        ↓
  [FASE 2 — Formulier]
  Bestaand formulier, description pre-filled
  Optioneel: banner "Samengevat uit gesprek" (alleen als chat plaatsvond)
  Gebruiker past aan → klikt "Taak aanmaken"
        ↓
  Bestaande IPC TASK_CREATE flow (ongewijzigd)
```

## Chat-fase UI

```
┌─────────────────────────────────────────────────────────┐
│  New Task                                        [×]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🤖  Wat wil je bouwen of oplossen?              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│       ┌─────────────────────────────────────────┐      │
│       │ fix de create knop in de wizard      🙂 │      │
│       └─────────────────────────────────────────┘      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🤖  Wat is het huidige gedrag, en wat moet     │   │
│  │     het worden?                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Typ je antwoord...                    [Verstuur] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─── stap 1 van max 3 ── [Sla vragen over →]           │
└─────────────────────────────────────────────────────────┘
```

### Overgangsmoment (B2)

Wanneer de AI besluit genoeg te weten, toont hij een bevestigingsvraag met twee knoppen:

```
│  🤖  Ik heb genoeg om een goede taak te schrijven.     │
│       Wil je nog iets toevoegen, of zal ik doorgaan?   │
│                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   │
│  │  Nog iets toevoegen  │   │  Ja, genereer →      │   │
│  └──────────────────────┘   └──────────────────────┘   │
```

## Formulier-fase UI

```
┌─────────────────────────────────────────────────────────┐
│  New Task                                        [×]    │
├─────────────────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════════════════╗  │
│  ║ 💬 Samengevat uit gesprek  [Gesprek bekijken ↓]  ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│  (banner alleen zichtbaar als chat plaatsvond)          │
│                                                         │
│  Description *                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ **Wat:** Fix the TaskCreationWizard create       │   │
│  │ button — dialog should close after create.       │   │
│  │                                                  │   │
│  │ **Nu:** Dialog blijft open na succesvol aanmaken │   │
│  │                                                  │   │
│  │ **Acceptatiecriteria:**                          │   │
│  │ - Dialog sluit na succesvolle create             │   │
│  │ - Bij validatiefout blijft dialog open           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Title (optional)          Priority                     │
│  ┌──────────────────┐      ┌───────────┐               │
│  │                  │      │  Medium ▾ │               │
│  └──────────────────┘      └───────────┘               │
│                                                         │
│  ▸ Classification   ▸ Git Options                       │
│                                                         │
│              [Annuleren]  [Taak aanmaken →]             │
└─────────────────────────────────────────────────────────┘
```

## Gegenereerd Beschrijvingsformaat

De AI genereert altijd in dit formaat:

```
**Wat:** [korte omschrijving van de wijziging]

**Nu:** [huidig gedrag]

**Verwacht:** [gewenst gedrag]

**Acceptatiecriteria:**
- [criterium 1]
- [criterium 2]
```

## Technische Architectuur

### Frontend

`TaskCreationWizard.tsx` krijgt een `phase` state (`'chat' | 'form'`).

- `phase === 'chat'` → nieuw component `<TaskChatPhase />`
- `phase === 'form'` → bestaande form-code ongewijzigd, met optionele chatbanner

`TaskChatPhase` bevat:
- Berichtenlijst (AI + gebruiker beurtelings, scrollbaar)
- Inputveld + Verstuur-knop
- Stap-indicator onderin + "Sla over"-link
- Bevestigingsknoppen wanneer AI klaar is

### Backend / IPC

Nieuwe IPC-handler: `TASK_CHAT_MESSAGE`

**Request:** `{ messages: ChatMessage[], projectId: string }`

**Response (JSON):**
```json
{ "done": false, "question": "Wat is het huidige gedrag?" }
// of:
{ "done": true, "description": "**Wat:** ..." }
```

De backend gebruikt `create_client()` (bestaande Claude SDK client) met een systeem-prompt die:
- maximaal 3 vragen stelt (inclusief de openingsvraag)
- na elke vraag evalueert of er genoeg info is
- bij `done: true` altijd het gestandaardiseerde description-formaat retourneert

### Wat ongewijzigd blijft

- IPC-handler `TASK_CREATE` en alles erna
- Draft persistence logica
- Alle bestaande formuliervelden
- Bestaande i18n structuur (nieuwe keys worden toegevoegd aan `en/*.json` en `fr/*.json`)

## Randgevallen

- **Gebruiker slaat chat over** via "Sla vragen over →": direct naar fase 2, lege description, geen banner
- **Verbindingsfout tijdens chat**: foutmelding inline tonen, gebruiker kan opnieuw proberen of overslaan
- **Draft bestaat al**: draft laden slaat de chat-fase over en toont direct het formulier met de eerder opgeslagen inhoud
