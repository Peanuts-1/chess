"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import type { Arrow } from "./Board";
import { bestMove } from "@/lib/engine";
import { makeMove, moveFromUci, nameSq, parseFen, toSan } from "@/lib/chess";
import type { Move, State } from "@/lib/chess";
import {
  ANGLES, PROBLEM_RD, START_RATING, START_RD, difficultyFor, glicko, judgeMove, localProblems, refTimeMs, tagLabel, visibleTags,
} from "@/lib/tactics";
import type { Problem } from "@/lib/tactics";

interface Attempt { problem: Problem; result: "pass" | "fail"; ms: number; delta: number; after: number; ts: number }
interface Stored { rating: number; rd: number; attempts: Attempt[]; mode: "standard" | "blitz"; source: "online" | "local"; angle: string }
const KEY = "openfile-tactics";
const DEFAULT: Stored = { rating: START_RATING, rd: START_RD, attempts: [], mode: "standard", source: "online", angle: "" };
type Phase = "loading" | "solving" | "solved" | "failed";

const fmt = (ms: number) => {
  const t = Math.floor(ms / 100), s = Math.floor(t / 10);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${t % 10}`;
};
const sq = (u: string): Move => ({ from: nameSq(u.slice(0, 2)), to: nameSq(u.slice(2, 4)) });

async function fetchOnline(angle: string, difficulty: string): Promise<Problem | null> {
  try {
    const q = new URLSearchParams({ difficulty });
    if (angle) q.set("angle", angle);
    const r = await fetch(`/api/puzzle?${q}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as Problem) : null;
  } catch { return null; }
}

export default function TacticsTrainer() {
  const [store, setStore] = useState<Stored>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [st, setSt] = useState<State | null>(null);
  const [last, setLast] = useState<Move | null>(null);
  const [ply, setPly] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [resolved, setResolved] = useState(false); // rating already applied for this problem
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "info" | "ok" | "bad"; text: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [solutionText, setSolutionText] = useState("");
  const startRef = useRef(0);
  const opTimer = useRef<ReturnType<typeof setTimeout>>();
  const loadId = useRef(0);
  const sessionStart = useRef(Date.now());
  const LOCAL = useMemo(() => localProblems(), []);

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setStore({ ...DEFAULT, ...JSON.parse(s) }); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } }, [store, loaded]);
  useEffect(() => { if (loaded && !problem) next(); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (opTimer.current) clearTimeout(opTimer.current); }, []);

  const running = phase === "solving" && !resolved;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [running]);

  const side = useMemo(() => (problem ? parseFen(problem.fen).turn : "w"), [problem]);

  function load(p: Problem, rated = true) {
    if (opTimer.current) clearTimeout(opTimer.current);
    setProblem(p); setSt(parseFen(p.fen)); setLast(p.lastMove ? sq(p.lastMove) : null);
    setPly(0); setPhase("solving"); setResolved(!rated); setBusy(false); setSolutionText(""); setLastDelta(null);
    setElapsed(0); startRef.current = Date.now();
    setMsg(rated ? null : { kind: "info", text: "Practice: this attempt is not rated." });
  }

  function pickLocal(): Problem {
    let pool = LOCAL;
    if (store.angle) { const f = LOCAL.filter((p) => p.themes.includes(store.angle)); if (f.length) pool = f; }
    const recent = new Set(store.attempts.slice(-8).map((a) => a.problem.id));
    const fresh = pool.filter((p) => !recent.has(p.id));
    const arr = (fresh.length ? fresh : pool).slice().sort((a, b) => Math.abs(a.rating - store.rating) - Math.abs(b.rating - store.rating));
    return arr[Math.floor(Math.random() * Math.min(5, arr.length))];
  }

  async function next() {
    const id = ++loadId.current;
    setPhase("loading"); setMsg(null); setNotice(""); setSolutionText("");
    let p: Problem | null = null;
    if (store.source === "online") {
      p = await fetchOnline(store.angle, difficultyFor(store.rating));
      if (id !== loadId.current) return;
      if (!p) setNotice("Could not reach Lichess, so this problem comes from the offline set.");
    }
    load(p ?? pickLocal());
  }

  function applyResult(res: "pass" | "fail") {
    if (!problem || resolved) return;
    const ms = Date.now() - startRef.current;
    let score = res === "pass" ? 1 : 0;
    if (res === "pass" && store.mode === "blitz") {
      const ref = refTimeMs(problem.rating, Math.ceil(problem.solution.length / 2));
      if (ms > ref) score = Math.max(0.5, 1 - (0.5 * (ms - ref)) / (2 * ref));
    }
    const g = glicko(store.rating, store.rd, problem.rating, PROBLEM_RD, score);
    const after = Math.max(100, g.rating);
    const delta = Math.round(after) - Math.round(store.rating);
    const a: Attempt = { problem, result: res, ms, delta, after, ts: Date.now() };
    setStore((s) => ({ ...s, rating: after, rd: g.rd, attempts: [...s.attempts, a].slice(-200) }));
    setResolved(true); setElapsed(ms); setLastDelta(delta);
  }

  function onMove(m: Move) {
    if (!problem || !st || phase !== "solving" || busy) return;
    const j = judgeMove(problem, st, ply, m);
    if (!j.ok) {
      if (!resolved) applyResult("fail");
      setMsg({ kind: "bad", text: resolved ? "Not the move. Try again." : "Incorrect. The problem is marked as failed, but you can keep trying." });
      return;
    }
    setSt(j.ns); setLast(m);
    const newPly = ply + 1;
    if (j.done) {
      if (!resolved) applyResult("pass");
      setPhase("solved");
      setMsg({ kind: "ok", text: resolved ? "Solved (not rated)." : "Correct!" });
      return;
    }
    setPly(newPly); setBusy(true); setMsg({ kind: "ok", text: "Correct. Keep going…" });
    opTimer.current = setTimeout(() => {
      const r = moveFromUci(j.ns, problem.solution[newPly] ?? "") ?? bestMove(j.ns, { depth: 2, ms: 200, noise: 0 });
      if (r) { setSt(makeMove(j.ns, r)); setLast(r); }
      setPly(newPly + 1); setBusy(false);
    }, 500);
  }

  function giveUp() {
    if (!problem || busy || phase !== "solving") return;
    if (!resolved) applyResult("fail");
    let s = parseFen(problem.fen);
    const out: string[] = [];
    for (const u of problem.solution) { const m = moveFromUci(s, u); if (!m) break; out.push(toSan(s, m)); s = makeMove(s, m); }
    setSolutionText(out.join("  →  "));
    setPhase("failed"); setMsg({ kind: "bad", text: "Problem failed. Here is the solution." });
  }

  function tryAgain() {
    if (!problem) return;
    if (opTimer.current) clearTimeout(opTimer.current);
    setSt(parseFen(problem.fen)); setLast(problem.lastMove ? sq(problem.lastMove) : null);
    setPly(0); setPhase("solving"); setBusy(false); setSolutionText("");
    setMsg({ kind: "info", text: "Practice: this attempt is not rated." });
  }

  const set = (p: Partial<Stored>) => setStore((s) => ({ ...s, ...p }));

  const arrows: Arrow[] = [];
  if (phase === "failed" && problem && st) { const m = moveFromUci(st, problem.solution[ply] ?? ""); if (m) arrows.push({ from: m.from, to: m.to }); }

  const sess = store.attempts.filter((a) => a.ts >= sessionStart.current);
  const passed = sess.filter((a) => a.result === "pass");
  const avg = passed.length ? passed.reduce((x, a) => x + a.ms, 0) / passed.length : 0;
  const change = sess.reduce((x, a) => x + a.delta, 0);
  const recent = store.attempts.slice(-8).reverse();
  const graph = store.attempts.slice(-60).map((a) => a.after);

  return (
    <div className="tt">
      <div className="tt-left">
        <div className="tt-info">
          <div className="tt-timer" aria-label="Time on this problem">{fmt(elapsed)}</div>
          <div className="tt-prob">
            <span>Problem rating <strong>{problem ? problem.rating : "…"}</strong>{problem?.source === "local" && <em title="Estimated rating"> (est.)</em>}</span>
            {problem?.plays ? <span className="muted"> · played {problem.plays.toLocaleString()} times</span> : null}
          </div>
          <div className="tt-tags">
            {resolved && problem ? visibleTags(problem.themes).map((t) => <span key={t} className="chip static">{tagLabel(t)}</span>) : <span className="muted">Tags are revealed once the problem is done.</span>}
          </div>
        </div>

        <div className="boardwrap tt-board">
          {st ? (
            <Board state={st} orientation={side} movable={phase === "solving" && !busy ? side : null} lastMove={last} onMove={onMove} arrows={arrows} />
          ) : <div className="tt-loading">Loading a problem…</div>}
        </div>

        <div className={"tt-msg " + (msg ? msg.kind : "")} role="status" aria-live="polite">
          {phase === "loading" ? "Loading a problem…" : msg ? msg.text : `${side === "w" ? "White" : "Black"} to move. Find the best move.`}
          {lastDelta !== null && <strong className={lastDelta >= 0 ? "good" : "bad"}> {lastDelta >= 0 ? "+" : ""}{lastDelta} rating</strong>}
          {solutionText && <div className="pz-sol">{solutionText}</div>}
        </div>
        {notice && <p className="muted">{notice}</p>}

        <div className="row">
          <button className="btn small" onClick={giveUp} disabled={phase !== "solving" || busy}>Give up</button>
          {phase === "failed" && <button className="btn small" onClick={tryAgain}>Try again</button>}
          {phase === "solving" && resolved && !busy && <button className="btn small" onClick={tryAgain}>Restart</button>}
          <button className={"btn small" + (phase === "solved" || phase === "failed" ? " primary" : "")} onClick={next} disabled={phase === "loading"}>Next problem</button>
          {problem?.source === "lichess" && resolved && (
            <a className="btn small" href={`https://lichess.org/training/${problem.id}`} target="_blank" rel="noreferrer">View on Lichess</a>
          )}
        </div>
      </div>

      <aside className="tt-right">
        <section className="card">
          <h2>Your tactics rating</h2>
          <p className="tt-rating">{Math.round(store.rating)}<span className="muted"> ± {Math.round(store.rd)}</span></p>
          <Graph values={graph} />
        </section>

        <section className="card">
          <h2>Session</h2>
          <div className="pz-stats">
            <div><strong>{sess.length}</strong><span>attempted</span></div>
            <div><strong>{sess.length ? Math.round((passed.length / sess.length) * 100) : 0}%</strong><span>passed</span></div>
            <div><strong>{avg ? fmt(avg).replace(/^00:/, "") : "–"}</strong><span>avg solve time</span></div>
          </div>
          <p className="muted">Rating change this session: <strong className={change >= 0 ? "good" : "bad"}>{change >= 0 ? "+" : ""}{change}</strong></p>
        </section>

        <section className="card">
          <h2>Problem set</h2>
          <div className="segment" role="group" aria-label="Rating mode">
            <span>Mode</span>
            <button className={store.mode === "standard" ? "on" : ""} onClick={() => set({ mode: "standard" })}>Standard</button>
            <button className={store.mode === "blitz" ? "on" : ""} onClick={() => set({ mode: "blitz" })}>Blitz</button>
          </div>
          <p className="muted">{store.mode === "standard" ? "Take as long as you like. Only right or wrong counts." : "Slow solves earn less rating, as on ChessTempo."}</p>
          <div className="segment" role="group" aria-label="Problem source">
            <span>Source</span>
            <button className={store.source === "online" ? "on" : ""} onClick={() => set({ source: "online" })}>Lichess</button>
            <button className={store.source === "local" ? "on" : ""} onClick={() => set({ source: "local" })}>Offline</button>
          </div>
          <label className="speed">Problem type
            <select value={store.angle} onChange={(e) => set({ angle: e.target.value })}>
              {ANGLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <p className="muted">
            {store.source === "online"
              ? "Problems come from the Lichess open puzzle database (millions of rated, tagged positions) and are picked near your rating."
              : "The offline set has 41 problems: Mate in 1, Mate in 2 and Win material. Their ratings are estimates."}
          </p>
        </section>

        <section className="card">
          <h2>Recent problems</h2>
          {recent.length === 0 ? <p className="muted">Your attempts will be listed here. Click one to try it again.</p> : (
            <table className="ctable attempts">
              <thead><tr><th>Result</th><th>Problem</th><th>Time</th><th>Rating</th></tr></thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.ts} onClick={() => load(a.problem, false)} className="clickrow">
                    <td className={a.result === "pass" ? "good" : "bad"}>{a.result === "pass" ? "✓" : "✗"}</td>
                    <td>{a.problem.rating}</td><td>{fmt(a.ms).replace(/^00:/, "")}</td>
                    <td className={a.delta >= 0 ? "good" : "bad"}>{a.delta >= 0 ? "+" : ""}{a.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </aside>
    </div>
  );
}

function Graph({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="muted">Solve a few problems to see your rating history.</p>;
  const lo = Math.min(...values), hi = Math.max(...values), span = Math.max(20, hi - lo);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 300).toFixed(1)},${(70 - ((v - lo) / span) * 60 - 5).toFixed(1)}`).join(" ");
  return (
    <div className="tt-graph">
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label="Rating history">
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="tt-graph-labels"><span>{Math.round(hi)}</span><span>{Math.round(lo)}</span></div>
    </div>
  );
}
