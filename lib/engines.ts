// Browser side: talks to the server routes that run Leela and Stockfish.
import type { Move, State } from "./chess";
import { legalMoves, makeMove, moveFromUci, toFen } from "./chess";
import type { Line } from "./engine";

export type ServerEngine = "leela" | "stockfish";
export interface SearchOpts { nodes?: number; depth?: number; movetime?: number; multipv?: number; skill?: number }

export async function engineStatus(e: ServerEngine): Promise<{ available: boolean; reason?: string; processes?: number }> {
  try { return await (await fetch(`/api/engine?engine=${e}`, { cache: "no-store" })).json(); }
  catch { return { available: false, reason: "Could not reach the server." }; }
}

// The engine's best lines (best first), each with an evaluation (centipawns, side to move's view) and a variation.
export async function engineLines(e: ServerEngine, s: State, opts: SearchOpts): Promise<Line[]> {
  if (!legalMoves(s).length) return [];
  const r = await fetch("/api/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: e, fen: toFen(s), ...opts }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Engine request failed");
  const lines: Line[] = [];
  for (const l of j.lines as { cp: number; pv: string[] }[]) {
    const pv: Move[] = [];
    let cur = s;
    for (const u of l.pv) { const m = moveFromUci(cur, u); if (!m) break; pv.push(m); cur = makeMove(cur, m); }
    if (pv.length) lines.push({ move: pv[0], score: l.cp, pv });
  }
  return lines;
}
