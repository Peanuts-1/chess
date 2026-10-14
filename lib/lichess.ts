// Turns a Lichess puzzle API response into a Problem we can play.
import type { Move, State } from "./chess";
import { makeMove, moveFromUci, parseFen, status, toFen } from "./chess";
import { parsePgn } from "./pgn";
import { uci } from "./puzzles";
import type { Problem } from "./tactics";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeLichess(j: any): Problem | null {
  const pz = j?.puzzle;
  if (!pz || typeof pz.id !== "string" || !Array.isArray(pz.solution) || pz.solution.length === 0) return null;
  const base = { id: pz.id as string, source: "lichess" as const, solution: pz.solution as string[], rating: Math.round(Number(pz.rating) || 1500), themes: (pz.themes as string[]) ?? [], plays: pz.plays as number | undefined };

  const plays = (s: State) => {
    let cur = s;
    for (const u of base.solution) { const m = moveFromUci(cur, u); if (!m) return null; cur = makeMove(cur, m); }
    return cur;
  };
  const mateExpected = base.themes.some((t) => t === "mate" || t.startsWith("mateIn"));

  // Some endpoints give the starting position directly.
  if (typeof pz.fen === "string") {
    try {
      const end = plays(parseFen(pz.fen));
      if (end && (!mateExpected || status(end).reason === "Checkmate")) return { ...base, fen: pz.fen, lastMove: pz.lastMove };
    } catch { /* fall through to the PGN */ }
  }

  if (typeof j?.game?.pgn !== "string") return null;
  let game;
  try { game = parsePgn(j.game.pgn); } catch { return null; }
  const n = game.moves.length;
  const ip = typeof pz.initialPly === "number" ? pz.initialPly : n - 1;
  // The PGN normally ends with the opponent's move that sets the puzzle. We accept whichever position the solution actually fits.
  for (const k of [n, ip + 1, ip, ip + 2]) {
    if (k < 1 || k > n) continue;
    const s = game.states[k];
    const end = plays(s);
    if (!end) continue;
    if (mateExpected && status(end).reason !== "Checkmate") continue;
    const lm: Move = game.moves[k - 1];
    return { ...base, fen: toFen(s), lastMove: uci(lm) };
  }
  return null;
}
