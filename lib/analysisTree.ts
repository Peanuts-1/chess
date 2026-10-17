// A game tree for the analysis board: moves, variations, import from a parsed game, export to PGN.
import type { Move, State } from "./chess";
import { makeMove, parseFen, sqName, toFen, toSan } from "./chess";
import type { ParsedGame } from "./pgn";
import type { Grade } from "./review";
import { gradeOf, winPct } from "./review";

export interface TNode {
  id: number; parent: number | null; move: Move | null; san: string; state: State; children: number[];
  evalCp?: number;     // engine evaluation of this position, White's view
  bestUci?: string;    // the engine's best move here
  grade?: Grade;       // quality of the move that led here
}
export interface Tree { nodes: TNode[]; rootFen: string }

export function createTree(fen: string): Tree {
  return { nodes: [{ id: 0, parent: null, move: null, san: "", state: parseFen(fen), children: [] }], rootFen: fen };
}

const same = (a: Move | null, b: Move) => !!a && a.from === b.from && a.to === b.to && (a.promo ?? "") === (b.promo ?? "");

// Adds a move after `parent` (or finds it if it is already there) and returns the node id.
export function addMove(t: Tree, parent: number, m: Move): number {
  const p = t.nodes[parent];
  for (const c of p.children) if (same(t.nodes[c].move, m)) return c;
  const id = t.nodes.length;
  t.nodes.push({ id, parent, move: m, san: toSan(p.state, m), state: makeMove(p.state, m), children: [] });
  p.children.push(id);
  return id;
}

export function pathTo(t: Tree, id: number): number[] {
  const out: number[] = [];
  for (let n: number | null = id; n !== null; n = t.nodes[n].parent) out.push(n);
  return out.reverse();
}

export function mainEnd(t: Tree, id: number): number {
  let n = id;
  while (t.nodes[n].children.length) n = t.nodes[n].children[0];
  return n;
}

// Removes a move and everything after it. Returns the node to go back to.
export function removeNode(t: Tree, id: number): number {
  const p = t.nodes[id].parent;
  if (p === null) return 0;
  t.nodes[p].children = t.nodes[p].children.filter((c) => c !== id);
  return p;
}

export function fromGame(g: ParsedGame): Tree {
  const t = createTree(toFen(g.states[0]));
  let cur = 0;
  for (const m of g.moves) cur = addMove(t, cur, m);
  return t;
}

// PGN text of the whole tree, with variations in brackets: "1. e4 e5 (1... c5 2. Nf3) 2. Nf3".
export function toPgn(t: Tree, headers: Record<string, string> = {}): string {
  const emit = (id: number, force: boolean) => {
    const n = t.nodes[id], before = t.nodes[n.parent as number].state;
    return (before.turn === "w" ? `${before.full}. ` : force ? `${before.full}... ` : "") + n.san;
  };
  const seg = (parentId: number, force: boolean): string[] => {
    const p = t.nodes[parentId];
    if (!p.children.length) return [];
    const [main, ...vars] = p.children;
    const out = [emit(main, force)];
    for (const v of vars) out.push("(" + [emit(v, true), ...seg(v, false)].join(" ") + ")");
    out.push(...seg(main, vars.length > 0));
    return out;
  };
  const tags = { Event: "Analysis", Site: "Openfile", White: "?", Black: "?", Result: "*", ...headers } as Record<string, string>;
  const lines = Object.entries(tags).map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`);
  if (t.rootFen.split(" ").slice(0, 4).join(" ") !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -") lines.push('[SetUp "1"]', `[FEN "${t.rootFen}"]`);
  return lines.join("\n") + "\n\n" + [...seg(0, false), tags.Result].join(" ") + "\n";
}

export const uciOf = (m: Move) => sqName(m.from) + sqName(m.to) + (m.promo ?? "");

// Works out how good the move that led to node `id` was, from the engine evaluations of its parent and itself.
// Returns true if the grade changed.
export function regrade(t: Tree, id: number): boolean {
  const n = t.nodes[id];
  if (n.parent === null || !n.move) return false;
  const p = t.nodes[n.parent];
  if (p.evalCp === undefined || n.evalCp === undefined) return false;
  const mover = p.state.turn;
  const before = winPct(mover === "w" ? p.evalCp : -p.evalCp), after = winPct(mover === "w" ? n.evalCp : -n.evalCp);
  const g = gradeOf(Math.max(0, before - after), p.bestUci === uciOf(n.move));
  if (n.grade === g) return false;
  n.grade = g;
  return true;
}
