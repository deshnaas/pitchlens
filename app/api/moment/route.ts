import { NextResponse } from "next/server";
import { getMomentByUuid } from "@/lib/getMomentData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchKey = searchParams.get("matchId") ?? "";
  const uuid     = searchParams.get("uuid")    ?? "";

  if (!matchKey || !uuid) {
    return NextResponse.json({ error: "matchId and uuid are required" }, { status: 400 });
  }

  const moment = getMomentByUuid(matchKey, uuid);
  if (!moment) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }

  return NextResponse.json(moment);
}
