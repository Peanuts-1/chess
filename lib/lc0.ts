// Server-only: runs real Leela Chess Zero (lc0) processes and talks to them over UCI.
// Configure in .env.local:  LC0_PATH (binary), LC0_WEIGHTS (network file), LC0_BACKEND (optional),
// LC0_PROCESSES (how many lc0 processes work at once, default 2, max 4) and LC0_ARGS (extra lc0 options).
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

const MATE = 100000;
export interface LeelaResult { bestmove: string | null; cp: number; pv: string[]; nodes: number }

function parseResult(lines: string[]): LeelaResult {
  const best = lines[lines.length - 1].split(/\s+/)[1];
  let cp = 0, pv: string[] = [], nodes = 0;
  for (let i = lines.length - 2; i >= 0; i--) {
    const l = lines[i];
    if (!l.startsWith("info ") || l.startsWith("info string")) continue;
    const sc = l.match(/ score (cp|mate) (-?\d+)/);
    if (!sc) continue;
    const v = parseInt(sc[2], 10);
    cp = sc[1] === "cp" ? v : v > 0 ? MATE - v : -MATE - v; // score is from the side to move's view
    pv = (l.match(/ pv (.+)$/)?.[1] ?? "").split(/\s+/).filter(Boolean);
    nodes = +(l.match(/ nodes (\d+)/)?.[1] ?? 0);
    break;
  }
  return { bestmove: best && best !== "(none)" && best !== "0000" ? best : null, cp, pv, nodes };
}

// One lc0 process. Handles one search at a time.
class Lc0Proc {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = "";
  private lineHandlers = new Set<(l: string) => void>();
  private failHandlers = new Set<(e: Error) => void>();
  private ready: Promise<void> | null = null;

  private send(cmd: string) { this.proc?.stdin.write(cmd + "\n"); }

  private waitFor(test: (l: string) => boolean, ms: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      const done = () => { clearTimeout(timer); this.lineHandlers.delete(onLine); this.failHandlers.delete(onFail); };
      const timer = setTimeout(() => { done(); reject(new Error("Leela took too long to answer.")); }, ms);
      const onLine = (l: string) => { lines.push(l); if (test(l)) { done(); resolve(lines); } };
      const onFail = (e: Error) => { done(); reject(e); };
      this.lineHandlers.add(onLine); this.failHandlers.add(onFail);
    });
  }

  private fail(e: Error) { for (const f of [...this.failHandlers]) f(e); this.reset(); }

  private reset() {
    try { this.proc?.kill(); } catch { /* already gone */ }
    this.proc = null; this.ready = null; this.buf = "";
  }

  ensure(): Promise<void> {
    if (this.ready) return this.ready;
    const path = process.env.LC0_PATH;
    this.ready = (async () => {
      if (!path) throw new Error("LC0_PATH is not set. Add it to .env.local and restart the server.");
      const args: string[] = [];
      if (process.env.LC0_WEIGHTS) args.push(`--weights=${process.env.LC0_WEIGHTS}`);
      if (process.env.LC0_BACKEND) args.push(`--backend=${process.env.LC0_BACKEND}`);
      if (process.env.LC0_ARGS) args.push(...process.env.LC0_ARGS.split(/\s+/).filter(Boolean));
      const p = spawn(path, args, { stdio: ["pipe", "pipe", "pipe"] });
      this.proc = p;
      p.stdin.on("error", () => {});
      p.stderr.on("data", () => {}); // lc0 prints its logs on stderr
      p.on("error", () => { if (this.proc === p) this.fail(new Error(`Could not start lc0 at ${path}.`)); });
      p.on("exit", () => { if (this.proc === p) this.fail(new Error("lc0 stopped. Check LC0_PATH and LC0_WEIGHTS.")); });
      p.stdout.on("data", (d: Buffer) => {
        this.buf += d.toString();
        let i: number;
        while ((i = this.buf.indexOf("\n")) >= 0) {
          const line = this.buf.slice(0, i).trim();
          this.buf = this.buf.slice(i + 1);
          for (const h of [...this.lineHandlers]) h(line);
        }
      });
      this.send("uci");
      await this.waitFor((l) => l === "uciok", 20000);
      this.send("isready");
      await this.waitFor((l) => l === "readyok", 90000); // loading a big network can take a while
    })();
    this.ready.catch(() => this.reset());
    return this.ready;
  }

  // `position fen` starts a fresh search tree each time, so no "ucinewgame" or "isready" round trips are needed.
  async analyse(fen: string, nodes: number): Promise<LeelaResult> {
    try {
      await this.ensure();
      this.send(`position fen ${fen}`);
      this.send(`go nodes ${nodes}`);
      return parseResult(await this.waitFor((l) => l.startsWith("bestmove"), 120000));
    } catch (e) { this.reset(); throw e; } // the next request starts a fresh process
  }
}

interface Job { key: string; fen: string; nodes: number; resolve: (r: LeelaResult) => void; reject: (e: Error) => void }

// Several lc0 processes working through one queue, plus a cache of results already computed.
class Lc0Pool {
  private procs: Lc0Proc[] = [];
  private idle: Lc0Proc[] = [];
  private queue: Job[] = [];
  private cache = new Map<string, LeelaResult>();
  readonly max: number;

  constructor() {
    const n = parseInt(process.env.LC0_PROCESSES || "2", 10);
    this.max = Math.max(1, Math.min(4, Number.isFinite(n) ? n : 2));
  }

  async status(): Promise<{ available: boolean; reason?: string; processes?: number }> {
    if (!process.env.LC0_PATH) return { available: false, reason: "LC0_PATH is not set. Add it to .env.local and restart the server." };
    try {
      let p = this.idle[0] ?? this.procs[0];
      if (!p) { p = new Lc0Proc(); this.procs.push(p); this.idle.push(p); }
      await p.ensure();
      return { available: true, processes: this.max };
    } catch (e) { return { available: false, reason: (e as Error).message }; }
  }

  analyse(fen: string, nodes: number): Promise<LeelaResult> {
    const key = `${fen}|${nodes}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => { this.queue.push({ key, fen, nodes, resolve, reject }); this.pump(); });
  }

  private remember(key: string, r: LeelaResult) {
    this.cache.set(key, r);
    if (this.cache.size > 4000) this.cache.delete(this.cache.keys().next().value as string);
  }

  private pump() {
    while (this.queue.length) {
      let p = this.idle.pop();
      if (!p) {
        if (this.procs.length >= this.max) return; // every process is busy: wait
        p = new Lc0Proc(); this.procs.push(p);
      }
      const proc = p, job = this.queue.shift()!;
      proc.analyse(job.fen, job.nodes)
        .then((r) => { this.remember(job.key, r); job.resolve(r); }, (e) => job.reject(e))
        .finally(() => { this.idle.push(proc); this.pump(); });
    }
  }
}

const g = globalThis as unknown as { __lc0pool?: Lc0Pool };
export const lc0 = () => (g.__lc0pool ??= new Lc0Pool());
