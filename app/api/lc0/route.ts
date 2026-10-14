import { NextRequest, NextResponse } from "next/server";
import { lc0 } from "@/lib/lc0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEN_RE = /^[pnbrqkPNBRQK1-8/]{15,90} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) \d{1,3} \d{1,4}$/;

// GET: is Leela configured and working?
export async function GET() {
  return NextResponse.json(await lc0().status());
}

// POST { fen, nodes }: ask Leela for its best move and evaluation.
export async function POST(req: NextRequest) {
  let body: { fen?: unknown; nodes?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  const fen = typeof body.fen === "string" ? body.fen : "";
  if (!FEN_RE.test(fen)) return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  const nodes = Math.max(1, Math.min(20000, Math.floor(Number(body.nodes) || 100)));
  try {
    return NextResponse.json(await lc0().analyse(fen, nodes));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
