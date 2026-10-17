// Server-only: runs real chess engines (Leela Chess Zero and Stockfish) as UCI processes.
// Configure in .env.local. Leela: LC0_PATH, LC0_WEIGHTS, LC0_BACKEND, LC0_PROCESSES, LC0_ARGS.
// Stockfish: STOCKFISH_PATH, STOCKFISH_THREADS, STOCKFISH_HASH, STOCKFISH_PROCESSES, STOCKFISH_ARGS.
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

const MATE = 100000;
export type EngineId = "leela" | "stockfish";
export interface UciLine { cp: number; pv: string[]; depth: number; nodes: number } // cp: side to move's view
export interface UciResult { bestmove: string | null; lines: UciLine[] }
export interface Request { fen: string; nodes?: number; depth?: number; movetime?: number; multipv: number; skill?: number }

const num = (v: string | undefined, dflt: number, lo: number, hi: number) => {
  const n = parseInt(v ?? "", 10);
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : dflt));
};
const split = (v?: string) => (v ?? "").split(/\s+/).filter(Boolean);

interface Config {
  label: string; pathVar: string; missing: string;
  args: () => string[]; options: () => [string, string | number][]; processes: () => number;
}
const CONFIGS: Record<EngineId, Config> = {
  leela: {
    label: "Leela", pathVar: "LC0_PATH", missing: "LC0_PATH is not set. Add it to .env.local and restart the server.",
    args: () => [
      ...(process.env.LC0_WEIGHTS ? [`--weights=${process.env.LC0_WEIGHTS}`] : []),
      ...(process.env.LC0_BACKEND ? [`--backend=${process.env.LC0_BACKEND}`] : []),
      ...split(process.env.LC0_ARGS),
    ],
    options: () => [],
    processes: () => num(process.env.LC0_PROCESSES, 2, 1, 4),
  },
  stockfish: {
    label: "Stockfish", pathVar: "STOCKFISH_PATH", missing: "STOCKFISH_PATH is not set. Add it to .env.local and restart the server.",
    args: () => split(process.env.STOCKFISH_ARGS),
    options: () => [["Threads", num(process.env.STOCKFISH_THREADS, 1, 1, 64)], ["Hash", num(process.env.STOCKFISH_HASH, 64, 1, 4096)]],
    processes: () => num(process.env.STOCKFISH_PROCESSES, 2, 1, 4),
  },
};

function parseInfo(line: string): { k: number; line: UciLine } | null {
  if (!line.startsWith("info ") || line.startsWith("info string")) return null;
  const sc = line.match(/ score (cp|mate) (-?\d+)/);
  const pv = line.match(/ pv (.+)$/);
  if (!sc || !pv) return null;
  const v = parseInt(sc[2], 10);
  return {
    k: +(line.match(/ multipv (\d+)/)?.[1] ?? 1),
    line: {
      cp: sc[1] === "cp" ? v : v > 0 ? MATE - v : -MATE - v, // mate in n -> a huge score
      pv: pv[1].split(/\s+/).filter(Boolean),
      depth: +(line.match(/ depth (\d+)/)?.[1] ?? 0),
      nodes: +(line.match(/ nodes (\d+)/)?.[1] ?? 0),
    },
  };
}

function parseResult(lines: string[]): UciResult {
  const best = lines[lines.length - 1].split(/\s+/)[1];
  const byRank = new Map<number, UciLine>();
  for (const l of lines) { const p = parseInfo(l); if (p) byRank.set(p.k, p.line); } // later (deeper) info replaces earlier
  return {
    bestmove: best && best !== "(none)" && best !== "0000" ? best : null,
    lines: [...byRank.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]),
  };
}

// One engine process. Handles one search at a time.
class UciProc {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = "";
  private lineHandlers = new Set<(l: string) => void>();
  private failHandlers = new Set<(e: Error) => void>();
  private ready: Promise<void> | null = null;
  private multipv = 1;
  private skill: number | null = null;
  private id: EngineId;
  constructor(id: EngineId) { this.id = id; }

  private send(cmd: string) { this.proc?.stdin.write(cmd + "\n"); }

  private waitFor(test: (l: string) => boolean, ms: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      const done = () => { clearTimeout(timer); this.lineHandlers.delete(onLine); this.failHandlers.delete(onFail); };
      const timer = setTimeout(() => { done(); reject(new Error("The engine took too long to answer.")); }, ms);
      const onLine = (l: string) => { lines.push(l); if (test(l)) { done(); resolve(lines); } };
      const onFail = (e: Error) => { done(); reject(e); };
      this.lineHandlers.add(onLine); this.failHandlers.add(onFail);
    });
  }

  private fail(e: Error) { for (const f of [...this.failHandlers]) f(e); this.reset(); }

  private reset() {
    try { this.proc?.kill(); } catch { /* already gone */ }
    this.proc = null; this.ready = null; this.buf = ""; this.multipv = 1; this.skill = null;
  }

  ensure(): Promise<void> {
    if (this.ready) return this.ready;
    const cfg = CONFIGS[this.id];
    const path = process.env[cfg.pathVar];
    this.ready = (async () => {
      if (!path) throw new Error(cfg.missing);
      const p = spawn(path, cfg.args(), { stdio: ["pipe", "pipe", "pipe"] });
      this.proc = p;
      p.stdin.on("error", () => {});
      p.stderr.on("data", () => {});
      p.on("error", () => { if (this.proc === p) this.fail(new Error(`Could not start ${cfg.label} at ${path}.`)); });
      p.on("exit", () => { if (this.proc === p) this.fail(new Error(`${cfg.label} stopped. Check ${cfg.pathVar} and its other settings.`)); });
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
      for (const [name, value] of cfg.options()) this.send(`setoption name ${name} value ${value}`);
      this.send("isready");
      await this.waitFor((l) => l === "readyok", 90000); // loading a big network can take a while
    })();
    this.ready.catch(() => this.reset());
    return this.ready;
  }

  async analyse(req: Request): Promise<UciResult> {
    try {
      await this.ensure();
      let changed = false;
      if (req.multipv !== this.multipv) { this.send(`setoption name MultiPV value ${req.multipv}`); this.multipv = req.multipv; changed = true; }
      if (this.id === "stockfish") {
        const want = req.skill ?? 20;
        if (want !== (this.skill ?? 20)) { this.send(`setoption name Skill Level value ${want}`); changed = true; }
        this.skill = want;
      }
      if (changed) { this.send("isready"); await this.waitFor((l) => l === "readyok", 30000); }
      this.send(`position fen ${req.fen}`); // a fresh search tree each time: no "ucinewgame" round trip needed
      this.send(req.nodes ? `go nodes ${req.nodes}` : req.depth ? `go depth ${req.depth}` : `go movetime ${req.movetime ?? 1000}`);
      return parseResult(await this.waitFor((l) => l.startsWith("bestmove"), 180000));
    } catch (e) { this.reset(); throw e; } // the next request starts a fresh process
  }
}

interface Job { key: string; req: Request; resolve: (r: UciResult) => void; reject: (e: Error) => void }

// Several processes of one engine working through a queue, plus a cache of results already computed.
class UciPool {
  private procs: UciProc[] = [];
  private idle: UciProc[] = [];
  private queue: Job[] = [];
  private cache = new Map<string, UciResult>();
  private id: EngineId;
  constructor(id: EngineId) { this.id = id; }
  get max() { return CONFIGS[this.id].processes(); }

  async status(): Promise<{ available: boolean; reason?: string; processes?: number }> {
    const cfg = CONFIGS[this.id];
    if (!process.env[cfg.pathVar]) return { available: false, reason: cfg.missing };
    try {
      let p = this.idle[0] ?? this.procs[0];
      if (!p) { p = new UciProc(this.id); this.procs.push(p); this.idle.push(p); }
      await p.ensure();
      return { available: true, processes: this.max };
    } catch (e) { return { available: false, reason: (e as Error).message }; }
  }

  analyse(req: Request): Promise<UciResult> {
    const key = [req.fen, req.nodes ?? "", req.depth ?? "", req.movetime ?? "", req.multipv, req.skill ?? ""].join("|");
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => { this.queue.push({ key, req, resolve, reject }); this.pump(); });
  }

  private remember(key: string, r: UciResult) {
    this.cache.set(key, r);
    if (this.cache.size > 4000) this.cache.delete(this.cache.keys().next().value as string);
  }

  private pump() {
    while (this.queue.length) {
      let p = this.idle.pop();
      if (!p) {
        if (this.procs.length >= this.max) return; // every process is busy: wait
        p = new UciProc(this.id); this.procs.push(p);
      }
      const proc = p, job = this.queue.shift()!;
      proc.analyse(job.req)
        .then((r) => { this.remember(job.key, r); job.resolve(r); }, (e) => job.reject(e))
        .finally(() => { this.idle.push(proc); this.pump(); });
    }
  }
}

const g = globalThis as unknown as { __uciPools?: Partial<Record<EngineId, UciPool>> };
export const enginePool = (id: EngineId): UciPool => {
  g.__uciPools ??= {};
  return (g.__uciPools[id] ??= new UciPool(id));
};
