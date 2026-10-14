// Browser side: asks the server route (which runs lc0) for Leela's opinion.
import type { Move, State } from "./chess";
import { inCheck, legalMoves, moveFromUci, toFen } from "./chess";

const MATE = 100000;

export async function leelaStatus(): Promise<{ available: boolean; reason?: string }> {
  try { return await (await fetch("/api/lc0", { cache: "no-store" })).json(); }
  catch { return { available: false, reason: "Could not reach the server." }; }
}

// Same shape as the built-in analyze(): best move and score in centipawns from the side to move's view.
export async function leelaAnalyze(s: State, nodes: number): Promise<{ move: Move | null; score: number }> {
  if (!legalMoves(s).length) return { move: null, score: inCheck(s) ? -MATE : 0 };
  const r = await fetch("/api/lc0", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fen: toFen(s), nodes }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Leela request failed");
  return { move: j.bestmove ? moveFromUci(s, j.bestmove) ?? null : null, score: j.cp };
}
