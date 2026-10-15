// Browser-only: a small pool of Web Workers that analyse positions in parallel.
import type { Move, State } from "./chess";
import { makeMove, moveFromUci, toFen } from "./chess";
import type { Line } from "./engine";

type PosResult = { move: Move | null; score: number };
interface Job {
  kind: "pos" | "lines"; state: State; depth: number; ms: number; count: number;
  resolve: (r: any) => void; reject: (e: Error) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export class AnalysisPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private busy = new Map<Worker, Job>();
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL("./analysis.worker.ts", import.meta.url));
      w.onmessage = (e: MessageEvent) => {
        const job = this.busy.get(w);
        this.busy.delete(w); this.idle.push(w);
        if (job) {
          if (job.kind === "lines") {
            const lines: Line[] = [];
            for (const l of e.data.lines as { uci: string; score: number; pv: string[] }[]) {
              const first = moveFromUci(job.state, l.uci);
              if (!first) continue;
              const pv: Move[] = []; let cur = job.state;
              for (const u of l.pv) { const m = moveFromUci(cur, u); if (!m) break; pv.push(m); cur = makeMove(cur, m); }
              lines.push({ move: first, score: l.score, pv });
            }
            job.resolve(lines);
          } else job.resolve({ move: e.data.uci ? moveFromUci(job.state, e.data.uci) ?? null : null, score: e.data.score });
        }
        this.pump();
      };
      w.onerror = () => {
        const job = this.busy.get(w);
        this.busy.delete(w);
        job?.reject(new Error("The analysis worker failed."));
        for (const q of this.queue.splice(0)) q.reject(new Error("The analysis worker failed."));
      };
      this.workers.push(w); this.idle.push(w);
    }
  }

  analyze(state: State, depth: number, ms: number): Promise<PosResult> {
    return new Promise((resolve, reject) => { this.queue.push({ kind: "pos", state, depth, ms, count: 0, resolve, reject }); this.pump(); });
  }

  // Top moves with evaluations and principal variations.
  lines(state: State, depth: number, ms: number, count = 3): Promise<Line[]> {
    return new Promise((resolve, reject) => { this.queue.push({ kind: "lines", state, depth, ms, count, resolve, reject }); this.pump(); });
  }

  // Drops jobs that have not started yet (for example when the position on screen has changed).
  clearQueue() { for (const q of this.queue.splice(0)) q.reject(new Error("cancelled")); }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!, job = this.queue.shift()!;
      this.busy.set(w, job);
      w.postMessage({ kind: job.kind === "lines" ? "lines" : undefined, fen: toFen(job.state), depth: job.depth, ms: job.ms, count: job.count });
    }
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    this.workers = []; this.idle = []; this.queue = []; this.busy.clear();
  }
}

export const workersSupported = () => typeof Worker !== "undefined";
export const defaultPoolSize = () => Math.max(1, Math.min(6, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4) - 1));
