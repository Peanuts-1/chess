"use client";
import { useEffect, useRef, useState } from "react";
import Board from "./Board";
import type { Arrow } from "./Board";
import type { Color, Move, State } from "@/lib/chess";
import { makeMove, toFen, toSan } from "@/lib/chess";
import { useSettings } from "./Settings";
import { leelaAnalyze } from "@/lib/leela";
import { clockAt, moveTimes, parsePgn, splitGames, timeControl } from "@/lib/pgn";
import type { ParsedGame } from "@/lib/pgn";
import { REVIEW_LEVELS, analyzePositions, buildReview, isBad, keyMoments, tipsFor, winPct } from "@/lib/review";
import { annotatedPgn } from "@/lib/export";
import { Captured, MoveTimes, PhasesTable } from "./ReviewParts";
import type { Grade, Review, Runner } from "@/lib/review";
import { MATE_SCORE, analyze, analyzeLines } from "@/lib/engine";
import type { Line } from "@/lib/engine";
import { AnalysisPool, defaultPoolSize, workersSupported } from "@/lib/pool";

const LEELA_NODES = { quick: 60, standard: 300, deep: 1200 }; // search nodes per position
const LEELA_FIRST = 30;    // nodes for the quick first look
const LEELA_PARALLEL = 4;  // requests in flight; the server spreads them over its lc0 processes
const LINE_COLORS = ["#3fa34d", "#3b82d6", "#8b94a0"]; // best, second and third engine line
interface GameItem { title: string; sub: string; pgn: string; user?: string }

export const META: Record<Grade, { label: string; sym: string; color: string; art: string }> = {
  best: { label: "Best", sym: "★", color: "#5b9a4a", art: "the best move" },
  excellent: { label: "Excellent", sym: "!", color: "#6aa84f", art: "an excellent move" },
  good: { label: "Good", sym: "✓", color: "#8fae5a", art: "a good move" },
  book: { label: "Book", sym: "B", color: "#a88761", art: "a book move" },
  inaccuracy: { label: "Inaccuracy", sym: "?!", color: "#e0a526", art: "an inaccuracy" },
  miss: { label: "Miss", sym: "✗", color: "#cf5c8a", art: "a miss" },
  mistake: { label: "Mistake", sym: "?", color: "#e5822b", art: "a mistake" },
  blunder: { label: "Blunder", sym: "??", color: "#ca3431", art: "a blunder" },
};
const GRADES: Grade[] = ["best", "excellent", "good", "book", "inaccuracy", "miss", "mistake", "blunder"];
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
  const [refine, setRefine] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState("");
  const [variation, setVariation] = useState<Move[]>([]);          // moves you tried on the board, on top of the game position
  const [lines, setLines] = useState<Line[] | null>(null);          // engine lines for the position on screen
  const [linesFor, setLinesFor] = useState("");                   // the position (FEN) the lines belong to
  const [linesBusy, setLinesBusy] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [lineArrows, setLineArrows] = useState(true);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const linesPool = useRef<AnalysisPool | null>(null);
  const linesToken = useRef(0);
  const linesWorkers = useRef(true);
  const [showEvals, setShowEvals] = useState(false);                // evaluation next to each move
  const [learn, setLearn] = useState<{ list: number[]; i: number } | null>(null); // 'Learn from your mistakes' session
  const [copied, setCopied] = useState("");

  async function start(pgn: string, who?: string) {
    setErr(""); setRev(null);
    let g: ParsedGame;
    try { g = parsePgn(pgn); } catch (e) { setErr((e as Error).message); return; }
    const id = ++run.current;
    setGame(g); setPly(0); setShowBest(false); setRetry(null); setPlaying(false); setTab("moves"); setLearn(null); setVariation([]);
    setSide(who && (g.headers.Black || "").toLowerCase() === who.toLowerCase() ? "b" : "w");
    setProgress([0, 1]); setRefine(null); setNotice("");
    setUsedEngine(leelaOn ? "Leela" : "built-in engine");
    try {
      if (leelaOn) {
        await runLeela(g, id);
      } else await runBuiltin(g, id);
    } catch (e) {
      if (id !== run.current) return;
      setErr(`${leelaOn ? "Leela stopped responding" : "The analysis failed"} (${(e as Error).message}). ${leelaOn ? "Check Settings, or switch to the built-in engine." : "Please try again."}`);
      setGame(null); setProgress(null); setRefine(null);
    }
  }

  // Leela: a quick first look appears within seconds, then a deeper pass refines it. Requests run in parallel
  // (the server spreads them over several lc0 processes), and the opening moves, which rarely hide mistakes, use fewer nodes.
  async function runLeela(g: ParsedGame, id: number) {
    const cancelled = () => id !== run.current;
    const runner = (nodes: number): Runner => (s, i) => leelaAnalyze(s, i < 8 ? Math.min(nodes, 40) : nodes);
    const first = await analyzePositions(g, runner(speed === "quick" ? LEELA_NODES.quick : LEELA_FIRST), LEELA_PARALLEL, (d, t) => { if (!cancelled()) setProgress([d, t]); }, cancelled);
    if (!first || cancelled()) return;
    setRev(buildReview(g, first)); setProgress(null);
    if (speed === "quick") return;
    setRefine([0, first.length]);
    try {
      const better = await analyzePositions(g, runner(LEELA_NODES[speed]), LEELA_PARALLEL, (d, t) => { if (!cancelled()) setRefine([d, t]); }, cancelled);
      if (better && !cancelled()) setRev(buildReview(g, better));
    } catch {
      if (!cancelled()) setNotice("Leela stopped responding during the deeper pass, so the quick results are shown.");
    }
    setRefine(null);
  }

  // Built-in engine: positions are searched in parallel on Web Workers. A fast first pass shows the
  // review within seconds; a deeper pass then refines the grades in the background.
  async function runBuiltin(g: ParsedGame, id: number) {
    const cancelled = () => id !== run.current;
    const attempt = async (useWorkers: boolean) => {
      const pool = useWorkers && workersSupported() ? new AnalysisPool(defaultPoolSize()) : null;
      const conc = pool ? pool.size : 1;
      const runner = (l: { depth: number; ms: number }): Runner =>
        pool ? (s) => pool.analyze(s, l.depth, l.ms) : async (s) => { await new Promise((r) => setTimeout(r, 0)); return analyze(s, l.depth, l.ms); };
      try {
        const first = await analyzePositions(g, runner(REVIEW_LEVELS.quick), conc, (d, t) => { if (!cancelled()) setProgress([d, t]); }, cancelled);
        if (!first || cancelled()) return;
        setRev(buildReview(g, first)); setProgress(null);
        if (speed === "quick") return;
        setRefine([0, first.length]);
        const better = await analyzePositions(g, runner(REVIEW_LEVELS[speed]), conc, (d, t) => { if (!cancelled()) setRefine([d, t]); }, cancelled);
        if (better && !cancelled()) setRev(buildReview(g, better));
        setRefine(null);
      } finally { pool?.terminate(); }
    };
    try { await attempt(true); }
    catch {
      if (cancelled()) return;
      setNotice("Parallel analysis is not available here, so the review runs on one thread.");
      await attempt(false);
    }
  }

  function reset() { run.current++; setLearn(null); setGame(null); setRev(null); setProgress(null); setRefine(null); setNotice(""); setErr(""); setPlaying(false); }

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
  const go = (p: number) => { setPly(Math.max(0, Math.min(n, p))); setShowBest(false); setRetry(null); setVariation([]); setLearn(null); };
  const isError = (g: Grade) => g === "mistake" || g === "blunder" || g === "miss";
  const errorIdx = (): number[] => (rev ? rev.plies.map((p, i) => (p.mover === side && isError(p.grade) ? i : -1)).filter((i) => i >= 0) : []);
  function jumpMistake(dir: 1 | -1) { // previous / next mistake of the side you are reviewing
    const list = errorIdx(), here = ply - 1;
    const t = dir === 1 ? list.find((i) => i > here) : [...list].reverse().find((i) => i < here);
    if (t !== undefined) go(t + 1);
  }

  useEffect(() => {
    if (!rev) return;
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "TEXTAREA" || t === "INPUT" || t === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowLeft") go(ply - 1);
      else if (e.key === "ArrowRight") go(ply + 1);
      else if (e.key === "Home" || e.key === "ArrowUp") { e.preventDefault(); go(0); }
      else if (e.key === "End" || e.key === "ArrowDown") { e.preventDefault(); go(rev.plies.length); }
      else if (e.key === "Escape") setVariation([]);
      else if (e.key === "f" || e.key === "F") setSide((c) => (c === "w" ? "b" : "w"));
      else if (e.key === "[") jumpMistake(-1);
      else if (e.key === "]") jumpMistake(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPly((p) => { if (p >= n) { setPlaying(false); return p; } setShowBest(false); setRetry(null); setVariation([]); setLearn(null); return p + 1; }), 1100);
    return () => clearInterval(id);
  }, [playing, n]);

  useEffect(() => { listRef.current?.querySelector(".cur")?.scrollIntoView({ block: "nearest" }); }, [ply, tab]);

  // Engine lines: analyse the position on screen (the game position, or the line you are exploring).
  useEffect(() => {
    if (!rev || !game || !showLines || retry || showBest) return;
    let target = game.states[ply];
    for (const m of variation) target = makeMove(target, m);
    const token = ++linesToken.current;
    setLines(null); setLinesBusy(true);
    const timer = setTimeout(async () => {
      try {
        let res: Line[];
        if (linesWorkers.current && workersSupported()) {
          if (!linesPool.current) linesPool.current = new AnalysisPool(2);
          linesPool.current.clearQueue();
          res = await linesPool.current.lines(target, 6, 1200, 3);
        } else res = analyzeLines(target, 5, 800, 3);
        if (token === linesToken.current) { setLines(res); setLinesFor(toFen(target)); setLinesBusy(false); }
      } catch {
        if (token !== linesToken.current) return;
        linesWorkers.current = false; linesPool.current?.terminate(); linesPool.current = null;
        setLines(analyzeLines(target, 4, 500, 3)); setLinesFor(toFen(target)); setLinesBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [rev, game, ply, variation, showLines, retry, showBest]);
  useEffect(() => () => { linesPool.current?.terminate(); }, []);

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
            <option value="quick">{leelaOn ? "Quick: 60 nodes per move" : "Quick: about 3 seconds"}</option>
            <option value="standard">{leelaOn ? "Standard: quick look, then 300 nodes per move" : "Standard: first look in seconds, refined in under a minute"}</option>
            <option value="deep">{leelaOn ? "Deeper: quick look, then 1200 nodes per move" : "Deeper: first look in seconds, refined over a few minutes"}</option>
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
  const times = moveTimes(game);
  const hasClocks = game.clocks.some((c) => c != null);
  const tc = timeControl(game.headers);
  const finalOpening = [...rev.opening.names].reverse().find(Boolean) ?? null;
  const openingNow = (ply > 0 ? rev.opening.names[Math.min(ply, rev.opening.names.length) - 1] : null) ?? finalOpening;
  const fmtClock = (v: number | null) => v == null ? "" : v >= 3600 ? `${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(v % 60)).padStart(2, "0")}` : v < 20 ? `${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, "0")}` : `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;

  // "Learn from your mistakes": step through your errors and find a better move for each
  function startLearn() {
    const list = errorIdx().filter((i) => rev!.plies[i].best);
    if (!list.length) return;
    setLearn({ list, i: 0 }); setTab("moves"); setPly(list[0] + 1); setShowBest(false); setVariation([]); setRetry({ ply: list[0] + 1 });
  }
  function nextLearn() {
    if (!learn) return;
    const ni = learn.i + 1;
    if (ni >= learn.list.length) { setLearn(null); setRetry(null); return; }
    setLearn({ ...learn, i: ni }); setPly(learn.list[ni] + 1); setRetry({ ply: learn.list[ni] + 1 });
  }
  function showAnswer() {
    if (!retry) return;
    const best = rev!.plies[retry.ply - 1].best;
    if (best) setRetry({ ply: retry.ply, move: best });
  }

  // export
  async function copyText(t: string, label: string) {
    try { await navigator.clipboard.writeText(t); setCopied(label); } catch { setCopied("Copy failed"); }
    setTimeout(() => setCopied(""), 1600);
  }
  function downloadPgn() {
    const blob = new Blob([annotatedPgn(game!, rev!)], { type: "application/x-chess-pgn" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${game!.headers.White || "white"}-vs-${game!.headers.Black || "black"}.pgn`.replace(/[^\w.-]+/g, "_");
    a.click();
    URL.revokeObjectURL(a.href);
  }

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
  const exploring = !retry && !(showBest && cur && ply > 0);
  let curLines: Line[] | null = null; // engine lines, only if they belong to the position on screen
  if (exploring) {
    if (variation.length) {
      let s2 = game.states[ply];
      for (const m of variation) s2 = makeMove(s2, m);
      boardState = s2; lastMove = variation[variation.length - 1]; badge = null;
    }
    movable = boardState.turn; // you can move the pieces yourself to explore
    curLines = lines && linesFor === toFen(boardState) ? lines : null;
    if (showLines && lineArrows && curLines) curLines.forEach((l, k) => { if (hoverLine === null || hoverLine === k) arrows.push({ from: l.move.from, to: l.move.to, color: LINE_COLORS[k] }); });
  }

  // text of the variation on screen
  let varText = "";
  if (variation.length) {
    let s3 = game.states[ply]; const parts: string[] = [];
    for (const m of variation) { parts.push((s3.turn === "w" ? `${s3.full}. ` : parts.length === 0 ? `${s3.full}… ` : "") + toSan(s3, m)); s3 = makeMove(s3, m); }
    varText = parts.join(" ");
  }
  const lineEval = (score: number, turn: Color) => {
    const w = turn === "w" ? score : -score;
    if (Math.abs(score) > 90000) return `${w > 0 ? "" : "-"}M${Math.ceil((MATE_SCORE - Math.abs(score) + 1) / 2)}`;
    return `${w > 0 ? "+" : ""}${(w / 100).toFixed(2)}`;
  };
  const lineTokens = (l: Line) => {
    let c = boardState; const out: string[] = [];
    l.pv.forEach((m, j) => { out.push((c.turn === "w" ? `${c.full}. ` : j === 0 ? `${c.full}… ` : "") + toSan(c, m)); c = makeMove(c, m); });
    return out;
  };
  const playLine = (l: Line, j: number) => setVariation((v) => [...v, ...l.pv.slice(0, j + 1)]);

  function onRetryMove(m: Move) {
    if (!retry) { setVariation((v) => [...v, m]); return; } // a move you play yourself

    const best = rev!.plies[retry.ply - 1].best;
    if (sameMove(best, m)) setRetry({ ply: retry.ply, move: m });
    else setRetry({ ply: retry.ply, wrong: true });
  }

  let win = rev.winPct[ply];
  let label = evalLabel(rev.cp[ply]);
  if (exploring && variation.length && curLines && curLines.length) { // the bar follows the line you are exploring
    const w = boardState.turn === "w" ? curLines[0].score : -curLines[0].score;
    win = winPct(w); label = evalLabel(w);
  }
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
    const g = rev.plies[i].grade, showSym = g === "best" || g === "book" || isBad(g);
    return (
      <button className={`mv${ply === i + 1 ? " cur" : ""}`} onClick={() => go(i + 1)}>
        {showSym && <span className="msym" style={{ color: META[g].color }}>{META[g].sym}</span>}{rev.plies[i].san}
        {showEvals && <span className="meval">{evalLabel(rev.cp[i + 1])}</span>}
      </button>
    );
  };

  // coach message
  let coach: { title: string; body: string[]; color?: string };
  if (retry) {
    const p = rev.plies[retry.ply - 1];
    const head = learn ? `Learn from your mistakes · ${learn.i + 1} of ${learn.list.length}` : null;
    coach = retry.move ? { title: "Correct!", body: [`${p.bestSan} is the engine's choice here.`], color: META.best.color }
      : retry.wrong ? { title: "Not quite", body: ["That is not the engine's move. Try another one."], color: META.mistake.color }
      : { title: head ?? `Your turn: find a better move than ${p.san}`, body: head ? [`In the game you played ${p.san}${p.note ? ". " + p.note : "."} Find a better move.`] : ["Move a piece on the board."] };
  } else if (!cur) {
    coach = { title: "Ready to review", body: ["Press Next, use the arrow keys, or jump to a key moment in Insights."] };
  } else {
    const body: string[] = [];
    if (cur.grade === "book") { const nm = rev.opening.names[ply - 1]; if (nm) body.push(nm); }
    if (cur.note) body.push(cur.note);
    if (cur.grade !== "best" && cur.grade !== "book" && cur.bestSan) body.push(`Best was ${cur.bestSan}.`);
    coach = { title: `${cur.san} is ${META[cur.grade].art}`, body, color: META[cur.grade].color };
  }

  if (exploring && variation.length) coach = { title: "Exploring a line", body: [varText, "Click engine moves or move the pieces. Press Esc or Back to return to the game."] };

  const accBox = (c: Color) => (
    <div className={"accbox " + c}>
      <span className="accnum">{rev.accuracy[c].toFixed(1)}</span>
      <span className="accwho">{who(c)}</span>
    </div>
  );
  const strip = (c: Color) => {
    const elo = game.headers[c === "w" ? "WhiteElo" : "BlackElo"];
    const clock = hasClocks ? clockAt(game, c, ply) : null;
    return (
      <div className="pstrip">
        <span className={"pdot " + c} />
        <strong>{who(c)}</strong>
        {elo && elo !== "?" && <span className="muted">({elo})</span>}
        <Captured state={boardState} color={c} />
        <span className="pright">
          {clock != null && <span className={"clock" + (boardState.turn === c ? " on" : "")}>{fmtClock(clock)}</span>}
          <span className="pacc">{rev.accuracy[c].toFixed(0)}%</span>
        </span>
      </div>
    );
  };

  return (
    <div className="rv">
      <div className="rv-left">
        {strip(opp)}
        <div className="boardrow">
          <EvalBar win={win} label={label} whiteAtBottom={side === "w"} />
          <Board state={boardState} orientation={side} movable={movable} onMove={onRetryMove} lastMove={lastMove} arrows={arrows} badge={badge} drawable drawMode={drawMode} />
        </div>
        {strip(side)}
        <div className="controls">
          <button className="btn small" onClick={() => go(0)} disabled={ply === 0} aria-label="Start">⏮</button>
          <button className="btn small" onClick={() => go(ply - 1)} disabled={ply === 0} aria-label="Previous move">◀</button>
          <button className="btn small" onClick={() => setPlaying(!playing)} disabled={ply === n && !playing}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
          <button className="btn small" onClick={() => go(ply + 1)} disabled={ply === n} aria-label="Next move">▶</button>
          <button className="btn small" onClick={() => go(n)} disabled={ply === n} aria-label="End">⏭</button>
          <button className="btn small" onClick={() => setSide(opp)} title="Flip the board (F)">Flip</button>
          <button className="btn small" onClick={() => jumpMistake(-1)} title="Previous mistake ([)">‹ Mistake</button>
          <button className="btn small" onClick={() => jumpMistake(1)} title="Next mistake (])">Mistake ›</button>
          <button className={"btn small" + (drawMode ? " primary" : "")} aria-pressed={drawMode} onClick={() => setDrawMode(!drawMode)} title="Draw arrows with the left mouse button or a finger">✎ Draw</button>
        </div>
        <Graph rev={rev} ply={ply} onPick={go} label={(i) => (i === 0 ? "Start" : `${moveNo(i - 1)} ${rev.plies[i - 1].san}  ${evalLabel(rev.cp[i])}`)} />
        {hasClocks && <MoveTimes times={times} ply={ply} onPick={go} />}
        <p className="muted small-note">Draw on the board: right-click and drag for an arrow, right-click a square for a circle (Shift = red, Ctrl = blue, Alt = yellow). Keys: ← → step, Home/End, F flip, [ ] previous/next mistake, Esc leave a line.</p>
      </div>

      <div className="rv-right">
        {refine && (
          <div className="refine" role="status">
            <span>Refining the analysis… {Math.round((refine[0] / refine[1]) * 100)}%</span>
            <progress value={refine[0]} max={refine[1]} />
            <span className="muted">You can already browse the game. Grades may change slightly when this finishes.</span>
          </div>
        )}
        {notice && <p className="muted">{notice}</p>}
        <div className="rv-head">
          <h1>Game Review</h1>
          <p className="muted">{who("w")} vs {who("b")}{game.headers.Result ? ` · ${game.headers.Result}` : ""}</p>
          {openingNow && <p className="opening"><span aria-hidden="true">📖</span> {openingNow}</p>}
          <p className="muted small-note">{[tc ? `${Math.round((tc.base / 60) * 10) / 10} min${tc.inc ? ` + ${tc.inc} s` : ""}` : "", game.headers.Date && !game.headers.Date.includes("?") ? game.headers.Date.replace(/\./g, "-") : "", game.headers.Termination ?? ""].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="accrow">{accBox("w")}{accBox("b")}</div>

        <div className="coach" style={coach.color ? { borderLeftColor: coach.color } : undefined}>
          <div className="coach-title" style={coach.color ? { color: coach.color } : undefined}>
            {cur && !retry && !variation.length && <span className="cbadge" style={{ background: META[cur.grade].color }}>{META[cur.grade].sym}</span>}
            {coach.title}
          </div>
          {coach.body.map((t, i) => <p key={i}>{t}</p>)}
          <div className="coach-btns">
            {cur && !retry && !variation.length && cur.grade !== "best" && cur.grade !== "book" && cur.best && (
              <button className="btn small" onClick={() => setShowBest(!showBest)}>{showBest ? "Hide best move" : "Show best move"}</button>
            )}
            {cur && !retry && !variation.length && isBad(cur.grade) && cur.best && (
              <button className="btn small primary" onClick={() => { setShowBest(false); setRetry({ ply }); }}>Retry</button>
            )}
            {retry && !learn && <button className="btn small" onClick={() => setRetry(null)}>{retry.move ? "Continue" : "Give up"}</button>}
            {retry && learn && (
              <>
                {retry.move
                  ? <button className="btn small primary" onClick={nextLearn}>{learn.i + 1 >= learn.list.length ? "Finish" : "Next mistake"}</button>
                  : (<><button className="btn small" onClick={showAnswer}>Show answer</button><button className="btn small" onClick={nextLearn}>Skip</button></>)}
                <button className="btn small" onClick={() => { setLearn(null); setRetry(null); }}>Exit</button>
              </>
            )}
            {variation.length > 0 && !retry && (
              <>
                <button className="btn small primary" onClick={() => setVariation([])}>Back to game</button>
                <button className="btn small" onClick={() => setVariation((v) => v.slice(0, -1))}>Take back a move</button>
              </>
            )}
          </div>
        </div>

        <section className="lines card" aria-label="Engine lines">
          <div className="lines-head">
            <h2>Engine lines</h2>
            <label className="chk"><input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} /> Show</label>
            {showLines && <label className="chk"><input type="checkbox" checked={lineArrows} onChange={(e) => setLineArrows(e.target.checked)} /> Arrows</label>}
          </div>
          {showLines && (retry || (showBest && cur)) && <p className="muted">Lines are hidden while you retry a move or view the previous position.</p>}
          {showLines && !retry && !(showBest && cur) && (
            <>
              {!curLines && linesBusy && <p className="muted">Analysing this position…</p>}
              {curLines && curLines.length === 0 && <p className="muted">There are no moves here: the game is over.</p>}
              {curLines?.map((l, k) => (
                <div key={k} className={"lline" + (k === 0 ? " top" : "")} onMouseEnter={() => setHoverLine(k)} onMouseLeave={() => setHoverLine(null)}>
                  <span className={"leval " + ((boardState.turn === "w" ? l.score : -l.score) >= 0 ? "w" : "b")}>{lineEval(l.score, boardState.turn)}</span>
                  <span className="lmoves">
                    {lineTokens(l).map((t, j) => <button key={j} className="lm" onClick={() => playLine(l, j)} title="Play this line on the board">{t}</button>)}
                  </span>
                </div>
              ))}
              <p className="muted small-note">Built-in engine, depth 6. Click a move to play the line on the board, or move the pieces yourself.</p>
            </>
          )}
        </section>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "moves"} className={tab === "moves" ? "on" : ""} onClick={() => setTab("moves")}>Moves</button>
          <button role="tab" aria-selected={tab === "insights"} className={tab === "insights" ? "on" : ""} onClick={() => setTab("insights")}>Insights</button>
        </div>

        {tab === "moves" ? (
          <>
            <div className="mtool">
              <label className="chk"><input type="checkbox" checked={showEvals} onChange={(e) => setShowEvals(e.target.checked)} /> Show evaluations</label>
            </div>
            <div className="movelist tall" ref={listRef} aria-label="Moves">
              {rows.map((r) => <div key={r.n + "-" + (r.w ?? r.b)} className="mrow"><span className="mn">{r.n}.</span>{mv(r.w)}{mv(r.b)}</div>)}
            </div>
            <div className="export">
              <button className="btn small" onClick={() => copyText(annotatedPgn(game, rev), "PGN copied")}>Copy PGN</button>
              <button className="btn small" onClick={downloadPgn}>Download PGN</button>
              <button className="btn small" onClick={() => copyText(toFen(boardState), "FEN copied")}>Copy FEN</button>
              <button className="btn small" onClick={() => { try { localStorage.setItem("openfile-analysis-import", JSON.stringify({ pgn: annotatedPgn(game, rev), ply })); } catch { /* ignore */ } window.location.href = "/analysis"; }}>Open in analysis board</button>
              {copied && <span className="good" role="status">{copied}</span>}
            </div>
          </>
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
                <tr className="sumrow"><td>Average centipawn loss</td><td>{rev.acpl.w.toFixed(0)}</td><td>{rev.acpl.b.toFixed(0)}</td></tr>
              </tbody>
            </table>
            <PhasesTable phases={rev.phases} names={[who("w"), who("b")]} />
            <div className="segment" role="group" aria-label="Review as">
              <span>Advice for</span>
              <button className={side === "w" ? "on" : ""} onClick={() => setSide("w")}>{who("w")}</button>
              <button className={side === "b" ? "on" : ""} onClick={() => setSide("b")}>{who("b")}</button>
            </div>
            <button className="btn small primary learnbtn" disabled={errorIdx().filter((i) => rev.plies[i].best).length === 0} onClick={startLearn}>
              Learn from your mistakes ({errorIdx().filter((i) => rev.plies[i].best).length})
            </button>
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

function Graph({ rev, ply, onPick, label }: { rev: Review; ply: number; onPick: (p: number) => void; label: (i: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = rev.winPct, n = data.length - 1;
  const x = (i: number) => (n === 0 ? 0 : (i / n) * 600);
  const idxAt = (e: React.MouseEvent<SVGSVGElement>) => { const b = e.currentTarget.getBoundingClientRect(); return Math.max(0, Math.min(n, Math.round(((e.clientX - b.left) / b.width) * n))); };
  const pts = data.map((w, i) => `${x(i).toFixed(1)},${(100 - w).toFixed(1)}`).join(" ");
  return (
    <div className="graphwrap">
      <svg className="graph" viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label="Evaluation graph"
        onClick={(e) => onPick(idxAt(e))} onMouseMove={(e) => setHover(idxAt(e))} onMouseLeave={() => setHover(null)}>
        <rect width="600" height="100" fill="#2b3541" />
        <polygon points={`0,100 ${pts} 600,100`} fill="#f4f6f8" />
        <line x1="0" x2="600" y1="50" y2="50" stroke="#8a97a5" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2="100" stroke="#8a97a5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        <line x1={x(ply)} x2={x(ply)} y1="0" y2="100" stroke="#3a4fd7" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      {hover !== null && <div className="gtip" style={{ left: `${(hover / Math.max(1, n)) * 100}%` }}>{label(hover)}</div>}
      {rev.plies.map((p, i) => isBad(p.grade) && p.grade !== "inaccuracy" ? (
        <button key={i} className="gdot" aria-label={`${META[p.grade].label}: ${p.san}`} title={`${p.san}: ${META[p.grade].label}`}
          style={{ left: `${((i + 1) / n) * 100}%`, top: `${100 - data[i + 1]}%`, background: META[p.grade].color }} onClick={() => onPick(i + 1)} />
      ) : null)}
    </div>
  );
}
