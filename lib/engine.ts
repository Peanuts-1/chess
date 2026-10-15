import type { Move, State } from "./chess";
import { inCheck, legalMoves, makeMove, pseudoMoves } from "./chess";

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;
const MATE_BOUND = MATE - 1000;
const INF = 1e9;

// ---------------------------------------------------------------- evaluation
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

// ---------------------------------------------------------------- transposition table
const PIECE_IDX: Record<string, number> = { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5, p: 6, n: 7, b: 8, r: 9, q: 10, k: 11 };
let seed = 0x2545f491;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
const Z1 = new Int32Array(12 * 64), Z2 = new Int32Array(12 * 64);
for (let i = 0; i < Z1.length; i++) { Z1[i] = rnd(); Z2[i] = rnd(); }
const ZSIDE1 = rnd(), ZSIDE2 = rnd();
const ZCAST1 = new Int32Array(16), ZCAST2 = new Int32Array(16), ZEP1 = new Int32Array(8), ZEP2 = new Int32Array(8);
for (let i = 0; i < 16; i++) { ZCAST1[i] = rnd(); ZCAST2[i] = rnd(); }
for (let i = 0; i < 8; i++) { ZEP1[i] = rnd(); ZEP2[i] = rnd(); }

let H1 = 0, H2 = 0;
function hashState(s: State) {
  let a = 0, b = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (p) { const k = PIECE_IDX[p] * 64 + i; a ^= Z1[k]; b ^= Z2[k]; }
  }
  if (s.turn === "b") { a ^= ZSIDE1; b ^= ZSIDE2; }
  let c = 0;
  if (s.castling.includes("K")) c |= 1; if (s.castling.includes("Q")) c |= 2;
  if (s.castling.includes("k")) c |= 4; if (s.castling.includes("q")) c |= 8;
  a ^= ZCAST1[c]; b ^= ZCAST2[c];
  if (s.ep >= 0) { a ^= ZEP1[s.ep & 7]; b ^= ZEP2[s.ep & 7]; }
  H1 = a; H2 = b;
}

const TT_BITS = 18, TT_MASK = (1 << TT_BITS) - 1;
const TK1 = new Int32Array(1 << TT_BITS), TK2 = new Int32Array(1 << TT_BITS);
const TS = new Int32Array(1 << TT_BITS), TM = new Int32Array(1 << TT_BITS);
const TD = new Int8Array(1 << TT_BITS), TF = new Int8Array(1 << TT_BITS);
const EXACT = 1, LOWER = 2, UPPER = 3;
const enc = (m: Move) => m.from | (m.to << 6) | ((m.promo ? "nbrq".indexOf(m.promo) + 1 : 0) << 12);

// ---------------------------------------------------------------- move ordering
const KILLERS = new Int32Array(64 * 2);

function order(s: State, ms: Move[], ttMove: number, ply: number): Move[] {
  const k1 = KILLERS[ply * 2], k2 = KILLERS[ply * 2 + 1];
  const scored = ms.map((m) => {
    const code = enc(m);
    let sc = 0;
    if (code === ttMove) sc = 1e7;
    else {
      const victim = s.board[m.to];
      const mover = s.board[m.from].toLowerCase();
      if (victim) sc = 1e6 + 10 * VAL[victim.toLowerCase()] - VAL[mover] / 10;
      else if (mover === "p" && (m.from & 7) !== (m.to & 7)) sc = 1e6 + 1000; // en passant
      else if (code === k1) sc = 9e5;
      else if (code === k2) sc = 8e5;
      if (m.promo) sc += 5e5;
    }
    return [sc, m] as const;
  });
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((x) => x[1]);
}

// ---------------------------------------------------------------- search
interface Ctx { stop: boolean; nodes: number; deadline: number }

function tick(ctx: Ctx) {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
  return ctx.stop;
}

function quiesce(s: State, alpha: number, beta: number, ctx: Ctx): number {
  if (tick(ctx)) return 0;
  const stand = evaluate(s);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  let best = stand;
  const caps = pseudoMoves(s).filter((m) => s.board[m.to] || m.promo || (s.board[m.from].toLowerCase() === "p" && (m.from & 7) !== (m.to & 7)));
  for (const m of order(s, caps, 0, 63)) {
    const ns = makeMove(s, m);
    if (inCheck(ns, s.turn)) continue;
    const sc = -quiesce(ns, -beta, -alpha, ctx);
    if (ctx.stop) return 0;
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return best;
}

function search(s: State, depth: number, alpha: number, beta: number, ply: number, ctx: Ctx): number {
  if (tick(ctx)) return 0;
  if (s.half >= 100) return 0;
  const inChk = inCheck(s);
  if (depth <= 0) {
    if (ply < 10 && inChk) depth = 1; // check extension: don't stop in the middle of a forcing line
    else return quiesce(s, alpha, beta, ctx);
  }

  const alphaOrig = alpha;
  hashState(s);
  const k1 = H1, k2 = H2, idx = (k1 >>> 0) & TT_MASK;
  let ttMove = 0;
  if (TK1[idx] === k1 && TK2[idx] === k2) {
    ttMove = TM[idx];
    if (TD[idx] >= depth) {
      let sc = TS[idx];
      if (sc > MATE_BOUND) sc -= ply; else if (sc < -MATE_BOUND) sc += ply;
      const f = TF[idx];
      if (f === EXACT) return sc;
      if (f === LOWER && sc >= beta) return sc;
      if (f === UPPER && sc <= alpha) return sc;
    }
  }

  let best = -INF, bestMv = 0, legal = 0;
  for (const m of order(s, pseudoMoves(s), ttMove, ply)) {
    const ns = makeMove(s, m);
    if (inCheck(ns, s.turn)) continue; // illegal: leaves our king attacked
    legal++;
    const sc = -search(ns, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (ctx.stop) return 0;
    if (sc > best) { best = sc; bestMv = enc(m); }
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) {
      if (!s.board[m.to] && !m.promo) { // quiet move that caused a cutoff: remember it
        const code = enc(m);
        if (KILLERS[ply * 2] !== code) { KILLERS[ply * 2 + 1] = KILLERS[ply * 2]; KILLERS[ply * 2] = code; }
      }
      break;
    }
  }
  if (legal === 0) return inChk ? -MATE + ply : 0;

  let store = best;
  if (store > MATE_BOUND) store += ply; else if (store < -MATE_BOUND) store -= ply;
  TK1[idx] = k1; TK2[idx] = k2; TS[idx] = store; TM[idx] = bestMv; TD[idx] = depth;
  TF[idx] = best <= alphaOrig ? UPPER : best >= beta ? LOWER : EXACT;
  return best;
}

export interface Level { depth: number; ms: number; noise: number }
export const LEVELS: Record<string, Level> = {
  easy:   { depth: 1, ms: 300,  noise: 150 },
  medium: { depth: 2, ms: 1000, noise: 30 },
  hard:   { depth: 4, ms: 2500, noise: 0 },
};

// Iterative-deepening search from the root. Returns every legal move with its score (side to move's view).
function rootScores(s: State, depth: number, ms: number, exact: boolean, skip?: Set<number>): [Move, number][] {
  const root = skip ? legalMoves(s).filter((m) => !skip.has(enc(m))) : legalMoves(s);
  const ctx: Ctx = { stop: false, nodes: 0, deadline: Date.now() + ms };
  KILLERS.fill(0);
  let ordered = order(s, root, 0, 63);
  let scores: [Move, number][] = ordered.map((m) => [m, 0]);
  for (let d = 1; d <= depth; d++) {
    const cur: [Move, number][] = [];
    let best = -INF;
    for (const m of ordered) {
      const lo = exact ? -INF : best; // exact scores for every move when we add noise
      const sc = -search(makeMove(s, m), d - 1, -INF, -lo, 1, ctx);
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

// ---------------------------------------------------------------- engine lines (like "MultiPV")
export interface Line { move: Move; score: number; pv: Move[] }

// Follows the best moves stored in the transposition table to build a principal variation.
function pvFrom(s: State, first: Move, maxLen: number): Move[] {
  const pv = [first];
  let cur = makeMove(s, first);
  for (let i = 1; i < maxLen; i++) {
    hashState(cur);
    const idx = (H1 >>> 0) & TT_MASK;
    if (TK1[idx] !== H1 || TK2[idx] !== H2 || !TM[idx]) break;
    const mv = legalMoves(cur).find((m) => enc(m) === TM[idx]);
    if (!mv) break;
    pv.push(mv);
    cur = makeMove(cur, mv);
  }
  return pv;
}

// The `count` best moves, each with its score (side to move's view) and a principal variation.
export function analyzeLines(s: State, depth: number, ms: number, count = 3, pvLen = 8): Line[] {
  if (!legalMoves(s).length) return [];
  const lines: Line[] = [];
  const skip = new Set<number>();
  const per = Math.max(60, Math.floor(ms / count));
  for (let k = 0; k < count; k++) {
    const sc = rootScores(s, depth, per, false, skip);
    if (!sc.length) break;
    const [m, score] = sc[0];
    lines.push({ move: m, score, pv: pvFrom(s, m, pvLen) });
    skip.add(enc(m));
  }
  return lines.sort((a, b) => b.score - a.score);
}
