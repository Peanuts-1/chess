import type { Move, State } from "./chess";
import { START_FEN, legalMoves, makeMove, parseFen, toSan } from "./chess";

export interface ParsedGame { headers: Record<string, string>; states: State[]; moves: Move[]; sans: string[] }

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
  let s = t.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ");
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
  const states = [state], moves: Move[] = [], sans: string[] = [];
  for (const tok of movetext(body.join("\n")).split(/\s+/).filter(Boolean)) {
    const want = norm(tok);
    if (!want) continue;
    const mv = legalMoves(state).find((m) => norm(toSan(state, m)) === want);
    if (!mv) throw new Error(`Couldn't read the move "${tok}" after ${moves.length} half-moves. Is this a standard chess PGN?`);
    sans.push(toSan(state, mv)); moves.push(mv);
    state = makeMove(state, mv); states.push(state);
  }
  if (!moves.length) throw new Error("No moves found in this PGN.");
  return { headers, states, moves, sans };
}
