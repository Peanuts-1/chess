// Server-only: runs a real Leela Chess Zero (lc0) process and talks to it over UCI.
// Configure with LC0_PATH (binary), LC0_WEIGHTS (network file) and optionally LC0_BACKEND in .env.local.
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

class Lc0 {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = "";
  private lineHandlers = new Set<(l: string) => void>();
  private failHandlers = new Set<(e: Error) => void>();
  private ready: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

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

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    const path = process.env.LC0_PATH;
    this.ready = (async () => {
      if (!path) throw new Error("LC0_PATH is not set. Add it to .env.local and restart the server.");
      const args: string[] = [];
      if (process.env.LC0_WEIGHTS) args.push(`--weights=${process.env.LC0_WEIGHTS}`);
      if (process.env.LC0_BACKEND) args.push(`--backend=${process.env.LC0_BACKEND}`);
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

  async status(): Promise<{ available: boolean; reason?: string }> {
    if (!process.env.LC0_PATH) return { available: false, reason: "LC0_PATH is not set. Add it to .env.local and restart the server." };
    try { await this.start(); return { available: true }; }
    catch (e) { return { available: false, reason: (e as Error).message }; }
  }

  analyse(fen: string, nodes: number): Promise<LeelaResult> {
    const run = async (): Promise<LeelaResult> => {
      try {
        await this.start();
        this.send("ucinewgame");
        this.send("isready");
        await this.waitFor((l) => l === "readyok", 30000);
        this.send(`position fen ${fen}`);
        this.send(`go nodes ${nodes}`);
        return parseResult(await this.waitFor((l) => l.startsWith("bestmove"), 120000));
      } catch (e) { this.reset(); throw e; } // next request starts a fresh process
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }
}

const g = globalThis as unknown as { __lc0?: Lc0 };
export const lc0 = () => (g.__lc0 ??= new Lc0());
