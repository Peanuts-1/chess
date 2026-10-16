// A compact opening book: names for common openings, matched by position (so transpositions are recognised).
// Moves are SAN without move numbers. Positions along each line count as "book" (theory) moves.
import type { State } from "./chess";
import { legalMoves, makeMove, parseFen, START_FEN, toSan } from "./chess";

const norm = (s: string) => s.replace(/[+#!?=x]/g, "");

export const OPENINGS: [string, string][] = [
  // ---- 1.e4 e5
  ["King's Pawn Game", "e4"], ["Open Game", "e4 e5"],
  ["King's Gambit", "e4 e5 f4"], ["King's Gambit Accepted", "e4 e5 f4 exf4"], ["King's Gambit Declined", "e4 e5 f4 Bc5"],
  ["Vienna Game", "e4 e5 Nc3"], ["Bishop's Opening", "e4 e5 Bc4"], ["Danish Gambit", "e4 e5 d4 exd4 c3"], ["Centre Game", "e4 e5 d4 exd4 Qxd4"],
  ["Latvian Gambit", "e4 e5 Nf3 f5"], ["Petrov's Defence", "e4 e5 Nf3 Nf6"], ["Philidor Defence", "e4 e5 Nf3 d6"],
  ["Scotch Game", "e4 e5 Nf3 Nc6 d4"], ["Scotch Game: Classical Variation", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5"], ["Scotch Gambit", "e4 e5 Nf3 Nc6 d4 exd4 Bc4"],
  ["Three Knights Game", "e4 e5 Nf3 Nc6 Nc3"], ["Four Knights Game", "e4 e5 Nf3 Nc6 Nc3 Nf6"], ["Four Knights Game: Spanish Variation", "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5"],
  ["Italian Game", "e4 e5 Nf3 Nc6 Bc4"], ["Italian Game: Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5"],
  ["Italian Game: Classical Variation", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3"], ["Italian Game: Giuoco Pianissimo", "e4 e5 Nf3 Nc6 Bc4 Bc5 d3"],
  ["Evans Gambit", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4"], ["Italian Game: Two Knights Defence", "e4 e5 Nf3 Nc6 Bc4 Nf6"],
  ["Fried Liver Attack", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7"],
  ["Ruy Lopez", "e4 e5 Nf3 Nc6 Bb5"], ["Ruy Lopez: Morphy Defence", "e4 e5 Nf3 Nc6 Bb5 a6"], ["Ruy Lopez: Exchange Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6"],
  ["Ruy Lopez: Closed", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7"], ["Ruy Lopez: Open", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4"],
  ["Ruy Lopez: Berlin Defence", "e4 e5 Nf3 Nc6 Bb5 Nf6"], ["Ruy Lopez: Steinitz Defence", "e4 e5 Nf3 Nc6 Bb5 d6"], ["Ruy Lopez: Classical Defence", "e4 e5 Nf3 Nc6 Bb5 Bc5"],
  // ---- Sicilian
  ["Sicilian Defence", "e4 c5"], ["Sicilian Defence: Alapin Variation", "e4 c5 c3"], ["Sicilian Defence: Closed", "e4 c5 Nc3"],
  ["Sicilian Defence: Smith-Morra Gambit", "e4 c5 d4 cxd4 c3"], ["Sicilian Defence: Open", "e4 c5 Nf3 d6 d4 cxd4 Nxd4"],
  ["Sicilian Defence: Najdorf Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"], ["Sicilian Defence: Dragon Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6"],
  ["Sicilian Defence: Scheveningen Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6"], ["Sicilian Defence: Classical Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6"],
  ["Sicilian Defence: Accelerated Dragon", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6"], ["Sicilian Defence: Sveshnikov Variation", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5"],
  ["Sicilian Defence: Taimanov Variation", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6"], ["Sicilian Defence: Kan Variation", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6"],
  // ---- French, Caro-Kann and other defences to 1.e4
  ["French Defence", "e4 e6"], ["French Defence: Advance Variation", "e4 e6 d4 d5 e5"], ["French Defence: Exchange Variation", "e4 e6 d4 d5 exd5 exd5"],
  ["French Defence: Tarrasch Variation", "e4 e6 d4 d5 Nd2"], ["French Defence: Winawer Variation", "e4 e6 d4 d5 Nc3 Bb4"],
  ["French Defence: Classical Variation", "e4 e6 d4 d5 Nc3 Nf6"], ["French Defence: Rubinstein Variation", "e4 e6 d4 d5 Nc3 dxe4"],
  ["Caro-Kann Defence", "e4 c6"], ["Caro-Kann Defence: Advance Variation", "e4 c6 d4 d5 e5"], ["Caro-Kann Defence: Exchange Variation", "e4 c6 d4 d5 exd5 cxd5"],
  ["Caro-Kann Defence: Panov Attack", "e4 c6 d4 d5 exd5 cxd5 c4"], ["Caro-Kann Defence: Classical Variation", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5"],
  ["Scandinavian Defence", "e4 d5"], ["Scandinavian Defence: Main Line", "e4 d5 exd5 Qxd5"], ["Scandinavian Defence: Modern Variation", "e4 d5 exd5 Nf6"],
  ["Pirc Defence", "e4 d6 d4 Nf6 Nc3 g6"], ["Alekhine's Defence", "e4 Nf6"], ["Modern Defence", "e4 g6"], ["Owen's Defence", "e4 b6"], ["Nimzowitsch Defence", "e4 Nc6"],
  // ---- 1.d4
  ["Queen's Pawn Game", "d4"], ["Queen's Pawn Game: Closed", "d4 d5"], ["London System", "d4 d5 Bf4"], ["London System: Indian setup", "d4 Nf6 Bf4"],
  ["Colle System", "d4 d5 Nf3 Nf6 e3"], ["Queen's Gambit", "d4 d5 c4"], ["Queen's Gambit Accepted", "d4 d5 c4 dxc4"], ["Queen's Gambit Declined", "d4 d5 c4 e6"],
  ["Slav Defence", "d4 d5 c4 c6"], ["Semi-Slav Defence", "d4 d5 c4 e6 Nc3 Nf6 Nf3 c6"], ["Tarrasch Defence", "d4 d5 c4 e6 Nc3 c5"],
  ["Albin Countergambit", "d4 d5 c4 e5"], ["Chigorin Defence", "d4 d5 c4 Nc6"],
  ["Indian Defence", "d4 Nf6"], ["King's Indian Defence", "d4 Nf6 c4 g6"], ["King's Indian Defence: Classical Variation", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2"],
  ["Grünfeld Defence", "d4 Nf6 c4 g6 Nc3 d5"], ["Nimzo-Indian Defence", "d4 Nf6 c4 e6 Nc3 Bb4"], ["Queen's Indian Defence", "d4 Nf6 c4 e6 Nf3 b6"],
  ["Bogo-Indian Defence", "d4 Nf6 c4 e6 Nf3 Bb4"], ["Catalan Opening", "d4 Nf6 c4 e6 g3"], ["Benoni Defence", "d4 Nf6 c4 c5 d5"], ["Benko Gambit", "d4 Nf6 c4 c5 d5 b5"],
  ["Old Indian Defence", "d4 Nf6 c4 d6"], ["Budapest Gambit", "d4 Nf6 c4 e5"], ["Trompowsky Attack", "d4 Nf6 Bg5"], ["Dutch Defence", "d4 f5"], ["Englund Gambit", "d4 e5"],
  // ---- flank openings
  ["English Opening", "c4"], ["English Opening: Symmetrical Variation", "c4 c5"], ["English Opening: Reversed Sicilian", "c4 e5"], ["English Opening: Anglo-Indian Defence", "c4 Nf6"],
  ["Zukertort Opening", "Nf3"], ["Réti Opening", "Nf3 d5 c4"], ["Bird's Opening", "f4"], ["Larsen's Opening", "b3"], ["Polish Opening", "b4"],
  ["Grob Opening", "g4"], ["Hungarian Opening", "g3"], ["Dunst Opening", "Nc3"], ["Van't Kruijs Opening", "e3"], ["Mieses Opening", "d3"],
];

const key = (s: State) => `${s.board.map((p) => p || ".").join("")} ${s.turn} ${s.castling} ${s.ep}`;

let named: Map<string, string> | null = null;
let theory: Set<string> | null = null;

function build() {
  named = new Map(); theory = new Set();
  for (const [name, line] of OPENINGS) {
    let s = parseFen(START_FEN);
    for (const san of line.split(" ")) {
      const m = legalMoves(s).find((x) => norm(toSan(s, x)) === norm(san));
      if (!m) { s = null as unknown as State; break; }
      s = makeMove(s, m);
      theory.add(key(s));
    }
    if (s) named.set(key(s), name); // a later, more specific entry for the same position wins
  }
}

export interface BookInfo { book: boolean[]; names: (string | null)[] } // index = ply (the position after that move)

// For each move of the game: is it still opening theory, and what is the opening called by then?
export function detectOpening(states: State[], maxPlies = 30): BookInfo {
  if (!named) build();
  const n = states.length - 1;
  const book: boolean[] = new Array(n).fill(false), names: (string | null)[] = new Array(n).fill(null);
  let inBook = true, last: string | null = null;
  for (let i = 0; i < n; i++) {
    const k = key(states[i + 1]);
    if (inBook && i < maxPlies && theory!.has(k)) { book[i] = true; const nm = named!.get(k); if (nm) last = nm; }
    else inBook = false;
    names[i] = last;
  }
  return { book, names };
}
