import type { Move, State } from "./chess";
import { inCheck, legalMoves, makeMove, sqName } from "./chess";

export type Theme = "mate1" | "mate2" | "tactic";
export interface Puzzle {
  id: number;
  fen: string;
  theme: Theme;
  solution: string[];   // main line in UCI, starting with the solver's move
  accepted?: string[];  // tactic puzzles: every first move that is good enough
}

export const THEMES: Record<Theme, { label: string; blurb: string }> = {
  mate1: { label: "Mate in 1", blurb: "Find the move that checkmates." },
  mate2: { label: "Mate in 2", blurb: "Checkmate in two moves, however Black defends." },
  tactic: { label: "Win material", blurb: "Find the move that wins material or a decisive advantage." },
};

export const uci = (m: Move) => sqName(m.from) + sqName(m.to) + (m.promo ?? "");

// Does move m (by the side to move) force checkmate within n of its own moves?
export function isMatingMove(s: State, m: Move, n: number): boolean {
  const ns = makeMove(s, m);
  const replies = legalMoves(ns);
  if (replies.length === 0) return inCheck(ns);
  if (n <= 1) return false;
  return replies.every((r) => mateIn(makeMove(ns, r), n - 1));
}

export function mateIn(s: State, n: number): boolean {
  return legalMoves(s).some((m) => isMatingMove(s, m, n));
}

export function findMating(s: State, n: number): Move | null {
  return legalMoves(s).find((m) => isMatingMove(s, m, n)) ?? null;
}
