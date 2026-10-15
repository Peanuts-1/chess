// A small, dependency-free chess rules engine.
// Board is a 64-array in FEN order: index 0 = a8, index 63 = h1.
// Uppercase = white, lowercase = black, "" = empty.

export type Color = "w" | "b";
export interface Move { from: number; to: number; promo?: string }
export interface State {
  board: string[];
  turn: Color;
  castling: string; // e.g. "KQkq"
  ep: number;       // en-passant target square or -1
  half: number;     // half-move clock (50-move rule)
  full: number;     // full-move number
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const colorOf = (p: string): Color | null => (!p ? null : p === p.toUpperCase() ? "w" : "b");
export const sqName = (i: number) => "abcdefgh"[i & 7] + (8 - (i >> 3));
export const nameSq = (n: string) => (8 - parseInt(n[1], 10)) * 8 + (n.charCodeAt(0) - 97);

export function parseFen(fen: string): State {
  const [pos, turn, cast, ep, half, full] = fen.trim().split(/\s+/);
  const board: string[] = [];
  for (const ch of pos) {
    if (ch === "/") continue;
    if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) board.push("");
    else board.push(ch);
  }
  return {
    board,
    turn: (turn as Color) ?? "w",
    castling: !cast || cast === "-" ? "" : cast,
    ep: !ep || ep === "-" ? -1 : nameSq(ep),
    half: +(half ?? 0),
    full: +(full ?? 1),
  };
}

export function toFen(s: State): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = "", empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[r * 8 + f];
      if (!p) empty++;
      else { if (empty) { row += empty; empty = 0; } row += p; }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${s.turn} ${s.castling || "-"} ${s.ep < 0 ? "-" : sqName(s.ep)} ${s.half} ${s.full}`;
}

const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

export function isAttacked(b: string[], sq: number, by: Color): boolean {
  const r = sq >> 3, f = sq & 7;
  const at = (rr: number, ff: number) => (rr < 0 || rr > 7 || ff < 0 || ff > 7 ? "" : b[rr * 8 + ff]);
  const c = (ch: string) => (by === "w" ? ch.toUpperCase() : ch.toLowerCase());
  const pr = by === "w" ? r + 1 : r - 1;
  if (at(pr, f - 1) === c("p") || at(pr, f + 1) === c("p")) return true;
  for (const [dr, df] of KN) if (at(r + dr, f + df) === c("n")) return true;
  for (const [dr, df] of KG) if (at(r + dr, f + df) === c("k")) return true;
  const slide = (dirs: number[][], a: string, q: string) => {
    for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (p === c(a) || p === c(q)) return true; break; }
        rr += dr; ff += df;
      }
    }
    return false;
  };
  return slide(DIAG, "b", "q") || slide(ORTH, "r", "q");
}

function pseudo(s: State): Move[] {
  const b = s.board, us = s.turn, them: Color = us === "w" ? "b" : "w";
  const mv: Move[] = [];
  const add = (from: number, to: number, promo?: string) => mv.push(promo ? { from, to, promo } : { from, to });

  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || colorOf(p) !== us) continue;
    const t = p.toLowerCase(), r = i >> 3, f = i & 7;
    if (t === "p") {
      const d = us === "w" ? -1 : 1, start = us === "w" ? 6 : 1, last = us === "w" ? 0 : 7;
      const push = (to: number) => {
        if (to >> 3 === last) for (const q of "qrbn") add(i, to, q);
        else add(i, to);
      };
      const one = i + d * 8;
      if (!b[one]) {
        push(one);
        if (r === start && !b[one + d * 8]) add(i, one + d * 8);
      }
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const to = one + df;
        if (b[to] && colorOf(b[to]) === them) push(to);
        else if (to === s.ep) add(i, to);
      }
    } else if (t === "n" || t === "k") {
      for (const [dr, df] of t === "n" ? KN : KG) {
        const rr = r + dr, ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const to = rr * 8 + ff;
        if (colorOf(b[to]) !== us) add(i, to);
      }
    } else {
      const dirs = t === "b" ? DIAG : t === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const to = rr * 8 + ff, q = b[to];
          if (!q) add(i, to);
          else { if (colorOf(q) !== us) add(i, to); break; }
          rr += dr; ff += df;
        }
      }
    }
  }

  // Castling
  const row = us === "w" ? 56 : 0, K = us === "w" ? "K" : "k", Q = us === "w" ? "Q" : "q", R = us === "w" ? "R" : "r";
  if (b[row + 4] === K && !isAttacked(b, row + 4, them)) {
    if (s.castling.includes(K) && !b[row + 5] && !b[row + 6] && b[row + 7] === R &&
        !isAttacked(b, row + 5, them) && !isAttacked(b, row + 6, them)) add(row + 4, row + 6);
    if (s.castling.includes(Q) && !b[row + 3] && !b[row + 2] && !b[row + 1] && b[row] === R &&
        !isAttacked(b, row + 3, them) && !isAttacked(b, row + 2, them)) add(row + 4, row + 2);
  }
  return mv;
}

export { pseudo as pseudoMoves }; // pseudo-legal moves (may leave the king in check); used by the engine

export function makeMove(s: State, m: Move): State {
  const b = s.board.slice();
  const p = b[m.from], t = p.toLowerCase(), us = s.turn;
  let captured = b[m.to];
  let ep = -1, castling = s.castling;
  b[m.from] = "";
  if (t === "p") {
    if (m.to === s.ep && !captured && (m.from & 7) !== (m.to & 7)) { b[m.to + (us === "w" ? 8 : -8)] = ""; captured = "p"; }
    if (Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
  }
  if (t === "k" && Math.abs(m.to - m.from) === 2) {
    if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ""; }
    else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ""; }
  }
  b[m.to] = m.promo ? (us === "w" ? m.promo.toUpperCase() : m.promo.toLowerCase()) : p;
  const strip = (chars: string) => { for (const ch of chars) castling = castling.replace(ch, ""); };
  if (t === "k") strip(us === "w" ? "KQ" : "kq");
  for (const sq of [m.from, m.to]) {
    if (sq === 63) strip("K"); if (sq === 56) strip("Q");
    if (sq === 7) strip("k");  if (sq === 0) strip("q");
  }
  return { board: b, turn: us === "w" ? "b" : "w", castling, ep, half: t === "p" || captured ? 0 : s.half + 1, full: s.full + (us === "b" ? 1 : 0) };
}

export function inCheck(s: State, color: Color = s.turn): boolean {
  const k = s.board.indexOf(color === "w" ? "K" : "k");
  return k >= 0 && isAttacked(s.board, k, color === "w" ? "b" : "w");
}

export function legalMoves(s: State): Move[] {
  return pseudo(s).filter((m) => !inCheck(makeMove(s, m), s.turn));
}

export interface Status { over: boolean; result?: Color | "draw"; reason?: string; check: boolean }

export function status(s: State): Status {
  const check = inCheck(s);
  if (legalMoves(s).length === 0)
    return check ? { over: true, result: s.turn === "w" ? "b" : "w", reason: "Checkmate", check }
                 : { over: true, result: "draw", reason: "Stalemate", check };
  if (s.half >= 100) return { over: true, result: "draw", reason: "50-move rule", check };
  const rest = s.board.filter((p) => p && p.toLowerCase() !== "k").map((p) => p.toLowerCase());
  if (rest.length === 0 || (rest.length === 1 && (rest[0] === "n" || rest[0] === "b")))
    return { over: true, result: "draw", reason: "Not enough pieces to mate", check };
  return { over: false, check };
}

export function toSan(s: State, m: Move): string {
  const p = s.board[m.from], t = p.toUpperCase();
  const isCap = !!s.board[m.to] || (t === "P" && (m.from & 7) !== (m.to & 7));
  let san = "";
  if (t === "K" && Math.abs(m.to - m.from) === 2) san = m.to > m.from ? "O-O" : "O-O-O";
  else {
    if (t === "P") { if (isCap) san += "abcdefgh"[m.from & 7]; }
    else {
      san += t;
      const others = legalMoves(s).filter((o) => o.to === m.to && o.from !== m.from && s.board[o.from] === p);
      if (others.length) {
        if (!others.some((o) => (o.from & 7) === (m.from & 7))) san += "abcdefgh"[m.from & 7];
        else if (!others.some((o) => o.from >> 3 === m.from >> 3)) san += 8 - (m.from >> 3);
        else san += sqName(m.from);
      }
    }
    if (isCap) san += "x";
    san += sqName(m.to);
    if (m.promo) san += "=" + m.promo.toUpperCase();
  }
  const n = makeMove(s, m);
  if (inCheck(n)) san += legalMoves(n).length ? "+" : "#";
  return san;
}

export const moveFromUci = (s: State, uci: string): Move | undefined =>
  legalMoves(s).find((m) => sqName(m.from) + sqName(m.to) === uci.slice(0, 4) && (m.promo ?? "q") === (uci[4] ?? "q"));
