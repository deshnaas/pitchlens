import { NextRequest, NextResponse } from "next/server";

// IBM watsonx.ai — Granite 3.3 8B
const WX_URL   = process.env.WATSONX_URL        ?? "https://us-south.ml.cloud.ibm.com";
const WX_KEY   = process.env.WATSONX_API_KEY    ?? "";
const WX_PROJ  = process.env.WATSONX_PROJECT_ID ?? "";
const MODEL_ID = "ibm/granite-3-3-8b-instruct";

async function getIAMToken(): Promise<string> {
  const r = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method : "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body   : `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WX_KEY}`,
  });
  const j = await r.json();
  return j.access_token as string;
}

function buildPrompt(body: Record<string, string>): string {
  const { matchId, eventType, player, team, minute, frameLabel, frameWhy, score, mode, question } = body;

  if (mode === "fan_coach") {
    const q = question ?? frameLabel ?? "What is happening here?";
    return `<|system|>
You are Granite Coach — a warm, enthusiastic football analyst who explains the beautiful game to someone watching for the very first time. Your job is to make football exciting, understandable, and welcoming. Use plain everyday language. Avoid jargon — if you must use a football term, explain it in the same sentence. Be conversational and upbeat. 2–3 sentences maximum.
<|user|>
Match: ${matchId?.replace(/-/g, " vs ") ?? "this match"}
Event: ${eventType} by ${player} (${team}) at minute ${minute}
Question: "${q}"

Answer in a way that excites a new football fan and helps them understand exactly what just happened.
<|assistant|>`;
  }

  // Default mode — VAR-style analyst
  return `<|system|>
You are a senior football analyst working for a broadcast VAR investigation show. Your role is to explain WHY a key moment happened — not just what happened. Write with authority and passion. Be specific about tactics, positioning, and human factors. 2-3 sentences maximum. No bullet points. No headers.
<|user|>
Match: ${matchId?.replace(/-/g, " vs ") ?? ""}
Score at this moment: ${score ?? ""}
Event: ${eventType} by ${player} (${team}) at ${minute}'
Frame focus: "${frameLabel ?? ""}"
Context: ${frameWhy ?? ""}

Explain WHY this moment happened from a tactical and human perspective.
<|assistant|>`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ insight: "No data provided." }, { status: 400 });
  }

  const { frameWhy } = body;

  try {
    if (!WX_KEY || !WX_PROJ) {
      return NextResponse.json({ insight: frameWhy ?? "Analysis unavailable — Granite credentials not configured." });
    }

    const token  = await getIAMToken();
    const prompt = buildPrompt(body);

    const response = await fetch(
      `${WX_URL}/ml/v1/text/generation?version=2023-05-29`,
      {
        method : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization : `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id  : MODEL_ID,
          project_id: WX_PROJ,
          input     : prompt,
          parameters: {
            decoding_method : "greedy",
            max_new_tokens  : 130,
            min_new_tokens  : 25,
            temperature     : 0.72,
            stop_sequences  : ["\n\n", "<|user|>"],
          },
        }),
      },
    );

    const data = await response.json();
    const text = data?.results?.[0]?.generated_text?.trim() ?? frameWhy ?? "";
    return NextResponse.json({ insight: text });

  } catch {
    return NextResponse.json({ insight: frameWhy ?? "Analysis unavailable." });
  }
}
