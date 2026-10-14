import type { Move, State } from "./chess";
import { inCheck, legalMoves, makeMove } from "./chess";

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

// Static evaluation in centipawns, from the side to move's point of view.
function evaluate(s: State): number {
  let score = 0, material = 0;
  for (const p of s.board) if (p && !"pPkK".includes(p)) material += VAL[p.toLowerCase()];
  const endgame = material < 2600;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    const t = p.toLowerCase(), white = p === p.toUpperCase();
    const r = i >> 3, f = i & 7;
    const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(f - 3.5)); // 0..3
    let v = VAL[t];
    if (t === "p") v += (white ? 6 - r : r - 1) * 8 + (3.5 - Math.abs(f - 3.5)) * 3;
    else if (t === "n" || t === "b") v += centre * 9;
    else if (t === "q") v += centre * 3;
    else if (t === "r") v += (white ? r === 1 : r === 6) ? 12 : 0;
    else if (t === "k") v += endgame ? centre * 12 : -(white ? 7 - r : r) * 8 - Math.abs(f - 3.5) * 2;
    score += white ? v : -v;
  }
  return s.turn === "w" ? score : -score;
}

interface Ctx { stop: boolean; nodes: number; deadline: number }

function order(s: State, ms: Move[]): Move[] {
  const score = (m: Move) => {
    const victim = s.board[m.to];
    let v = victim ? 10 * VAL[victim.toLowerCase()] - VAL[s.board[m.from].toLowerCase()] : 0;
    if (m.promo) v += 800;
    return v;
  };
  return ms.map((m) => [score(m), m] as const).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

function tick(ctx: Ctx) {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
  return ctx.stop;
}

function quiesce(s: State, alpha: number, beta: number, ctx: Ctx): number {
  if (tick(ctx)) return 0;
  const stand = evaluate(s);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  const caps = legalMoves(s).filter((m) => s.board[m.to] || m.promo);
  for (const m of order(s, caps)) {
    const sc = -quiesce(makeMove(s, m), -beta, -alpha, ctx);
    if (ctx.stop) return 0;
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function search(s: State, depth: number, alpha: number, beta: number, ply: number, ctx: Ctx): number {
  if (tick(ctx)) return 0;
  if (s.half >= 100) return 0;
  const ms = legalMoves(s);
  if (ms.length === 0) return inCheck(s) ? -MATE + ply : 0;
  if (depth <= 0) {
    if (ply < 10 && inCheck(s)) depth = 1; // check extension: don't stop the search in the middle of a forcing line
    else return quiesce(s, alpha, beta, ctx);
  }
  for (const m of order(s, ms)) {
    const sc = -search(makeMove(s, m), depth - 1, -beta, -alpha, ply + 1, ctx);
    if (ctx.stop) return 0;
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

export interface Level { depth: number; ms: number; noise: number }
export const LEVELS: Record<string, Level> = {
  easy:   { depth: 1, ms: 300,  noise: 150 },
  medium: { depth: 2, ms: 1000, noise: 30 },
  hard:   { depth: 4, ms: 2500, noise: 0 },
};

// Iterative-deepening search from the root. Returns every legal move with its score (side to move's view).
function rootScores(s: State, depth: number, ms: number, exact: boolean): [Move, number][] {
  const root = legalMoves(s);
  const ctx: Ctx = { stop: false, nodes: 0, deadline: Date.now() + ms };
  let ordered = order(s, root);
  let scores: [Move, number][] = ordered.map((m) => [m, 0]);
  for (let d = 1; d <= depth; d++) {
    const cur: [Move, number][] = [];
    let best = -Infinity;
    for (const m of ordered) {
      const lo = exact ? -Infinity : best; // exact scores for every move when we add noise
      const sc = -search(makeMove(s, m), d - 1, -Infinity, -lo, 1, ctx);
      if (ctx.stop) break;
      cur.push([m, sc]);
      if (sc > best) best = sc;
    }
    if (ctx.stop) break;
    cur.sort((a, b) => b[1] - a[1]);
    scores = cur;
    ordered = cur.map((x) => x[0]);
  }
  return scores;
}

export function bestMove(s: State, level: Level): Move | null {
  if (!legalMoves(s).length) return null;
  const scores = rootScores(s, level.depth, level.ms, level.noise > 0);
  let pick = scores[0], pickScore = -Infinity;
  for (const e of scores) {
    const v = e[1] + (Math.random() - 0.5) * 2 * level.noise;
    if (v > pickScore) { pickScore = v; pick = e; }
  }
  return pick[0];
}

export const MATE_SCORE = MATE;

// Best move and score (centipawns, side to move's view) for game review.
export function analyze(s: State, depth: number, ms: number): { move: Move | null; score: number } {
  if (!legalMoves(s).length) return { move: null, score: inCheck(s) ? -MATE : 0 };
  const sc = rootScores(s, depth, ms, false);
  return { move: sc[0][0], score: sc[0][1] };
}

// Every legal move with an exact score (centipawns, side to move's view), best first.
export function analyzeAll(s: State, depth: number, ms: number): [Move, number][] {
  if (!legalMoves(s).length) return [];
  return rootScores(s, depth, ms, true);
}
