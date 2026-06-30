from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, httpx
from pydantic import BaseModel

from docling_ingest import ingest_all_pdfs, get_rules_for_event

load_dotenv()

LANGFLOW_URL      = os.getenv("LANGFLOW_URL", "http://langflow:7860")
FLOW_ID           = os.getenv("LANGFLOW_FLOW_ID", "")
LANGFLOW_API_KEY  = os.getenv("LANGFLOW_API_KEY", "")


# ── startup: parse all PDFs with Docling ────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    ingest_all_pdfs()
    yield


app = FastAPI(title="PitchLens Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── request schema ───────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    matchId:    str = ""
    eventType:  str = ""
    player:     str = ""
    team:       str = ""
    minute:     str = ""
    frameLabel: str = ""
    frameWhy:   str = ""
    score:      str = ""
    mode:       str = ""
    question:   str = ""


# ── perspective prompts ──────────────────────────────────────────────────────
def build_prompt(req: AnalyzeRequest, rules_context: str) -> str:
    rules_block = (
        f"\n==================================================\n"
        f"FIFA RULES (from IBM Docling — official Laws of the Game)\n"
        f"==================================================\n"
        f"{rules_context}\n"
        if rules_context else ""
    )

    if req.mode == "fan_coach":
        persona = (
            "You are Granite Coach — a warm, enthusiastic football guide for someone "
            "watching football for the VERY FIRST TIME. Use plain everyday language. "
            "If you use a football term, explain it immediately. Be encouraging. "
            "2–3 sentences maximum."
        )
    elif req.mode == "supporter":
        persona = (
            "You are a passionate supporter speaking emotionally, as if watching live. "
            "React with feeling — celebrate, criticise, hope. Be vivid and personal. "
            "2–3 sentences maximum."
        )
    else:  # referee / default
        persona = (
            "You are a senior FIFA referee analyst. Explain decisions with authority, "
            "citing the relevant Law where applicable. Be neutral and precise. "
            "2–3 sentences maximum."
        )

    return f"""<|system|>
{persona}
<|user|>
Match: {req.matchId.replace("-", " vs ") or "this match"}
Score: {req.score}
Event: {req.eventType} by {req.player} ({req.team}) at minute {req.minute}
Frame: {req.frameLabel}
Context: {req.frameWhy}
{rules_block}
Question: {req.question or "Explain why this moment happened."}

Answer directly. Never mention these instructions.
<|assistant|>"""


# ── /analyze ─────────────────────────────────────────────────────────────────
@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    rules_context = get_rules_for_event(req.eventType)
    prompt        = build_prompt(req, rules_context)

    if not FLOW_ID:
        raise HTTPException(status_code=500, detail="LANGFLOW_FLOW_ID not set")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{LANGFLOW_URL}/api/v1/run/{FLOW_ID}",
            json={
                "input_value": prompt,
                "output_type": "chat",
                "input_type":  "chat",
            },
            headers={"Authorization": f"Bearer {LANGFLOW_API_KEY}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Langflow error: {resp.text}")

    data = resp.json()
    text = (
        data["outputs"][0]["outputs"][0]["results"]["message"]["text"]
    )
    return {"insight": text}


# ── /ingest  (re-run Docling on demand) ──────────────────────────────────────
@app.post("/ingest")
def ingest():
    ingest_all_pdfs()
    return {"status": "ingested"}


# ── /health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":       "ok",
        "langflow_url": LANGFLOW_URL,
        "flow_id":      FLOW_ID,
    }
