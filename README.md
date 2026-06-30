# PitchLens — One Match. Three Realities.

> IBM Skills Build Challenge — June 2025 Innovation Challenge

---

## The Problem

Football is the world's most watched sport — yet every broadcast experience is built for one type of viewer.

A **new fan** watching their first World Cup match has no idea why the referee stopped play. They see 22 people running and a whistle. Nothing more.

A **passionate supporter** doesn't want tactics or statistics. They want to feel the match. The tension. The heartbreak. The euphoria.

A **referee analyst** needs cold, unbiased fact. No hype. No narrative. Just law and decision.

**One match. Three completely different needs. Zero products that serve all three.**

Most football apps pick one audience and ignore the rest. PitchLens solves this by giving every type of viewer their own reality — simultaneously, from the same data.

---

## Our Solution

PitchLens is a three-lens immersive experience built on real StatsBomb 360 data from the 2022 FIFA World Cup. Users choose their identity and enter a completely different world for the same match moment.

### The Three Lenses

| Lens | Visual World | AI Coach Personality |
|------|-------------|---------------------|
| 🟡 **New Fan** | Warm broadcast stadium, figurine players, bright floodlights | Warm and simple — explains everything from scratch, zero jargon |
| 🔴 **Supporter** | Team-coloured atmosphere, confetti rain, theatrical lighting | Passionate and emotional — reacts like a fan in the stands |
| 🔵 **Referee** | Cold VAR room aesthetic, tactical grid overlay, analytical lighting | Neutral and precise — cites FIFA Laws of the Game, zero bias |

Each lens has its own **3D stadium** built in Three.js, its own **lighting system**, its own **AI coach**, and its own **camera mode** — including a Player POV mode where you tap any player to see the match through their eyes.

---

## Why It Matters for Soccer and the FIFA World Cup

The **2026 FIFA World Cup** will be the largest sporting event in history — hosted across North America and expected to reach over 5 billion viewers worldwide. Millions of those viewers will be watching football for the very first time.

**The accessibility gap is real.** A new American fan watching their first match understands almost nothing of what they're seeing. Offside rules, tactical shapes, set piece routines — these are invisible to the uninitiated. Yet the emotional stakes are immediately felt.

PitchLens bridges this gap by making the same match moment:
- **Accessible** to someone who has never watched football
- **Emotional** for a supporter living every second
- **Analytical** for a referee or football professional

This matters beyond the World Cup. Football has 5 billion fans globally but still struggles to bring new audiences in. PitchLens is the product that lets a first-time viewer sit next to a 30-year ultra and both feel completely served by the same experience.

Real **StatsBomb 360 freeze-frame data** from 6 World Cup 2022 matches gives every moment spatial accuracy — all 22 players tracked on the pitch, every position reconstructed from actual match data.

---

## AI & Technical Approach

### IBM Technologies Used

**1. IBM Docling** — Knowledge & Data Handling
- Parses the FIFA Laws of the Game PDF (200+ pages) into structured, queryable knowledge
- Extracts rules by section: offside (Law 11), fouls (Law 12), cards, VAR protocol, handball
- Injects the relevant law directly into the Referee Coach's context for each event type
- Ensures the Referee lens never hallucinates a rule — every response is grounded in actual FIFA law
- Every Referee Coach response ends with: `Source: FIFA Laws of the Game 2024 (Docling RAG)`

**2. LangFlow** — AI Pipeline Orchestration
- The full AI pipeline was designed, built, and tested in LangFlow
- The exported LangFlow flow is included in this repository (`langflow_flow.json`)
- Three distinct prompting strategies — fan / supporter / referee — are defined as a LangFlow pipeline
- The pipeline routes each question through the correct perspective prompt before reaching the LLM
- Few-shot examples are baked into each branch so the LLM responds in-character from the first token

### How the AI Coaches Work

The three coaches are not three different models. They are the same LLM — instructed to inhabit three completely different roles through carefully engineered prompts:

**New Fan Coach**
Warm, patient, educational. Explains what happened and why it matters in plain language. Never uses jargon without explaining it. Treats the user like an intelligent adult watching football for the first time.

**Supporter Coach**
Reacts as a passionate fan of the team the user chose. Speaks in first person plural ("we", "our"). Emotional intensity is calibrated to the scoreline and match minute — a missed penalty in the 90th minute gets a very different reaction than one in the 10th. Uses natural supporter language ("Noooo", "Yesss", "We're still in this").

**Referee Coach**
Completely neutral. Explains decisions using FIFA Laws of the Game. Never celebrates, never criticizes, never takes a side. Every response is structured: event → relevant law → outcome. Powered by Docling's parsed FIFA rulebook.

### Full Architecture

```
StatsBomb 360 Data (6 WC2022 matches, ~20,000 events)
        ↓
Next.js Frontend — Three.js 3D Stadium (per-lens lighting, camera, atmosphere)
        ↓
/api/granite — Next.js serverless function
   ├── mode: fan_coach   → New Fan prompt chain   → Groq LLM
   ├── mode: supporter   → Supporter prompt chain  → Groq LLM
   └── mode: referee     → Referee prompt chain
                            + IBM Docling FIFA rules context → Groq LLM
        ↓
Three perspective-accurate AI coach responses
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, TypeScript |
| 3D Engine | Three.js 0.184, React Three Fiber, @react-three/drei |
| Data | StatsBomb 360 (6 World Cup 2022 matches) |
| AI Orchestration | LangFlow |
| Knowledge Parsing | IBM Docling |
| LLM | Groq — llama-3.3-70b-versatile |
| Backend | FastAPI (Python) |
| Hosting | Vercel |

---

## Matches Included

| Match | Stage | Key Moment |
|-------|-------|-----------|
| Japan vs Spain | Group Stage · Group E | Historic comeback — Japan win from 0-1 down |
| Germany vs Japan | Group Stage · Group E | Germany's stunning collapse |
| England vs Wales | Group Stage · Group B | Derby day drama at the World Cup |
| Ghana vs Portugal | Group Stage · Group H | Ronaldo's historic night — first player to score at 5 World Cups |
| Iran vs USA | Group Stage · Group B | Political tension on the pitch |
| Belgium vs Croatia | Group Stage · Group F | De Bruyne's last dance |

---

## LangFlow Pipeline

The LangFlow flow (`langflow_flow.json`) defines the full AI pipeline:

1. **Input** — match event data (player, team, minute, event type, lens mode, supporter team)
2. **Perspective Router** — selects the correct prompt branch based on lens (fan / supporter / referee)
3. **Docling Context Injector** — pulls relevant FIFA rules for the referee lens
4. **Few-Shot Prompt Builder** — adds calibrated examples so the LLM responds in-character
5. **LLM Node** — sends enriched prompt to the language model
6. **Output** — returns a perspective-accurate response to the frontend

---

## Running Locally

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Environment Variables
```
GROQ_API_KEY=your_groq_api_key
LANGFLOW_URL=your_langflow_url
LANGFLOW_FLOW_ID=your_flow_id
LANGFLOW_API_KEY=your_langflow_api_key
```

---

## Repository Structure

```
pitchlens-app/
├── app/
│   ├── fan/                          # New Fan lens page
│   ├── referee/                      # Referee lens page
│   ├── supporter/                    # Supporter lens page
│   ├── moment/                       # 3D stadium viewer
│   └── api/granite/route.ts          # AI coach serverless function
├── components/
│   ├── MomentViewer.tsx              # 3D stadium + player POV
│   ├── TacticalWorld.tsx             # Three.js world, per-lens lighting
│   ├── fan/FanStoryScreen.tsx
│   ├── supporter/SupporterStoryScreen.tsx
│   └── incident/MatchStoryScreen.tsx
├── backend/
│   ├── main.py                       # FastAPI + Groq integration
│   ├── docling_ingest.py             # IBM Docling PDF parser
│   ├── rules_store.py                # FIFA rules lookup by event type
│   └── requirements.txt
├── lib/
│   ├── matchData.ts                  # 6 WC2022 matches + raw events
│   ├── getMomentData.ts              # StatsBomb 360 data lookup
│   └── matchNarratives.ts            # Match story narratives
├── data/
│   └── pitchlens_master_dataset.json # StatsBomb 360 freeze-frames
└── langflow_flow.json                # Exported LangFlow pipeline
```

---

## Team

| Name | Role |
|------|------|
| Deshnaa Suresh | Frontend, 3D Experience, AI Integration |
| Anirudh Sreeram | Backend, LangFlow Pipeline, Docling Integration |

---

*IBM Skills Build Challenge — June 2025 Innovation Challenge*
