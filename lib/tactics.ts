// Shared logic for the tactics trainer: problems, ratings (Glicko), move judging, tags.
import type { Move, State } from "./chess";
import { makeMove, status } from "./chess";
import { isMatingMove, uci } from "./puzzles";
import { PUZZLES } from "./puzzle-data";

export interface Problem {
  id: string;
  source: "lichess" | "local";
  fen: string;               // position the solver sees, solver to move
  solution: string[];        // UCI: solver, reply, solver, ...
  rating: number;
  themes: string[];
  plays?: number;
  lastMove?: string;         // opponent's last move (UCI), for highlighting
  accepted?: string[];       // local "win material": every good first move
  mateIn?: number;           // local mate puzzles: any forced mate is accepted
}

// ---------- Glicko-1 (the family of rating systems ChessTempo uses) ----------
const Q = Math.LN10 / 400;
const gf = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
export const START_RATING = 1500, START_RD = 250, MIN_RD = 45, PROBLEM_RD = 60;

// score: 1 = solved, 0 = failed (0.5..1 for slow solves in Blitz mode)
export function glicko(r: number, rd: number, rj: number, rdj: number, score: number) {
  const g = gf(rdj);
  const E = 1 / (1 + Math.pow(10, (-g * (r - rj)) / 400));
  const d2 = 1 / (Q * Q * g * g * E * (1 - E));
  const denom = 1 / (rd * rd) + 1 / d2;
  return { rating: r + (Q / denom) * g * (score - E), rd: Math.max(MIN_RD, Math.sqrt(1 / denom)) };
}

// Blitz mode: a solve slower than this reference time earns less than a full point.
export const refTimeMs = (rating: number, solverMoves: number) =>
  (10 + 6 * solverMoves + (Math.max(0, rating - 800) / 100) * 2) * 1000;

export function difficultyFor(rating: number): "easiest" | "easier" | "normal" | "harder" | "hardest" {
  return rating < 1000 ? "easiest" : rating < 1300 ? "easier" : rating < 1700 ? "normal" : rating < 2000 ? "harder" : "hardest";
}

// ---------- judging a move ----------
export function judgeMove(p: Problem, st: State, ply: number, m: Move): { ok: boolean; done: boolean; ns: State } {
  const ns = makeMove(st, m);
  const s = status(ns);
  const mate = s.reason === "Checkmate";
  let ok = uci(m) === p.solution[ply] || mate; // any checkmate is accepted, as on Lichess
  if (!ok && p.source === "local") {
    if (p.mateIn) ok = isMatingMove(st, m, p.mateIn - Math.floor(ply / 2));
    else ok = (p.accepted ?? p.solution).includes(uci(m));
  }
  const done = ok && (s.over || ply + 1 >= p.solution.length || (p.source === "local" && !p.mateIn));
  return { ok, done, ns };
}

// ---------- tags ----------
const HIDDEN = new Set(["short", "long", "veryLong", "oneMove", "master", "masterVsMaster", "superGM", "crushing", "advantage", "equality"]);
const SPECIAL: Record<string, string> = {
  mateIn1: "Mate in 1", mateIn2: "Mate in 2", mateIn3: "Mate in 3", mateIn4: "Mate in 4", mateIn5: "Mate in 5",
  attackingF2F7: "Attacking f2/f7", xRayAttack: "X-ray attack", winMaterial: "Win material",
};
export const tagLabel = (t: string) => SPECIAL[t] ?? t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
export const visibleTags = (themes: string[]) => themes.filter((t) => !HIDDEN.has(t));

export const ANGLES: [string, string][] = [
  ["", "Any problem"], ["mateIn1", "Mate in 1"], ["mateIn2", "Mate in 2"], ["mateIn3", "Mate in 3"],
  ["fork", "Fork"], ["pin", "Pin"], ["skewer", "Skewer"], ["discoveredAttack", "Discovered attack"],
  ["backRankMate", "Back rank mate"], ["hangingPiece", "Hanging piece"], ["deflection", "Deflection"],
  ["attraction", "Attraction"], ["sacrifice", "Sacrifice"], ["trappedPiece", "Trapped piece"],
  ["promotion", "Promotion"], ["xRayAttack", "X-ray attack"], ["quietMove", "Quiet move"],
  ["doubleCheck", "Double check"], ["smotheredMate", "Smothered mate"],
  ["opening", "Opening"], ["middlegame", "Middlegame"], ["endgame", "Endgame"],
];

// ---------- the offline set, with estimated ratings ----------
export function localProblems(): Problem[] {
  return PUZZLES.map((p) => {
    const base = p.theme === "mate1" ? 900 : p.theme === "mate2" ? 1350 : 1250;
    return {
      id: `L${p.id}`, source: "local" as const, fen: p.fen, solution: p.solution,
      rating: base + (((p.id * 37) % 11) - 5) * 30,
      themes: p.theme === "mate1" ? ["mate", "mateIn1"] : p.theme === "mate2" ? ["mate", "mateIn2"] : ["winMaterial"],
      accepted: p.accepted, mateIn: p.theme === "mate1" ? 1 : p.theme === "mate2" ? 2 : undefined,
    };
  });
}
