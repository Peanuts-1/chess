import type { Move, State } from "./chess";
import { START_FEN, legalMoves, makeMove, parseFen, toSan } from "./chess";

export interface ParsedGame { headers: Record<string, string>; states: State[]; moves: Move[]; sans: string[]; clocks: (number | null)[] }

// Split a file containing several PGN games into separate game strings.
export function splitGames(text: string): string[] {
  const games: string[] = [];
  let cur: string[] = [], hasMoves = false;
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const t = line.trim();
    if (/^\[\w+\s+"/.test(t)) {
      if (hasMoves) { games.push(cur.join("\n")); cur = []; hasMoves = false; }
      cur.push(line);
    } else { if (t) hasMoves = true; cur.push(line); }
  }
  if (cur.join("").trim()) games.push(cur.join("\n"));
  return games.map((g) => g.trim()).filter((g) => /[a-hKQRBNO]/.test(g.replace(/\[[^\]]*\]/g, "")));
}

const norm = (s: string) => s.replace(/[+#!?=x]/g, "").replace(/0/g, "O");

function movetext(t: string) {
  // Clock comments like {[%clk 0:09:58.9]} become "@@seconds" tokens; every other comment is dropped.
  let s = t.replace(/\{([^}]*)\}/g, (_m, c: string) => {
    const k = c.match(/\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/);
    return k ? ` @@${Math.round((+k[1] * 3600 + +k[2] * 60 + parseFloat(k[3])) * 10)} ` : " "; // tenths of a second, so no dot confuses the move-number cleanup
  }).replace(/;[^\n]*/g, " ");
  let prev: string;
  do { prev = s; s = s.replace(/\([^()]*\)/g, " "); } while (s !== prev); // drop variations
  return s.replace(/\$\d+/g, " ").replace(/\d+\.(\.\.)?/g, " ")
    .replace(/(^|\s)(1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/g, " ");
}

export function parsePgn(text: string): ParsedGame {
  const headers: Record<string, string> = {};
  const body: string[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const m = line.trim().match(/^\[(\w+)\s+"(.*)"\]$/);
    if (m) headers[m[1]] = m[2]; else body.push(line);
  }
  let state = parseFen(headers.FEN || START_FEN);
  const states = [state], moves: Move[] = [], sans: string[] = [], clocks: (number | null)[] = [];
  for (const tok of movetext(body.join("\n")).split(/\s+/).filter(Boolean)) {
    if (tok.startsWith("@@")) { if (moves.length) clocks[moves.length - 1] = parseInt(tok.slice(2), 10) / 10; continue; }
    const want = norm(tok);
    if (!want) continue;
    const mv = legalMoves(state).find((m) => norm(toSan(state, m)) === want);
    if (!mv) throw new Error(`Couldn't read the move "${tok}" after ${moves.length} half-moves. Is this a standard chess PGN?`);
    sans.push(toSan(state, mv)); moves.push(mv); clocks.push(null);
    state = makeMove(state, mv); states.push(state);
  }
  if (!moves.length) throw new Error("No moves found in this PGN.");
  return { headers, states, moves, sans, clocks };
}

// "600+5" -> 10 minutes with a 5 second increment.
export function timeControl(headers: Record<string, string>): { base: number; inc: number } | null {
  const m = (headers.TimeControl ?? "").match(/^(\d+)(?:\+(\d+))?$/);
  return m ? { base: +m[1], inc: +(m[2] ?? 0) } : null;
}

// Seconds spent on each move, when the PGN carries clock times.
export function moveTimes(g: ParsedGame): (number | null)[] {
  const tc = timeControl(g.headers);
  return g.moves.map((_, i) => {
    const cur = g.clocks[i];
    if (cur == null) return null;
    const prev = i >= 2 ? g.clocks[i - 2] : tc ? tc.base : null;
    return prev == null ? null : Math.max(0, prev - cur + (tc?.inc ?? 0));
  });
}

// Time left on a player's clock after the given number of half-moves.
export function clockAt(g: ParsedGame, color: "w" | "b", ply: number): number | null {
  for (let j = Math.min(ply, g.moves.length) - 1; j >= 0; j--) if (g.states[j].turn === color && g.clocks[j] != null) return g.clocks[j];
  return timeControl(g.headers)?.base ?? null;
}
