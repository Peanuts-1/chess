// Annotated PGN export (lichess-style comments: [%eval] and [%clk]).
import type { ParsedGame } from "./pgn";
import type { Grade, Review } from "./review";

const MATE = 100000;
const SUFFIX: Partial<Record<Grade, string>> = { inaccuracy: "?!", mistake: "?", miss: "?", blunder: "??" };
const LABEL: Record<Grade, string> = { best: "Best move", excellent: "Excellent", good: "Good", book: "Book move", inaccuracy: "Inaccuracy", miss: "Miss", mistake: "Mistake", blunder: "Blunder" };

const evalStr = (cp: number) => (Math.abs(cp) > 90000 ? `#${cp > 0 ? "" : "-"}${Math.ceil((MATE - Math.abs(cp) + 1) / 2)}` : (cp / 100).toFixed(2));
const clk = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function annotatedPgn(g: ParsedGame, r: Review): string {
  const lines: string[] = [];
  const h = { Event: "?", Site: "?", Date: "????.??.??", Round: "?", White: "?", Black: "?", Result: "*", ...g.headers } as Record<string, string>;
  const order = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];
  for (const k of order) lines.push(`[${k} "${String(h[k]).replace(/"/g, "'")}"]`);
  for (const [k, v] of Object.entries(h)) if (!order.includes(k)) lines.push(`[${k} "${String(v).replace(/"/g, "'")}"]`);
  lines.push('[Annotator "Openfile"]', "");

  const out: string[] = [];
  r.plies.forEach((p, i) => {
    const st = g.states[i];
    out.push(st.turn === "w" ? `${st.full}.` : `${st.full}...`);
    out.push(p.san + (SUFFIX[p.grade] ?? ""));
    const parts = [`[%eval ${evalStr(r.cp[i + 1])}]`];
    if (g.clocks[i] != null) parts.push(`[%clk ${clk(g.clocks[i] as number)}]`);
    const text = [p.grade === "best" || p.grade === "excellent" || p.grade === "good" ? "" : `${LABEL[p.grade]}.`, p.note, p.grade !== "best" && p.grade !== "book" && p.bestSan ? `Best was ${p.bestSan}.` : ""].filter(Boolean).join(" ");
    out.push(`{ ${parts.join(" ")}${text ? " " + text : ""} }`);
  });
  // wrap between moves only, never inside a comment
  const chunks: string[] = [];
  for (let k = 0; k < out.length; k += 4) chunks.push(out.slice(k, k + 4).join(" "));
  chunks.push(h.Result || "*");
  const body: string[] = []; let cur = "";
  for (const c of chunks) { if (cur && cur.length + c.length + 1 > 90) { body.push(cur); cur = c; } else cur = cur ? cur + " " + c : c; }
  if (cur) body.push(cur);
  return lines.join("\n") + body.join("\n") + "\n";
}
