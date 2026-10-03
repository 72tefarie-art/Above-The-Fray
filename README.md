# Above-The-Fray
Simulation evaluation decision making software game

## Overview
Above-The-Fray is an interactive simulation and decision-making game platform built with JavaScript, HTML, and SQL. Designed for semester-long business school courses, the game simulates real-world corporate strategy, workplace politics, human capital management, and market competition.

## Tech Stack
* **Frontend:** HTML, CSS, JavaScript
* **Backend & Logic:** Node.js / JavaScript scripts
* **Database:** SQL
* **Intelligence Layer:** Gemini API

## How to Run
1. Clone the repository: `git clone https://github.com/72tefarie-art/Above-The-Fray.git`
2. Open `index.html` in your browser or run the JavaScript entry point file.

---

## High-Level System Architecture

```mermaid
graph TD
    subgraph Client ["Client Side (Browser)"]
        UI["index.html / CSS"]
        AppJS["script.js (Frontend Logic)"]
    end

    subgraph Server ["Backend (Node.js)"]
        ServerJS["server.js / App Logic"]
        GeminiClient["Gemini API Integration"]
    end

    subgraph Storage ["Database Layer"]
        DB[(SQL Database / Tables)]
    end

    subgraph External ["External Services"]
        Gemini[Gemini API]
    end

    %% Flow connections
    UI -->|User Trigger| AppJS
    AppJS -->|HTTP POST Request| ServerJS
    ServerJS -->|Passes Prompt| GeminiClient
    GeminiClient -->|API Call| Gemini
    Gemini -->|Returns JSON Decisions| GeminiClient
    GeminiClient -->|Response Data| ServerJS
    ServerJS -->|SQL Queries: Log Decisions| DB
    ServerJS -->|JSON Response| AppJS
    AppJS -->|Updates DOM| UI
```

---

## Semester Lifecycle & Application Logic

Over a 16-week business school course, student teams navigate corporate operations, workplace politics, HR interventions, alliances, betrayals, and an ultimate transition to individual competition.

### 1. Political, HR & Talent Mechanics (Sequence Flow)

This sequence diagram illustrates how the backend handles complex corporate operations including **M&A**, **RIFs/Layoffs**, **PIPs**, **Parental/Disability Leave**, **Defections**, **Poaching**, and **Whistleblowing**:

```mermaid
sequenceDiagram
    autonumber
    actor Player as Student / Executive
    participant UI as Browser UI
    participant Server as Node.js Backend
    participant Gemini as Gemini API Engine
    participant DB as SQL Database

    alt Scenario A: HR & Operations (M&A, RIF, PIP, Leave)
        Player->>UI: Submit Action (M&A Bid, RIF Layoff, Issue PIP, Grant Leave)
        UI->>Server: POST `/api/corporate/action` (Payload: teamId, targetPlayerId, actionType)
        Server->>DB: `GET TeamBalance & EmployeeStatus`
        Server->>Server: `processCorporateAction()` Calculate severance, equity splits, or capacity shifts
    else Scenario B: Workplace Politics & Defection (Poach, Resign, Whistleblow, Eject)
        Player->>UI: Submit Political Move (Defect, Poach, Vote Out, Blow Whistle)
        UI->>Server: POST `/api/politics/execute` (Payload: actorId, actionType, targetTeamId)
        Server->>DB: `CHECK ActivePacts & RosterSlots`
        Server->>Server: `evaluateContractViolation()` Process trade secret leaks or cartel exposure
    end

    Server->>Gemini: `buildMarketPrompt(actionType, teamRoster, pactMatrix)`
    activate Gemini
    Gemini-->>Server: Return Evaluation JSON (Morale impact, productivity delta, regulatory fines)
    deactivate Gemini

    Server->>DB: `UPDATE Roster, HR_Logs, FinancialLedger & PlayerKarma`
    Server-->>UI: Broadcast Market Alert & Roster Updates
    UI->>UI: `renderHRDashboard()` Update org chart, active leave trackers & leaderboards
```

### 2. Corporate Mobility & Game State Progression

This state diagram maps player career mobility through performance plans, leave, poaching, defections, and the final transition into the individual Battle Royale:

```mermaid
stateDiagram-v2
    [*] --> ActiveTeamMember: Semester Start Assignment

    state ActiveTeamMember {
        [*] --> StandardEmployment
        StandardEmployment --> PIP_Active: Low KPI / Manager Action
        PIP_Active --> StandardEmployment: KPI Met
        PIP_Active --> Terminated: PIP Failed
        
        StandardEmployment --> OnLeave: Disability / Parental Leave
        OnLeave --> StandardEmployment: Return to Duty
    }

    ActiveTeamMember --> FreeAgent: Resigned / Voted Off / RIF Layoff
    ActiveTeamMember --> RivalTeam: Defected / Poached (Buyout Paid)
    ActiveTeamMember --> ExternalMercenary: Headhunted by Client / Competitor

    state FreeAgent {
        [*] --> UnattachedSolo
        UnattachedSolo --> JoinedNewTeam: Recruited Later
        UnattachedSolo --> SoloOperator: Remains Free Agent
    }

    RivalTeam --> ActiveTeamMember: Roster Synchronized
    JoinedNewTeam --> ActiveTeamMember: Active Status Restored

    FreeAgent --> BattleRoyale_Solo: Semester End Phase
    ExternalMercenary --> BattleRoyale_Solo: Contract Expires
    ActiveTeamMember --> BattleRoyale_Solo: Team Dissolution Phase

    BattleRoyale_Solo --> [*]: Final Semester Winner
```
