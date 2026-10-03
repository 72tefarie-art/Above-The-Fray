# Above-The-Fray
Simulation evaluation decision making software game

## Overview
Above-The-Fray is an interactive simulation and decision-making game platform built with JavaScript, HTML, and SQL.

## Tech Stack
* **Frontend:** HTML, CSS, JavaScript
* **Backend & Logic:** Node.js / JavaScript scripts
* **Database:** SQL

## How to Run
1. Clone the repository: `git clone https://github.com/72tefarie-art/Above-The-Fray.git`
2. Open `index.html` in your browser or run the JavaScript entry point file.

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
