# PitchLens — One Match. Three Realities.

> IBM Skills Build Challenge — June 2025 Innovation Challenge

**PitchLens** transforms how people experience football. The same match moment — a foul, a goal, an offside call — is seen completely differently by a new fan, a passionate supporter, and a referee. PitchLens gives each of them their own reality.

---

## The Problem

Football is the world's most watched sport, yet most broadcast experiences are built for one type of viewer. A new fan watching their first World Cup match has no idea why the referee stopped play. A die-hard supporter wants emotional connection, not dry statistics. A referee analyst needs cold tactical data, not hype.

**One match. Three completely different needs. Zero products that serve all three.**

---

## Our Solution

PitchLens is a three-lens immersive experience built on real StatsBomb 360 data from the 2022 FIFA World Cup. Users choose their identity — New Fan, Supporter, or Referee — and enter a completely different world for the same match moment.

### The Three Lenses

| Lens | Experience | AI Coach |
|------|-----------|----------|
| 🟡 **New Fan** | Warm broadcast stadium, figurine players, simple explanations | Explains football from scratch — no jargon |
| 🔴 **Supporter** | Team-coloured atmosphere, confetti, emotional storytelling | Speaks like a passionate fan watching live |
| 🔵 **Referee** | Cold VAR room aesthetic, tactical grid overlay, analytical | Cites FIFA Laws of the Game, zero bias |

Each lens has its own **3D stadium** (built in Three.js / React Three Fiber), its own **lighting**, its own **AI coach personality**, and its own **camera mode** — including a Player POV mode where you tap any player on the pitch to see the match through their eyes.

---

## Why It Matters for Soccer and the World Cup

The 2026 FIFA World Cup will be hosted across North America — the largest football event ever, reaching hundreds of millions of new fans who have never watched the sport before. PitchLens solves the exact problem of making football accessible, emotional, and analytically rich — simultaneously, for different audiences.

Real StatsBomb 360 freeze-frame data from 6 World Cup 2022 matches is embedded, giving every moment spatial accuracy with all 22 players tracked on the pitch.

---

## AI & Technical Approach

### IBM Technologies Used

**1. IBM Docling** — Knowledge & Data Handling
- Parses the FIFA Laws of the Game PDF into structured knowledge
- Extracts rules by section (offside, fouls, cards, VAR protocol)
- Injects relevant rules into the AI prompt based on the event type
- Ensures the Referee lens AI coach cites actual FIFA law, not hallucinated rules

**2. LangFlow** — AI Pipeline Orchestration
- The full AI pipeline was designed and orchestrated using LangFlow
- The exported LangFlow flow is included in this repository (`langflow_flow.json`)
- Three perspective-aware prompting strategies (fan / supporter / referee) are defined as a LangFlow pipeline
- The pipeline routes each question through the correct prompt template before reaching the LLM

### Full Stack

```
StatsBomb 360 Data (6 WC2022 matches)
        ↓
Next.js Frontend (Three.js 3D Stadium)
        ↓
FastAPI Backend
   ├── IBM Docling → parses FIFA Laws PDF → injects rules as context
   └── LangFlow pipeline → perspective prompt → Groq LLM → response
        ↓
Three AI Coaches (New Fan / Supporter / Referee)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React Three Fiber, Three.js 0.184 |
| 3D Engine | React Three Fiber, @react-three/drei |
| Data | StatsBomb 360 (6 World Cup 2022 matches, ~20,000 events) |
| AI Orchestration | LangFlow |
| Knowledge Parsing | IBM Docling |
| LLM | Groq (llama-3.3-70b) |
| Backend | FastAPI (Python) |
| Hosting | Vercel (frontend) |

---

## Matches Included

| Match | Stage | Key Moment |
|-------|-------|-----------|
| Japan vs Spain | Group Stage | Historic comeback |
| Germany vs Japan | Group Stage | Germany's collapse |
| England vs Wales | Group Stage | Derby day drama |
| Ghana vs Portugal | Group Stage | Ronaldo's historic night |
| Iran vs USA | Group Stage | Political tension on the pitch |
| Belgium vs Croatia | Group Stage | De Bruyne's last dance |

---

## LangFlow Pipeline

The LangFlow flow (`langflow_flow.json`) defines the full AI pipeline:

1. **Input** — match event data (player, team, minute, event type, lens mode)
2. **Perspective Router** — selects the correct prompt template based on lens (fan / supporter / referee)
3. **Docling Context Injector** — pulls relevant FIFA rules for referee lens
4. **LLM Node** — sends enriched prompt to the language model
5. **Output** — returns a perspective-accurate response to the frontend

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
├── app/                          # Next.js pages
│   ├── fan/                      # New Fan lens
│   ├── referee/                  # Referee lens
│   ├── supporter/                # Supporter lens
│   └── moment/                   # 3D stadium viewer
├── components/
│   ├── MomentViewer.tsx          # 3D stadium + player POV
│   ├── TacticalWorld.tsx         # Three.js world, per-lens lighting
│   ├── fan/FanStoryScreen.tsx
│   ├── supporter/SupporterStoryScreen.tsx
│   └── incident/MatchStoryScreen.tsx
├── backend/
│   ├── main.py                   # FastAPI + Groq integration
│   ├── docling_ingest.py         # IBM Docling PDF parser
│   ├── rules_store.py            # FIFA rules lookup by event type
│   └── requirements.txt
├── lib/
│   ├── matchData.ts              # 6 WC2022 matches + events
│   ├── getMomentData.ts          # StatsBomb 360 data lookup
│   └── matchNarratives.ts        # Match story narratives
├── data/
│   └── pitchlens_master_dataset.json  # StatsBomb 360 freeze-frames
└── langflow_flow.json            # Exported LangFlow pipeline
```

---

## Team

| Name | Role |
|------|------|
| Deshnaa | Frontend, 3D Experience, AI Integration |
| Anirudh Sreeram | Backend, LangFlow Pipeline, Docling Integration |

---

## IBM Skills Build Challenge — June 2025
