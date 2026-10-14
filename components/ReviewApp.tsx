"use client";
import { useEffect, useRef, useState } from "react";
import Board from "./Board";
import type { Arrow } from "./Board";
import type { Color, Move, State } from "@/lib/chess";
import { makeMove } from "@/lib/chess";
import { useSettings } from "./Settings";
import { leelaAnalyze } from "@/lib/leela";
import { parsePgn, splitGames } from "@/lib/pgn";
import type { ParsedGame } from "@/lib/pgn";
import { REVIEW_LEVELS, keyMoments, reviewGame, tipsFor } from "@/lib/review";
import type { Grade, Review } from "@/lib/review";

const LEELA_NODES = { quick: 100, standard: 400, deep: 1600 };
interface GameItem { title: string; sub: string; pgn: string; user?: string }

export const META: Record<Grade, { label: string; sym: string; color: string; art: string }> = {
  best: { label: "Best", sym: "★", color: "#5b9a4a", art: "the best move" },
  excellent: { label: "Excellent", sym: "!", color: "#6aa84f", art: "an excellent move" },
  good: { label: "Good", sym: "✓", color: "#8fae5a", art: "a good move" },
  inaccuracy: { label: "Inaccuracy", sym: "?!", color: "#e0a526", art: "an inaccuracy" },
  mistake: { label: "Mistake", sym: "?", color: "#e5822b", art: "a mistake" },
  blunder: { label: "Blunder", sym: "??", color: "#ca3431", art: "a blunder" },
};
const GRADES: Grade[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];
const isBad = (g: Grade) => g === "inaccuracy" || g === "mistake" || g === "blunder";
const sameMove = (a: Move | null, b: Move) => !!a && a.from === b.from && a.to === b.to && (a.promo ?? "q") === (b.promo ?? "q");

const hdr = (pgn: string, k: string) => pgn.match(new RegExp(`\\[${k}\\s+"([^"]*)"\\]`))?.[1] ?? "";
const toItem = (pgn: string): GameItem => ({
  title: `${hdr(pgn, "White") || "White"} vs ${hdr(pgn, "Black") || "Black"}`,
  sub: [hdr(pgn, "Result"), hdr(pgn, "Date").replace(/\./g, "-")].filter((x) => x && !x.includes("?")).join(" · "),
  pgn,
});
const evalLabel = (cp: number) => (Math.abs(cp) > 90000 ? "Mate" : `${cp > 0 ? "+" : ""}${(cp / 100).toFixed(1)}`);

export default function ReviewApp() {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState<GameItem[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof REVIEW_LEVELS>("standard");
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [rev, setRev] = useState<Review | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [side, setSide] = useState<Color>("w");
  const [ply, setPly] = useState(0);
  const [showBest, setShowBest] = useState(false);
  const [retry, setRetry] = useState<{ ply: number; move?: Move; wrong?: boolean } | null>(null);
  const [tab, setTab] = useState<"moves" | "insights">("moves");
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { settings, leela } = useSettings();
  const leelaOn = settings.engine === "leela" && leela.status === "ready";
  const [usedEngine, setUsedEngine] = useState("built-in engine");

  async function start(pgn: string, who?: string) {
    setErr(""); setRev(null);
    let g: ParsedGame;
    try { g = parsePgn(pgn); } catch (e) { setErr((e as Error).message); return; }
    const id = ++run.current;
    setGame(g); setPly(0); setShowBest(false); setRetry(null); setPlaying(false); setTab("moves");
    setSide(who && (g.headers.Black || "").toLowerCase() === who.toLowerCase() ? "b" : "w");
    setProgress([0, 1]);
    setUsedEngine(leelaOn ? "Leela" : "built-in engine");
    const opt = leelaOn ? { ...REVIEW_LEVELS[speed], analyzer: (s: State) => leelaAnalyze(s, LEELA_NODES[speed]) } : REVIEW_LEVELS[speed];
    try {
      const r = await reviewGame(g, opt, (d, t) => { if (id === run.current) setProgress([d, t]); }, () => id !== run.current);
      if (id !== run.current) return;
      setRev(r); setProgress(null);
    } catch (e) {
      if (id !== run.current) return;
      setErr(`Leela stopped responding (${(e as Error).message}). Check Settings, or switch to the built-in engine.`);
      setGame(null); setProgress(null);
    }
  }

  function reset() { run.current++; setGame(null); setRev(null); setProgress(null); setErr(""); setPlaying(false); }

  function usePgn() {
    const parts = splitGames(text);
    if (!parts.length) { setErr("Paste a PGN or choose a .pgn file first."); return; }
    setErr("");
    if (parts.length === 1) { setItems([]); start(parts[0]); } else setItems(parts.map(toItem));
  }

  async function loadProfile() {
    const m = name.match(/chess\.com\/member\/([\w-]+)/i);
    const u = (m ? m[1] : name).trim().replace(/^@/, "");
    if (!u) { setErr("Enter your chess.com username or profile link."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/chesscom?user=${encodeURIComponent(u)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not load games.");
      if (!j.games.length) throw new Error("No recent standard games found for that player.");
      setItems(j.games.map((g: any) => {
        const me = g.white?.toLowerCase() === u.toLowerCase() ? g.whiteResult : g.blackResult;
        const res = me === "win" ? "Won" : ["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(me) ? "Draw" : "Lost";
        return { title: `${g.white} vs ${g.black}`, sub: `${res} · ${g.timeClass} · ${new Date(g.endTime * 1000).toLocaleDateString()}`, pgn: g.pgn, user: u } as GameItem;
      }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const n = rev ? rev.plies.length : 0;
  const go = (p: number) => { setPly(Math.max(0, Math.min(n, p))); setShowBest(false); setRetry(null); };

  useEffect(() => {
    if (!rev) return;
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "TEXTAREA" || t === "INPUT" || t === "SELECT") return;
      if (e.key === "ArrowLeft") { setPly((p) => Math.max(0, p - 1)); setShowBest(false); setRetry(null); }
      if (e.key === "ArrowRight") { setPly((p) => Math.min(rev.plies.length, p + 1)); setShowBest(false); setRetry(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rev]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPly((p) => { if (p >= n) { setPlaying(false); return p; } setShowBest(false); setRetry(null); return p + 1; }), 1100);
    return () => clearInterval(id);
  }, [playing, n]);

  useEffect(() => { listRef.current?.querySelector(".cur")?.scrollIntoView({ block: "nearest" }); }, [ply, tab]);

  // ---------- input screen ----------
  if (!game) {
    return (
      <div className="review">
        <h1>Review a game</h1>
        <p className="lede">Load a game and the engine goes through it move by move. It grades each move, shows what it would have played, and suggests what to work on.</p>
        <div className="inputs">
          <section className="card">
            <h2>From chess.com</h2>
            <label>Username or profile link
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="https://www.chess.com/member/yourname"
                onKeyDown={(e) => e.key === "Enter" && loadProfile()} />
            </label>
            <button className="btn primary" disabled={busy} onClick={loadProfile}>{busy ? "Loading…" : "Find my recent games"}</button>
          </section>
          <section className="card">
            <h2>From a PGN</h2>
            <label>Choose a .pgn file
              <input type="file" accept=".pgn,.txt" onChange={(e) => e.target.files?.[0]?.text().then(setText)} />
            </label>
            <label>…or paste the moves
              <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 …'} />
            </label>
            <button className="btn primary" onClick={usePgn}>Use this PGN</button>
          </section>
        </div>
        <label className="speed">Analysis depth
          <select value={speed} onChange={(e) => setSpeed(e.target.value as keyof typeof REVIEW_LEVELS)}>
            <option value="quick">{leelaOn ? "Quick: 100 nodes per move" : "Quick: about 10 seconds"}</option>
            <option value="standard">{leelaOn ? "Standard: 400 nodes per move" : "Standard: about 30 to 60 seconds"}</option>
            <option value="deep">{leelaOn ? "Deeper: 1600 nodes per move" : "Deeper: several minutes, catches more tactics"}</option>
          </select>
        </label>
        <p className="muted">Engine: {leelaOn ? "Leela Chess Zero" : "built-in engine"}.{settings.engine === "leela" && !leelaOn ? " Leela is not connected, so the built-in engine will be used (see Settings)." : " You can switch in Settings."}</p>
        {err && <p className="bad" role="alert">{err}</p>}
        {items.length > 0 && (
          <div className="games">
            <h2>Pick a game</h2>
            {items.map((it, i) => (
              <button key={i} className="gitem" onClick={() => start(it.pgn, it.user)}>
                <strong>{it.title}</strong><span>{it.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- analysing ----------
  if (!rev) {
    const pct = progress ? Math.round((progress[0] / progress[1]) * 100) : 0;
    return (
      <div className="review analysing">
        <h1>Reviewing your game…</h1>
        <p className="lede">{err || `${game.headers.White || "White"} vs ${game.headers.Black || "Black"}: the engine is looking at every position. Keep this tab open.`}</p>
        <progress value={progress?.[0] ?? 0} max={progress?.[1] ?? 1} />
        <p className="muted">{pct}% complete</p>
        <p><button className="btn small" onClick={reset}>Cancel</button></p>
      </div>
    );
  }

  // ---------- results ----------
  const cur = ply > 0 ? rev.plies[ply - 1] : null;
  const who = (c: Color) => game.headers[c === "w" ? "White" : "Black"] || (c === "w" ? "White" : "Black");
  const opp: Color = side === "w" ? "b" : "w";

  // What the board shows: the position after the move, the one before it (with arrows), or a retry attempt.
  let boardState: State = game.states[ply];
  let lastMove: Move | null = ply > 0 ? game.moves[ply - 1] : null;
  let arrows: Arrow[] = [];
  let badge = cur && ply > 0 ? { sq: game.moves[ply - 1].to, text: META[cur.grade].sym, color: META[cur.grade].color } : null;
  let movable: Color | null = null;
  if (retry) {
    const base = game.states[retry.ply - 1];
    boardState = retry.move ? makeMove(base, retry.move) : base;
    lastMove = retry.move ?? (retry.ply >= 2 ? game.moves[retry.ply - 2] : null);
    badge = null; movable = retry.move ? null : base.turn;
  } else if (showBest && cur && ply > 0) {
    boardState = game.states[ply - 1];
    lastMove = ply >= 2 ? game.moves[ply - 2] : null;
    badge = null;
    arrows = [{ from: game.moves[ply - 1].from, to: game.moves[ply - 1].to, color: META[cur.grade].color }];
    if (cur.best) arrows.push({ from: cur.best.from, to: cur.best.to, color: "#3fa34d" });
  }

  function onRetryMove(m: Move) {
    if (!retry) return;
    const best = rev!.plies[retry.ply - 1].best;
    if (sameMove(best, m)) setRetry({ ply: retry.ply, move: m });
    else setRetry({ ply: retry.ply, wrong: true });
  }

  const win = rev.winPct[ply];
  const label = evalLabel(rev.cp[ply]);
  const moveNo = (i: number) => `${game.states[i].full}${rev.plies[i].mover === "w" ? "." : "…"}`;
  const tips = tipsFor(rev, side);
  const moments = keyMoments(rev, side);

  const rows: { n: number; w?: number; b?: number }[] = [];
  rev.plies.forEach((p, i) => {
    const last = rows[rows.length - 1];
    if (p.mover === "w") rows.push({ n: game.states[i].full, w: i });
    else if (last && last.b === undefined && last.w !== undefined) last.b = i;
    else rows.push({ n: game.states[i].full, b: i });
  });
  const mv = (i?: number) => {
    if (i === undefined) return <span />;
    const g = rev.plies[i].grade, showSym = g === "best" || isBad(g);
    return (
      <button className={`mv${ply === i + 1 ? " cur" : ""}`} onClick={() => go(i + 1)}>
        {showSym && <span className="msym" style={{ color: META[g].color }}>{META[g].sym}</span>}{rev.plies[i].san}
      </button>
    );
  };

  // coach message
  let coach: { title: string; body: string[]; color?: string };
  if (retry) {
    const p = rev.plies[retry.ply - 1];
    coach = retry.move ? { title: "Correct!", body: [`${p.bestSan} is the engine's choice here.`], color: META.best.color }
      : retry.wrong ? { title: "Not quite", body: ["That is not the engine's move. Try another one."], color: META.mistake.color }
      : { title: `Your turn: find a better move than ${p.san}`, body: ["Move a piece on the board."] };
  } else if (!cur) {
    coach = { title: "Ready to review", body: ["Press Next, use the arrow keys, or jump to a key moment in Insights."] };
  } else {
    const body: string[] = [];
    if (cur.note) body.push(cur.note);
    if (cur.grade !== "best" && cur.bestSan) body.push(`Best was ${cur.bestSan}.`);
    coach = { title: `${cur.san} is ${META[cur.grade].art}`, body, color: META[cur.grade].color };
  }

  const accBox = (c: Color) => (
    <div className={"accbox " + c}>
      <span className="accnum">{rev.accuracy[c].toFixed(1)}</span>
      <span className="accwho">{who(c)}</span>
    </div>
  );
  const strip = (c: Color) => (
    <div className="pstrip">
      <span className={"pdot " + c} />
      <strong>{who(c)}</strong>
      <span className="muted">{hdr(`[${c === "w" ? "WhiteElo" : "BlackElo"} "${game.headers[c === "w" ? "WhiteElo" : "BlackElo"] ?? ""}"]`, c === "w" ? "WhiteElo" : "BlackElo")}</span>
      <span className="pacc">{rev.accuracy[c].toFixed(0)}%</span>
    </div>
  );

  return (
    <div className="rv">
      <div className="rv-left">
        {strip(opp)}
        <div className="boardrow">
          <EvalBar win={win} label={label} whiteAtBottom={side === "w"} />
          <Board state={boardState} orientation={side} movable={movable} onMove={onRetryMove} lastMove={lastMove} arrows={arrows} badge={badge} />
        </div>
        {strip(side)}
        <div className="controls">
          <button className="btn small" onClick={() => go(0)} disabled={ply === 0} aria-label="Start">⏮</button>
          <button className="btn small" onClick={() => go(ply - 1)} disabled={ply === 0} aria-label="Previous move">◀</button>
          <button className="btn small" onClick={() => setPlaying(!playing)} disabled={ply === n && !playing}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
          <button className="btn small" onClick={() => go(ply + 1)} disabled={ply === n} aria-label="Next move">▶</button>
          <button className="btn small" onClick={() => go(n)} disabled={ply === n} aria-label="End">⏭</button>
          <button className="btn small" onClick={() => setSide(opp)}>Flip</button>
        </div>
        <Graph rev={rev} ply={ply} onPick={go} />
      </div>

      <div className="rv-right">
        <div className="rv-head">
          <h1>Game Review</h1>
          <p className="muted">{who("w")} vs {who("b")}{game.headers.Result ? ` · ${game.headers.Result}` : ""}</p>
        </div>
        <div className="accrow">{accBox("w")}{accBox("b")}</div>

        <div className="coach" style={coach.color ? { borderLeftColor: coach.color } : undefined}>
          <div className="coach-title" style={coach.color ? { color: coach.color } : undefined}>
            {cur && !retry && <span className="cbadge" style={{ background: META[cur.grade].color }}>{META[cur.grade].sym}</span>}
            {coach.title}
          </div>
          {coach.body.map((t, i) => <p key={i}>{t}</p>)}
          <div className="coach-btns">
            {cur && !retry && cur.grade !== "best" && cur.best && (
              <button className="btn small" onClick={() => setShowBest(!showBest)}>{showBest ? "Hide best move" : "Show best move"}</button>
            )}
            {cur && !retry && isBad(cur.grade) && cur.best && (
              <button className="btn small primary" onClick={() => { setShowBest(false); setRetry({ ply }); }}>Retry</button>
            )}
            {retry && <button className="btn small" onClick={() => setRetry(null)}>{retry.move ? "Continue" : "Give up"}</button>}
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "moves"} className={tab === "moves" ? "on" : ""} onClick={() => setTab("moves")}>Moves</button>
          <button role="tab" aria-selected={tab === "insights"} className={tab === "insights" ? "on" : ""} onClick={() => setTab("insights")}>Insights</button>
        </div>

        {tab === "moves" ? (
          <div className="movelist tall" ref={listRef} aria-label="Moves">
            {rows.map((r) => <div key={r.n + "-" + (r.w ?? r.b)} className="mrow"><span className="mn">{r.n}.</span>{mv(r.w)}{mv(r.b)}</div>)}
          </div>
        ) : (
          <div className="insights">
            <table className="ctable">
              <thead><tr><th /><th>{who("w")}</th><th>{who("b")}</th></tr></thead>
              <tbody>
                {GRADES.map((g) => (
                  <tr key={g}>
                    <td><span className="cbadge" style={{ background: META[g].color }}>{META[g].sym}</span> {META[g].label}</td>
                    <td>{rev.counts.w[g]}</td><td>{rev.counts.b[g]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="segment" role="group" aria-label="Review as">
              <span>Advice for</span>
              <button className={side === "w" ? "on" : ""} onClick={() => setSide("w")}>{who("w")}</button>
              <button className={side === "b" ? "on" : ""} onClick={() => setSide("b")}>{who("b")}</button>
            </div>
            {moments.length > 0 && (
              <p className="moments">Key moments:{" "}
                {moments.map((i) => (
                  <button key={i} className="chip" style={{ ["--gc" as string]: META[rev.plies[i].grade].color }} onClick={() => { go(i + 1); setTab("moves"); }}>
                    {moveNo(i)} {rev.plies[i].san}
                  </button>
                ))}
              </p>
            )}
            {tips.map((t) => <div key={t.title} className="tip"><strong>{t.title}</strong><p>{t.text}</p></div>)}
          </div>
        )}

        <p className="muted small-note">{usedEngine === "Leela"
          ? "Grades and best moves come from Leela Chess Zero. Higher node counts give steadier verdicts."
          : "Grades come from the built-in engine, which is far weaker than Leela or Stockfish. It is reliable for hung pieces and missed captures; treat its verdict on deep sacrifices with caution. Use Deeper depth, or connect Leela in Settings."}</p>
        <button className="btn" onClick={reset}>Review another game</button>
      </div>
    </div>
  );
}

function EvalBar({ win, label, whiteAtBottom }: { win: number; label: string; whiteAtBottom: boolean }) {
  const whiteAhead = win >= 50;
  const atBottom = whiteAhead === whiteAtBottom; // label sits at the end of the side that is ahead
  return (
    <div className="evalbar" role="img" aria-label={`Evaluation ${label} for White`}>
      <div className={"ebfill " + (whiteAtBottom ? "fromBottom" : "fromTop")} style={{ height: `${win}%` }} />
      <span className={"eblabel " + (atBottom ? "bottom" : "top") + (whiteAhead ? " onwhite" : " onblack")}>{label}</span>
    </div>
  );
}

function Graph({ rev, ply, onPick }: { rev: Review; ply: number; onPick: (p: number) => void }) {
  const data = rev.winPct, n = data.length - 1;
  const x = (i: number) => (n === 0 ? 0 : (i / n) * 600);
  const pts = data.map((w, i) => `${x(i).toFixed(1)},${(100 - w).toFixed(1)}`).join(" ");
  return (
    <div className="graphwrap">
      <svg className="graph" viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label="Evaluation graph"
        onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); onPick(Math.round(((e.clientX - b.left) / b.width) * n)); }}>
        <rect width="600" height="100" fill="#2b3541" />
        <polygon points={`0,100 ${pts} 600,100`} fill="#f4f6f8" />
        <line x1="0" x2="600" y1="50" y2="50" stroke="#8a97a5" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
        <line x1={x(ply)} x2={x(ply)} y1="0" y2="100" stroke="#3a4fd7" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      {rev.plies.map((p, i) => isBad(p.grade) && p.grade !== "inaccuracy" ? (
        <button key={i} className="gdot" aria-label={`${META[p.grade].label}: ${p.san}`} title={`${p.san}: ${META[p.grade].label}`}
          style={{ left: `${((i + 1) / n) * 100}%`, top: `${100 - data[i + 1]}%`, background: META[p.grade].color }} onClick={() => onPick(i + 1)} />
      ) : null)}
    </div>
  );
}
