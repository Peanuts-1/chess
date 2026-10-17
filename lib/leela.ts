// Browser side: asks the server (which runs lc0) for Leela's opinion. Kept as thin wrappers.
import type { Move, State } from "./chess";
import { inCheck, legalMoves } from "./chess";
import { engineLines, engineStatus } from "./engines";

const MATE = 100000;

export const leelaStatus = () => engineStatus("leela");

// Same shape as the built-in analyze(): best move and score in centipawns from the side to move's view.
export async function leelaAnalyze(s: State, nodes: number): Promise<{ move: Move | null; score: number }> {
  if (!legalMoves(s).length) return { move: null, score: inCheck(s) ? -MATE : 0 };
  const lines = await engineLines("leela", s, { nodes, multipv: 1 });
  return { move: lines[0]?.move ?? null, score: lines[0]?.score ?? 0 };
}
