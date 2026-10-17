import { NextRequest, NextResponse } from "next/server";
import { enginePool } from "@/lib/uci";
import type { EngineId } from "@/lib/uci";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEN_RE = /^[pnbrqkPNBRQK1-8/]{15,90} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) \d{1,3} \d{1,4}$/;
const isEngine = (v: unknown): v is EngineId => v === "leela" || v === "stockfish";
const clamp = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, n)) : undefined;
};

// GET /api/engine?engine=leela|stockfish : is that engine configured and working?
export async function GET(req: NextRequest) {
  const e = req.nextUrl.searchParams.get("engine");
  if (!isEngine(e)) return NextResponse.json({ error: "Unknown engine." }, { status: 400 });
  return NextResponse.json(await enginePool(e).status());
}

// POST { engine, fen, nodes | depth | movetime, multipv?, skill? } : the engine's best lines for a position.
export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (!isEngine(b.engine)) return NextResponse.json({ error: "Unknown engine." }, { status: 400 });
  const fen = typeof b.fen === "string" ? b.fen : "";
  if (!FEN_RE.test(fen)) return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  const skill = b.skill === undefined ? undefined : Math.max(0, Math.min(20, Math.floor(Number(b.skill)) || 0));
  const request = {
    fen,
    nodes: clamp(b.nodes, 1, 200000),
    depth: clamp(b.depth, 1, 40),
    movetime: clamp(b.movetime, 10, 30000),
    multipv: clamp(b.multipv, 1, 5) ?? 1,
    skill,
  };
  try {
    return NextResponse.json(await enginePool(b.engine).analyse(request));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
