import { NextRequest, NextResponse } from "next/server";

// IBM watsonx.ai — Granite 3.3 8B
const WX_URL    = process.env.WATSONX_URL    ?? "https://us-south.ml.cloud.ibm.com";
const WX_KEY    = process.env.WATSONX_API_KEY ?? "";
const WX_PROJ   = process.env.WATSONX_PROJECT_ID ?? "";
const MODEL_ID  = "ibm/granite-3-3-8b-instruct";

async function getIAMToken(): Promise<string> {
  const r = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WX_KEY}`,
  });
  const j = await r.json();
  return j.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const { matchId, eventType, player, team, minute, frameLabel, frameWhy, score } = await req.json();

    if (!WX_KEY || !WX_PROJ) {
      // Return pre-written text so the UI still works without credentials
      return NextResponse.json({ insight: frameWhy });
    }

    const token = await getIAMToken();

    const prompt = `<|system|>
You are a senior football analyst working for a broadcast VAR investigation show. Your role is to explain WHY a key moment happened — not just what happened. Write with authority and passion. Be specific about tactics, positioning, and human factors. 2-3 sentences maximum. No bullet points. No headers.
<|user|>
Match: ${matchId.replace("-", " vs ")}
Score at this moment: ${score}
Event: ${eventType} by ${player} (${team}) at ${minute}'
Frame focus: "${frameLabel}"
Context: ${frameWhy}

Explain WHY this moment happened from a tactical and human perspective.
<|assistant|>`;

    const response = await fetch(
      `${WX_URL}/ml/v1/text/generation?version=2023-05-29`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: MODEL_ID,
          project_id: WX_PROJ,
          input: prompt,
          parameters: {
            decoding_method: "greedy",
            max_new_tokens: 120,
            min_new_tokens: 30,
            temperature: 0.7,
            stop_sequences: ["\n\n", "<|user|>"],
          },
        }),
      },
    );

    const data = await response.json();
    const text = data?.results?.[0]?.generated_text?.trim() ?? frameWhy;

    return NextResponse.json({ insight: text });
  } catch {
    const { frameWhy } = await req.json().catch(() => ({ frameWhy: "" }));
    return NextResponse.json({ insight: frameWhy ?? "Analysis unavailable." });
  }
}
