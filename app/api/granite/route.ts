import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

function buildMessages(body: Record<string, string>) {
  const { matchId, eventType, player, team, minute, frameLabel, frameWhy, score, mode, question } = body;

  const match = matchId?.replace(/-/g, " vs ") ?? "this match";

  if (mode === "fan_coach") {
    return [
      {
        role: "system",
        content: `You are the New Fan Coach inside PitchLens — a warm, enthusiastic football guide for someone watching their very first match. Your job is to make football exciting, understandable, and welcoming. Use plain everyday language. No jargon — if you must use a football term, explain it in the same sentence. Be conversational, friendly, and upbeat. Maximum 3 sentences.`,
      },
      {
        role: "user",
        content: `Match: ${match}
Event: ${eventType} by ${player} (${team}) at minute ${minute}
Question: "${question ?? frameLabel ?? "What just happened?"}"

Explain this in a way that excites a brand new football fan.`,
      },
    ];
  }

  if (mode === "supporter") {
    return [
      {
        role: "system",
        content: `You are the Supporter Coach inside PitchLens — a passionate, emotional football fan reacting to a live match moment. Speak with raw emotion and energy, like you're in the stands. You celebrate brilliance, criticize mistakes, and feel every second. Maximum 3 sentences.`,
      },
      {
        role: "user",
        content: `Match: ${match}
Event: ${eventType} by ${player} (${team}) at minute ${minute}
Score: ${score ?? "unknown"}
Question: "${question ?? frameLabel ?? "What do you think of this?"}"

React like a passionate supporter watching this live.`,
      },
    ];
  }

  // referee / default — VAR analyst
  return [
    {
      role: "system",
      content: `You are the Referee Coach inside PitchLens — a senior football analyst and qualified referee working on a VAR investigation broadcast. You are completely neutral, analytical, and precise. You cite FIFA Laws of the Game when relevant. No fan bias. No emotion. Just facts, laws, and tactical analysis. Maximum 3 sentences.`,
    },
    {
      role: "user",
      content: `Match: ${match}
Score at this moment: ${score ?? "unknown"}
Event: ${eventType} by ${player} (${team}) at minute ${minute}
Frame context: ${frameWhy ?? frameLabel ?? ""}
Question: "${question ?? "Analyse this moment."}"

Explain WHY this happened from a tactical and rules perspective.`,
    },
  ];
}

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ insight: "No data provided." }, { status: 400 });
  }

  if (!GROQ_API_KEY) {
    return NextResponse.json({ insight: body.frameWhy ?? "AI coach unavailable — GROQ_API_KEY not configured." });
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 18000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: buildMessages(body),
        max_tokens: 150,
        temperature: 0.72,
      }),
      signal: ctrl.signal,
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? body.frameWhy ?? "";
    return NextResponse.json({ insight: text });

  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ insight: "Took too long to respond. Try again." });
    }
    return NextResponse.json({ insight: body.frameWhy ?? "Analysis unavailable." });
  } finally {
    clearTimeout(timeout);
  }
}
