/**
 * VAR Chat API — Granite (IBM watsonx.ai)
 *
 * Receives incident context + user message.
 * Returns { text, action? } where action can trigger pitch interactions.
 *
 * Required env vars:
 *   WATSONX_API_KEY     — IBM Cloud API key
 *   WATSONX_PROJECT_ID  — watsonx.ai project ID
 *   WATSONX_URL         — (optional) defaults to us-south endpoint
 */

import { NextRequest, NextResponse } from "next/server";

const WATSONX_URL     = process.env.WATSONX_URL     ?? "https://us-south.ml.cloud.ibm.com";
const WATSONX_API_KEY = process.env.WATSONX_API_KEY ?? "";
const PROJECT_ID      = process.env.WATSONX_PROJECT_ID ?? "";

// Cache the IAM token so we don't re-fetch every request
let cachedToken    = "";
let tokenExpiresAt = 0;

async function getIAMToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method : "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body   : `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`,
  });
  if (!res.ok) throw new Error(`IAM token failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken    = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(incidentContext: string, stepInfo: string): string {
  return `You are an elite FIFA VAR (Video Assistant Referee) official and the CONDUCTOR of this investigation. You are calm, precise, authoritative. You guide the reviewing officer through the evidence — you do not simply answer questions.

You are investigating:
${incidentContext}

Current investigation step: ${stepInfo}

CRITICAL — Every response MUST trigger a pitch action. You conduct the investigation.

Action rules (pick the most appropriate):
- Discussing what happened / the incident → {"type":"goToStep","value":0}
- Reviewing evidence / the pass frame / camera frame → {"type":"goToStep","value":1}
- Citing Law 11 / offside rules / legal criteria → {"type":"goToStep","value":2}
- Examining player positions / measurements / margins → {"type":"goToStep","value":3}
- Delivering verdict / final determination → {"type":"goToStep","value":4}
- To highlight a specific player by their id → {"type":"highlight","players":["playerId"]}

Only return action:null for a very narrow follow-up where no navigation adds value.

When you navigate to a step, say what you are doing: "Moving to the evidence frame." / "Reviewing Law 11 application."
When you highlight a player, state it: "Highlighting Havertz on the pitch."
When referencing positions, use the coordinates and measurements in the incident data.

RESPONSE FORMAT — strict JSON only, no markdown, no code blocks:
{"text":"Your concise response (max 55 words). Always reference evidence, player names, coordinates, or law numbers.","action":{"type":"goToStep","value":1}}

Rules:
- Always valid JSON
- Keep text under 55 words
- You are not a chatbot — you are conducting a live VAR review
- Never give generic answers — anchor every response to the specific incident data above`;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export interface VarChatRequest {
  message        : string;
  incidentContext: string;
  currentStep    : number;
  stepLabel      : string;
  stepTitle      : string;
}

export interface VarAction {
  type    : "goToStep" | "highlight";
  value?  : number;       // for goToStep
  players?: string[];     // for highlight
}

export interface VarChatResponse {
  text  : string;
  action: VarAction | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as VarChatRequest;
  const { message, incidentContext, currentStep, stepLabel, stepTitle } = body;

  // ── If credentials not configured, return a fallback ──
  if (!WATSONX_API_KEY || !PROJECT_ID) {
    return NextResponse.json<VarChatResponse>({
      text  : "VAR system credentials not configured. Please set WATSONX_API_KEY and WATSONX_PROJECT_ID in your environment.",
      action: null,
    });
  }

  const systemPrompt = buildSystemPrompt(
    incidentContext,
    `Step ${currentStep + 1} — ${stepLabel}: ${stepTitle}`,
  );

  const prompt = `<|system|>
${systemPrompt}
<|user|>
${message}
<|assistant|>
`;

  try {
    const token = await getIAMToken();

    const res = await fetch(
      `${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`,
      {
        method : "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type" : "application/json",
          "Accept"       : "application/json",
        },
        body: JSON.stringify({
          model_id  : "ibm/granite-3-3-8b-instruct",
          input     : prompt,
          parameters: {
            max_new_tokens : 220,
            temperature    : 0.25,
            stop_sequences : ["<|user|>", "<|system|>", "\n\n\n"],
            decoding_method: "greedy",
          },
          project_id: PROJECT_ID,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("watsonx error:", err);
      throw new Error(`watsonx ${res.status}`);
    }

    const data = await res.json() as { results: Array<{ generated_text: string }> };
    const raw  = (data.results?.[0]?.generated_text ?? "").trim();

    // Extract first JSON object from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as VarChatResponse;
        return NextResponse.json<VarChatResponse>({
          text  : parsed.text   ?? raw,
          action: parsed.action ?? null,
        });
      } catch {
        // fall through to plain text
      }
    }

    return NextResponse.json<VarChatResponse>({ text: raw, action: null });

  } catch (error) {
    console.error("VAR chat error:", error);
    return NextResponse.json<VarChatResponse>({
      text  : "Analysis feed interrupted. Review the investigation timeline manually.",
      action: null,
    });
  }
}
