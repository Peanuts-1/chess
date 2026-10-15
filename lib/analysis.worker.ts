// Runs in a Web Worker: analyses positions off the main thread, and several workers can run in parallel.
import { analyze, analyzeLines } from "./engine";
import { parseFen, sqName } from "./chess";
import type { Move } from "./chess";

const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent) => void) | null };
const u = (m: Move) => sqName(m.from) + sqName(m.to) + (m.promo ?? "");

ctx.onmessage = (e: MessageEvent<{ kind?: "lines"; fen: string; depth: number; ms: number; count?: number }>) => {
  const { kind, fen, depth, ms, count } = e.data;
  const s = parseFen(fen);
  if (kind === "lines") {
    ctx.postMessage({ lines: analyzeLines(s, depth, ms, count ?? 3).map((l) => ({ uci: u(l.move), score: l.score, pv: l.pv.map(u) })) });
    return;
  }
  const r = analyze(s, depth, ms);
  ctx.postMessage({ uci: r.move ? u(r.move) : null, score: r.score });
};
