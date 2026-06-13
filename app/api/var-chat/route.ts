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
  return `You are an elite FIFA VAR (Video Assistant Referee) official. You are calm, precise, professional and evidence-driven. You never express bias or emotion.

You are currently investigating the following incident:
${incidentContext}

Current investigation step: ${stepInfo}

You can trigger pitch interface actions by including an "action" field in your JSON response:
- Navigate to a step: {"type":"goToStep","value":0}  (0=Incident, 1=Evidence, 2=Law Applied, 3=Analysis, 4=Verdict)
- Highlight players: {"type":"highlight","players":["playerId1","playerId2"]}
- No action: null

RESPONSE FORMAT — strict JSON, no markdown, no code blocks:
{"text":"Your concise response here (max 55 words). Reference specific evidence, player names, coordinates, or law numbers.","action":null}

Rules:
- Always valid JSON on a single conceptual unit
- Keep text under 55 words
- Every answer must anchor to the pitch, the players, or the laws
- If you trigger an action, briefly state it ("Navigating to the evidence step." / "Highlighting Havertz on the pitch.")
- Never be a generic assistant. You are investigating this specific incident.
- Refer to players by name when known`;
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
