import type { Color, Move, State } from "./chess";
import { legalMoves, makeMove, status, toSan } from "./chess";
import { analyze } from "./engine";
import type { ParsedGame } from "./pgn";
import { detectOpening } from "./openings";
import type { BookInfo } from "./openings";

export type Grade = "best" | "excellent" | "good" | "book" | "inaccuracy" | "miss" | "mistake" | "blunder";
export type Tag = "hung" | "allowed-mate" | "missed-win" | "missed-mate" | "gave-away" | "miss" | "other";
export type Phase = "Opening" | "Middlegame" | "Endgame";
export interface PlyReview { san: string; mover: Color; grade: Grade; loss: number; cpl: number; best: Move | null; bestSan: string; note: string; tag: Tag }
export interface PhaseStat { phase: Phase; w: number | null; b: number | null }
export interface Review {
  plies: PlyReview[];
  winPct: number[];                         // White's winning chances (0-100) for every position
  cp: number[];                             // evaluation in centipawns from White's view (huge values mean mate)
  accuracy: Record<Color, number>;
  counts: Record<Color, Record<Grade, number>>;
  acpl: Record<Color, number>;              // average centipawn loss
  phases: PhaseStat[];                      // accuracy in each phase of the game
  opening: BookInfo;                        // theory moves and opening names
}
export interface Tip { title: string; text: string }

// Each review runs a fast first pass (shown straight away) and, unless "quick", a deeper pass that refines it.
export const REVIEW_LEVELS = {
  quick:    { depth: 4, ms: 150 },
  standard: { depth: 5, ms: 500 },
  deep:     { depth: 6, ms: 2000 },
};
export const FIRST_PASS = REVIEW_LEVELS.quick;

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

export const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1);
const same = (a: Move | null, b: Move) => !!a && a.from === b.from && a.to === b.to && (a.promo ?? "") === (b.promo ?? "");

function gradeOf(loss: number, isBest: boolean): Grade {
  if (isBest || loss < 0.5) return "best";
  if (loss < 2) return "excellent";
  if (loss < 6) return "good";
  if (loss < 12) return "inaccuracy";
  if (loss < 22) return "mistake";
  return "blunder";
}

function explain(s: State, mv: Move, after: State, best: Move | null, reply: Move | null, wb: number, wa: number): { note: string; tag: Tag } {
  const bestSan = best ? toSan(s, best) : "";
  if (best && status(makeMove(s, best)).reason === "Checkmate") return { note: `You missed checkmate with ${bestSan}.`, tag: "missed-mate" };
  if (reply) {
    const replySan = toSan(after, reply);
    const afterReply = makeMove(after, reply);
    if (status(afterReply).reason === "Checkmate") return { note: `This allows ${replySan}, which is checkmate.`, tag: "allowed-mate" };
    const victim = after.board[reply.to];
    if (victim) {
      const attacker = after.board[reply.from].toLowerCase();
      const recapture = legalMoves(afterReply).some((m) => m.to === reply.to);
      const gain = VAL[victim.toLowerCase()] - (recapture ? VAL[attacker] : 0);
      if (gain >= 2) return { note: `This leaves your ${NAME[victim.toLowerCase()]} open to capture: ${replySan} wins material.`, tag: "hung" };
    }
  }
  const taken = best ? s.board[best.to] : "";
  if (best && taken && VAL[taken.toLowerCase()] >= 3 && !s.board[mv.to])
    return { note: `You missed a chance to win a ${NAME[taken.toLowerCase()]} with ${bestSan}.`, tag: "missed-win" };
  if (wb >= 65 && wa <= 55) return { note: "You were doing well here, and this move gives the advantage away.", tag: "gave-away" };
  return { note: best ? `${bestSan} kept more of your position.` : "", tag: "other" };
}

export interface PosResult { move: Move | null; score: number }
export type Runner = (s: State, index: number) => Promise<PosResult>;

// Analyses every position of the game. `concurrency` positions are searched at the same time
// (one per worker thread), so a game is reviewed several times faster on a multi-core machine.
export async function analyzePositions(
  g: ParsedGame,
  run: Runner,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
  cancelled?: () => boolean,
  maxPlies = 200,
): Promise<PosResult[] | null> {
  const n = Math.min(g.moves.length, maxPlies);
  const res: PosResult[] = new Array(n + 1);
  let next = 0, done = 0;
  const lane = async () => {
    for (;;) {
      if (cancelled?.()) return;
      const i = next++;
      if (i > n) return;
      res[i] = await run(g.states[i], i);
      onProgress?.(++done, n + 1);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, lane));
  return cancelled?.() ? null : res;
}

const clampCp = (cp: number) => Math.max(-1500, Math.min(1500, cp));
const moveAcc = (loss: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
const GRADE_LIST: Grade[] = ["best", "excellent", "good", "book", "inaccuracy", "miss", "mistake", "blunder"];

// Opening until move 10, endgame once little material is left, middlegame in between.
function phaseOf(ply: number, s: State): Phase {
  let mat = 0;
  for (const p of s.board) if (p && !"pPkK".includes(p)) mat += VAL[p.toLowerCase()];
  if (ply < 20) return "Opening";
  return mat <= 26 ? "Endgame" : "Middlegame";
}

// Turns the raw per-position results into the full review (grades, accuracy, notes).
export function buildReview(g: ParsedGame, res: PosResult[]): Review {
  const plies: PlyReview[] = [];
  const opening = detectOpening(g.states);
  const winPcts: number[] = res.map((r, i) => (g.states[i].turn === "w" ? winPct(r.score) : 100 - winPct(r.score)));
  for (let i = 0; i < res.length - 1; i++) {
    const s = g.states[i], mv = g.moves[i], mover = s.turn;
    const wb = winPct(res[i].score), wa = winPct(-res[i + 1].score); // mover's winning chances before / after
    let loss = Math.max(0, wb - wa);
    let cpl = Math.max(0, Math.min(1000, clampCp(res[i].score) - clampCp(-res[i + 1].score)));
    const forced = legalMoves(s).length === 1;
    let grade = gradeOf(loss, forced || same(res[i].move, mv));
    const prev = plies[i - 1];
    const prevBad = !!prev && (prev.grade === "mistake" || prev.grade === "blunder" || prev.grade === "miss");
    if (opening.book[i]) { grade = "book"; loss = 0; cpl = 0; } // opening theory is never an error
    else if (prevBad && wb >= 62 && wa >= 40 && (grade === "inaccuracy" || grade === "mistake" || grade === "blunder")) grade = "miss";
    const bad = grade === "inaccuracy" || grade === "mistake" || grade === "blunder" || grade === "miss";
    let ex = bad ? explain(s, mv, g.states[i + 1], res[i].move, res[i + 1].move, wb, wa) : { note: "", tag: "other" as Tag };
    if (grade === "miss") ex = { note: ex.tag === "other" || ex.tag === "gave-away" ? "Your opponent's last move was a mistake, but this does not make the most of it." : ex.note, tag: ex.tag === "other" || ex.tag === "gave-away" ? "miss" : ex.tag };
    plies.push({ san: g.sans[i], mover, grade, loss, cpl, best: res[i].move, bestSan: res[i].move ? toSan(s, res[i].move!) : "", ...ex });
  }
  const accuracy = { w: 100, b: 100 } as Record<Color, number>;
  const acpl = { w: 0, b: 0 } as Record<Color, number>;
  const counts = {} as Review["counts"];
  for (const c of ["w", "b"] as Color[]) {
    const mine = plies.filter((p) => p.mover === c);
    counts[c] = Object.fromEntries(GRADE_LIST.map((x) => [x, 0])) as Record<Grade, number>;
    for (const p of mine) counts[c][p.grade]++;
    if (mine.length) {
      accuracy[c] = mine.reduce((a, p) => a + moveAcc(p.loss), 0) / mine.length;
      acpl[c] = mine.reduce((a, p) => a + p.cpl, 0) / mine.length;
    }
  }
  const phases: PhaseStat[] = (["Opening", "Middlegame", "Endgame"] as Phase[]).map((phase) => {
    const out: PhaseStat = { phase, w: null, b: null };
    for (const c of ["w", "b"] as Color[]) {
      const xs = plies.filter((p, i) => p.mover === c && phaseOf(i, g.states[i]) === phase);
      if (xs.length) out[c] = xs.reduce((a, p) => a + moveAcc(p.loss), 0) / xs.length;
    }
    return out;
  });
  const cp = res.map((r, i) => (g.states[i].turn === "w" ? r.score : -r.score));
  return { plies, winPct: winPcts, cp, accuracy, counts, acpl, phases, opening };
}

// Simple one-thread version (used with Leela, which handles one request at a time, and in tests).
export async function reviewGame(
  g: ParsedGame,
  opt: { depth: number; ms: number; analyzer?: (s: State) => Promise<{ move: Move | null; score: number }> },
  onProgress?: (done: number, total: number) => void,
  cancelled?: () => boolean,
  maxPlies = 200,
): Promise<Review> {
  const run: Runner = opt.analyzer ?? (async (s) => { await new Promise((r) => setTimeout(r, 0)); return analyze(s, opt.depth, opt.ms); });
  const res = await analyzePositions(g, run, 1, onProgress, cancelled, maxPlies);
  return buildReview(g, res ?? []);
}

export const isBad = (g: Grade) => g === "inaccuracy" || g === "mistake" || g === "blunder" || g === "miss";

export function keyMoments(r: Review, side: Color, count = 3): number[] {
  return r.plies.map((p, i) => ({ p, i })).filter((x) => x.p.mover === side && isBad(x.p.grade))
    .sort((a, b) => b.p.loss - a.p.loss).slice(0, count).map((x) => x.i).sort((a, b) => a - b);
}

export function tipsFor(r: Review, side: Color): Tip[] {
  const mine = r.plies.map((p, i) => ({ p, i })).filter((x) => x.p.mover === side);
  const bad = mine.filter((x) => isBad(x.p.grade));
  const tagN = (t: Tag) => bad.filter((x) => x.p.tag === t).length;
  const phase = (lo: number, hi: number) => bad.filter((x) => x.i >= lo && x.i < hi).length;
  const blunders = mine.filter((x) => x.p.grade === "blunder").length;
  const tips: Tip[] = [];
  if (tagN("hung") > 0)
    tips.push({ title: "Check what your move leaves undefended", text: `A piece was left open to capture ${tagN("hung")} time(s). Before every move, ask: is the piece I am moving, or any piece I leave behind, now attacked and unprotected?` });
  if (tagN("allowed-mate") > 0)
    tips.push({ title: "Watch your king", text: "A move allowed checkmate. Castle early, keep the pawns in front of your king, and before moving, look at every check your opponent could give." });
  if (tagN("missed-win") + tagN("missed-mate") > 0)
    tips.push({ title: "Look for captures and checks first", text: "There were free pieces or a mate you did not see. On each move, scan every capture and check for both sides before choosing a quiet move. The puzzles on the Learn page train exactly this." });
  if (tagN("miss") > 0)
    tips.push({ title: "Punish your opponent's mistakes", text: "After an opponent error you did not make the most of it. When the last move looks odd, stop and ask what changed: any new checks, captures or loose pieces?" });
  if (tagN("gave-away") > 0)
    tips.push({ title: "Convert your advantage", text: "You had a good position and let it slip. When ahead, trade pieces, keep your king safe, and avoid unnecessary risks." });
  if (phase(0, 20) >= 2)
    tips.push({ title: "Tighten your opening", text: "Most of the damage came in the first ten moves. Stick to the principles: fight for the centre, develop knights and bishops, castle, and do not move the same piece twice. See the Openings lessons." });
  else if (phase(60, 999) >= 2)
    tips.push({ title: "Practise endgames", text: "Mistakes piled up late in the game. Work on king-and-pawn endings and on activating your king once queens come off." });
  if (blunders >= 2 && tips.length < 3)
    tips.push({ title: "Slow down on critical moves", text: "You blundered more than once. When the position gets sharp, take an extra moment for a blunder check before you move." });
  if (!tips.length)
    tips.push(bad.length === 0
      ? { title: "A clean game", text: "No real mistakes were found at this analysis depth. Try the Hard engine on the Play page, or re-run the review at Deeper depth." }
      : { title: "Small improvements", text: "Your play was mostly sound. The flagged inaccuracies are worth stepping through: for each, compare your move with the suggested one." });
  return tips.slice(0, 4);
}
