import { NextRequest, NextResponse } from "next/server";
import { normalizeLichess } from "@/lib/lichess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIFFICULTY = new Set(["easiest", "easier", "normal", "harder", "hardest"]);

// GET /api/puzzle?angle=fork&difficulty=normal   -> a random Lichess puzzle
// GET /api/puzzle?id=K69di                       -> a specific puzzle
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const id = q.get("id");
  const angle = q.get("angle") || "";
  const difficulty = q.get("difficulty") || "normal";
  let url: string;
  if (id) {
    if (!/^[A-Za-z0-9]{3,12}$/.test(id)) return NextResponse.json({ error: "Bad puzzle id." }, { status: 400 });
    url = `https://lichess.org/api/puzzle/${id}`;
  } else {
    if (angle && !/^[A-Za-z0-9_-]{1,40}$/.test(angle)) return NextResponse.json({ error: "Bad problem type." }, { status: 400 });
    if (!DIFFICULTY.has(difficulty)) return NextResponse.json({ error: "Bad difficulty." }, { status: 400 });
    const p = new URLSearchParams({ difficulty });
    if (angle) p.set("angle", angle);
    url = `https://lichess.org/api/puzzle/next?${p}`;
  }
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Openfile chess trainer" }, cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "Lichess did not return a puzzle." }, { status: 502 });
    const problem = normalizeLichess(await r.json());
    if (!problem) return NextResponse.json({ error: "Could not read that puzzle." }, { status: 502 });
    return NextResponse.json(problem);
  } catch {
    return NextResponse.json({ error: "Could not reach Lichess." }, { status: 502 });
  }
}
