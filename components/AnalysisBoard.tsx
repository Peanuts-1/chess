"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import Board from "./Board";
import type { Arrow } from "./Board";
import { Captured } from "./ReviewParts";
import { META } from "./ReviewApp";
import { useSettings } from "./Settings";
import { START_FEN, inCheck, makeMove, moveFromUci, parseFen, status, toFen, toSan } from "@/lib/chess";
import type { Color, Move, State } from "@/lib/chess";
import { MATE_SCORE, analyzeLines } from "@/lib/engine";
import type { Line } from "@/lib/engine";
import { engineLines } from "@/lib/engines";
import { AnalysisPool, workersSupported } from "@/lib/pool";
import { addMove, createTree, fromGame, mainEnd, pathTo, regrade, removeNode, toPgn, uciOf } from "@/lib/analysisTree";
import type { Tree } from "@/lib/analysisTree";
import { parsePgn } from "@/lib/pgn";
import { detectOpening } from "@/lib/openings";
import { winPct } from "@/lib/review";

type EngineKey = "stockfish" | "leela" | "builtin";
const KEYS: EngineKey[] = ["stockfish", "leela", "builtin"];
const LABEL: Record<EngineKey, string> = { stockfish: "Stockfish", leela: "Leela (lc0)", builtin: "Built-in engine" };
const COLOR: Record<EngineKey, string> = { stockfish: "#3fa34d", leela: "#3b82d6", builtin: "#8b94a0" };
const LINE_COLORS = ["#3fa34d", "#3b82d6", "#8b94a0", "#e0b42a", "#cf5c8a"];

// Each engine searches in stages, so the first answer appears quickly and then gets deeper.
interface Stage { depth?: number; nodes?: number; ms?: number }
const STAGES: Record<EngineKey, Stage[]> = {
  builtin: [{ depth: 4, ms: 250 }, { depth: 7, ms: 1200 }, { depth: 10, ms: 4000 }],
  leela: [{ nodes: 40 }, { nodes: 300 }, { nodes: 2000 }],
  stockfish: [{ depth: 10 }, { depth: 16 }, { depth: 20 }],
};
const stageLabel = (st: Stage) => (st.nodes ? `${st.nodes} nodes` : `depth ${st.depth}`);

interface EngResult { fen: string; lines: Line[] | null; label: string; busy: boolean; error?: string }
const EMPTY: EngResult = { fen: "", lines: null, label: "", busy: false };
const KEY = "openfile-analysis";

const fmtWhite = (w: number) =>
  Math.abs(w) > 90000 ? `${w > 0 ? "" : "-"}M${Math.ceil((MATE_SCORE - Math.abs(w) + 1) / 2)}` : `${w > 0 ? "+" : ""}${(w / 100).toFixed(2)}`;
const toWhite = (score: number, turn: Color) => (turn === "w" ? score : -score);

function pvTokens(base: State, l: Line): string[] {
  let c = base;
  const out: string[] = [];
  l.pv.forEach((m, j) => { out.push((c.turn === "w" ? `${c.full}. ` : j === 0 ? `${c.full}… ` : "") + toSan(c, m)); c = makeMove(c, m); });
  return out;
}
function validateFen(fen: string): string | null {
  try {
    const s = parseFen(fen);
    if (s.board.length !== 64) return "That FEN does not describe 64 squares.";
    if (s.board.filter((p) => p === "K").length !== 1 || s.board.filter((p) => p === "k").length !== 1) return "Each side needs exactly one king.";
    if (inCheck(s, s.turn === "w" ? "b" : "w")) return "The side that is not to move cannot be in check.";
    return null;
  } catch { return "Could not read that FEN."; }
}

function EvalBar({ win, label, whiteAtBottom }: { win: number; label: string; whiteAtBottom: boolean }) {
  const whiteAhead = win >= 50, atBottom = whiteAhead === whiteAtBottom;
  return (
    <div className="evalbar" role="img" aria-label={`Evaluation ${label} for White`}>
      <div className={"ebfill " + (whiteAtBottom ? "fromBottom" : "fromTop")} style={{ height: `${win}%` }} />
      <span className={"eblabel " + (atBottom ? "bottom" : "top") + (whiteAhead ? " onwhite" : " onblack")}>{label}</span>
    </div>
  );
}

export default function AnalysisBoard() {
  const { leela, stockfish, checkLeela, checkStockfish } = useSettings();
  const treeRef = useRef<Tree>(createTree(START_FEN));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [cur, setCur] = useState(0);
  const [side, setSide] = useState<Color>("w");
  const [on, setOn] = useState<Record<EngineKey, boolean>>({ builtin: true, leela: false, stockfish: false });
  const [multipv, setMultipv] = useState(3);
  const [paused, setPaused] = useState(false);
  const [lineArrows, setLineArrows] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [results, setResults] = useState<Record<EngineKey, EngResult>>({ builtin: EMPTY, leela: EMPTY, stockfish: EMPTY });
  const [fenText, setFenText] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [loaded, setLoaded] = useState(false);
  const tokens = useRef<Record<EngineKey, number>>({ builtin: 0, leela: 0, stockfish: 0 });
  const pool = useRef<AnalysisPool | null>(null);
  const poolOk = useRef(true);

  const tree = treeRef.current;
  const node = tree.nodes[cur];
  const fen = toFen(node.state);
  const ready: Record<EngineKey, boolean> = { builtin: true, leela: leela.status === "ready", stockfish: stockfish.status === "ready" };
  const active = KEYS.filter((k) => on[k] && ready[k]);

  // ---------- load saved choices, engine status, and anything handed over from the Review page ----------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) { const j = JSON.parse(saved); if (j.on) setOn((o) => ({ ...o, ...j.on })); if (j.multipv) setMultipv(j.multipv); if (typeof j.lineArrows === "boolean") setLineArrows(j.lineArrows); }
      const raw = localStorage.getItem("openfile-analysis-import");
      if (raw) { localStorage.removeItem("openfile-analysis-import"); const { pgn, ply } = JSON.parse(raw); loadPgn(pgn, ply); }
      else { const f = new URLSearchParams(window.location.search).get("fen"); if (f) setPosition(f); }
    } catch { /* ignore */ }
    if (leela.status === "idle") checkLeela();
    if (stockfish.status === "idle") checkStockfish();
    setLoaded(true);
    return () => { pool.current?.terminate(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify({ on, multipv, lineArrows })); } catch { /* ignore */ } }, [on, multipv, lineArrows, loaded]);

  // ---------- the tree ----------
  function replaceTree(t: Tree, at: number) {
    treeRef.current = t;
    setCur(at);
    setResults({ builtin: EMPTY, leela: EMPTY, stockfish: EMPTY });
    bump();
  }
  function setPosition(text: string) {
    const bad = validateFen(text.trim());
    if (bad) { setErr(bad); return; }
    setErr("");
    replaceTree(createTree(text.trim()), 0);
  }
  function loadPgn(text: string, ply = 0) {
    try {
      const t = fromGame(parsePgn(text));
      const line = pathTo(t, mainEnd(t, 0));
      setErr("");
      replaceTree(t, line[Math.max(0, Math.min(ply, line.length - 1))]);
    } catch (e) { setErr((e as Error).message); }
  }
  function play(m: Move) { const id = addMove(treeRef.current, cur, m); setCur(id); bump(); }
  function playLine(lines: Line[], li: number, j: number) {
    let c = cur;
    for (const m of lines[li].pv.slice(0, j + 1)) c = addMove(treeRef.current, c, m);
    setCur(c); bump();
  }
  const back = () => { if (node.parent !== null) setCur(node.parent); };
  const forward = () => { if (node.children.length) setCur(node.children[0]); };
  function removeHere() { if (cur === 0) return; setCur(removeNode(treeRef.current, cur)); bump(); }
  async function copyText(t: string, label: string) {
    try { await navigator.clipboard.writeText(t); setCopied(label); } catch { setCopied("Copy failed"); }
    setTimeout(() => setCopied(""), 1600);
  }

  // ---------- engines ----------
  async function search(k: EngineKey, s: State, st: Stage): Promise<Line[]> {
    if (k === "builtin") {
      if (poolOk.current && workersSupported()) {
        try { if (!pool.current) pool.current = new AnalysisPool(1); return await pool.current.lines(s, st.depth!, st.ms!, multipv); }
        catch { poolOk.current = false; pool.current?.terminate(); pool.current = null; }
      }
      return analyzeLines(s, Math.min(st.depth!, 7), Math.min(st.ms!, 1500), multipv); // fallback on the page's own thread
    }
    return engineLines(k, s, { ...(st.nodes ? { nodes: st.nodes } : { depth: st.depth }), multipv });
  }
  async function runEngine(k: EngineKey, s: State, f: string, token: number) {
    const live = () => tokens.current[k] === token;
    if (k === "builtin") { pool.current?.terminate(); pool.current = null; } // stop a search for a position we have left
    setResults((r) => ({ ...r, [k]: { ...r[k], fen: f, lines: r[k].fen === f ? r[k].lines : null, busy: true, error: undefined } }));
    await new Promise((r) => setTimeout(r, 200)); // let quick navigation settle
    if (!live()) return;
    const stages = STAGES[k];
    try {
      for (let i = 0; i < stages.length; i++) {
        const lines = await search(k, s, stages[i]);
        if (!live()) return;
        setResults((r) => ({ ...r, [k]: { fen: f, lines, label: stageLabel(stages[i]), busy: i < stages.length - 1 } }));
      }
    } catch (e) {
      if (live()) setResults((r) => ({ ...r, [k]: { ...r[k], busy: false, error: (e as Error).message } }));
    }
  }
  useEffect(() => {
    if (paused) return;
    const s = treeRef.current.nodes[cur].state;
    for (const k of active) runEngine(k, s, fen, ++tokens.current[k]);
    return () => { for (const k of KEYS) tokens.current[k]++; };
  }, [fen, JSON.stringify(on), ready.leela, ready.stockfish, multipv, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // the engine we trust most that has an answer for this position
  const primary = KEYS.find((k) => on[k] && ready[k] && results[k].fen === fen && results[k].lines && results[k].lines!.length) ?? null;
  const primaryLines = primary ? results[primary].lines : null;

  // remember evaluations on the tree so every move can be graded
  useEffect(() => {
    const t = treeRef.current, n = t.nodes[cur];
    let w: number | null = null, best: string | undefined;
    if (primaryLines && primaryLines.length) { w = toWhite(primaryLines[0].score, n.state.turn); best = uciOf(primaryLines[0].move); }
    else { const s = status(n.state); if (s.over) w = s.result === "draw" ? 0 : s.result === "w" ? MATE_SCORE : -MATE_SCORE; }
    if (w === null) return;
    let changed = n.evalCp !== w || n.bestUci !== best;
    n.evalCp = w; n.bestUci = best;
    changed = regrade(t, cur) || changed;
    for (const c of n.children) changed = regrade(t, c) || changed;
    if (changed) bump();
  }, [primaryLines, cur]);

  // ---------- keyboard ----------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "TEXTAREA" || t === "INPUT" || t === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowLeft") back();
      else if (e.key === "ArrowRight") forward();
      else if (e.key === "Home" || e.key === "ArrowUp") { e.preventDefault(); setCur(0); }
      else if (e.key === "End" || e.key === "ArrowDown") { e.preventDefault(); setCur(mainEnd(treeRef.current, cur)); }
      else if (e.key === "f" || e.key === "F") setSide((c) => (c === "w" ? "b" : "w"));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // ---------- what to show ----------
  const st = status(node.state);
  const names = tree.rootFen === START_FEN ? detectOpening(pathTo(tree, cur).map((id) => tree.nodes[id].state)).names : [];
  const opening = [...names].reverse().find(Boolean) ?? null;
  const evalW = primaryLines ? toWhite(primaryLines[0].score, node.state.turn) : node.evalCp ?? 0;
  const win = winPct(evalW), evalLabel = primary || st.over ? fmtWhite(evalW) : "0.00";

  const arrows: Arrow[] = [];
  if (lineArrows) {
    const have = active.filter((k) => results[k].fen === fen && results[k].lines && results[k].lines!.length);
    if (have.length === 1) results[have[0]].lines!.forEach((l, i) => arrows.push({ from: l.move.from, to: l.move.to, color: LINE_COLORS[i] }));
    else have.forEach((k) => { const l = results[k].lines![0]; arrows.push({ from: l.move.from, to: l.move.to, color: COLOR[k] }); });
  }

  // do the engines agree?
  const tops = active.filter((k) => results[k].fen === fen && results[k].lines && results[k].lines!.length).map((k) => ({ k, line: results[k].lines![0] }));
  let agree = "";
  if (tops.length >= 2) {
    const sans = tops.map((t) => ({ k: t.k, san: toSan(node.state, t.line.move), ev: fmtWhite(toWhite(t.line.score, node.state.turn)) }));
    agree = sans.every((x) => x.san === sans[0].san)
      ? `The engines agree: ${sans[0].san} is best.`
      : "They disagree: " + sans.map((x) => `${LABEL[x.k]} prefers ${x.san} (${x.ev})`).join(", ") + ".";
  }

  const parent = node.parent !== null ? tree.nodes[node.parent] : null;
  const bestSan = parent && parent.bestUci && node.move && node.grade && node.grade !== "best"
    ? (() => { const m = moveFromUci(parent.state, parent.bestUci); return m ? toSan(parent.state, m) : ""; })() : "";

  const moveBtn = (id: number, force: boolean) => {
    const n = tree.nodes[id], before = tree.nodes[n.parent as number].state;
    const num = before.turn === "w" ? `${before.full}.` : force ? `${before.full}…` : "";
    return (
      <span key={id}>
        {num && <span className="mn">{num}</span>}
        <button className={"tm" + (id === cur ? " cur" : "")} onClick={() => setCur(id)}>
          {n.grade && <span className="msym" style={{ color: META[n.grade].color }}>{META[n.grade].sym}</span>}{n.san}
        </button>
      </span>
    );
  };
  const renderLine = (parentId: number, force: boolean): React.ReactNode[] => {
    const p = tree.nodes[parentId];
    if (!p.children.length) return [];
    const [main, ...vars] = p.children;
    const out: React.ReactNode[] = [moveBtn(main, force)];
    vars.forEach((v) => out.push(<span key={"v" + v} className="tvar">({moveBtn(v, true)}{renderLine(v, false)})</span>));
    out.push(...renderLine(main, vars.length > 0));
    return out;
  };

  const strip = (c: Color) => (
    <div className="pstrip">
      <span className={"pdot " + c} />
      <strong>{c === "w" ? "White" : "Black"}</strong>
      {node.state.turn === c && !st.over && <span className="chip static">to move</span>}
      <Captured state={node.state} color={c} />
    </div>
  );
  const statusText = (k: EngineKey) =>
    k === "builtin" ? "always available"
    : (k === "leela" ? leela : stockfish).status === "ready" ? "connected"
    : (k === "leela" ? leela : stockfish).status === "checking" ? "checking…"
    : (k === "leela" ? leela : stockfish).status === "missing" ? "not connected" : "…";

  return (
    <div className="an">
      <div className="an-left">
        {strip(side === "w" ? "b" : "w")}
        <div className="boardrow">
          <EvalBar win={win} label={evalLabel} whiteAtBottom={side === "w"} />
          <Board state={node.state} orientation={side} movable="both" onMove={play} lastMove={node.move} arrows={arrows} drawable drawMode={drawMode} />
        </div>
        {strip(side)}
        <div className="controls">
          <button className="btn small" onClick={() => setCur(0)} disabled={cur === 0} aria-label="Start">⏮</button>
          <button className="btn small" onClick={back} disabled={node.parent === null} aria-label="Back">◀</button>
          <button className="btn small" onClick={forward} disabled={!node.children.length} aria-label="Forward">▶</button>
          <button className="btn small" onClick={() => setCur(mainEnd(tree, cur))} disabled={!node.children.length} aria-label="End">⏭</button>
          <button className="btn small" onClick={() => setSide(side === "w" ? "b" : "w")} title="Flip the board (F)">Flip</button>
          <button className={"btn small" + (drawMode ? " primary" : "")} aria-pressed={drawMode} onClick={() => setDrawMode(!drawMode)} title="Draw arrows with the left mouse button or a finger">✎ Draw</button>
          <button className="btn small" onClick={removeHere} disabled={cur === 0} title="Delete this move and everything after it">Delete move</button>
        </div>
        <p className="muted small-note">Move any piece for either side. Right-click and drag draws arrows (Shift red, Ctrl blue, Alt yellow). Keys: ← → step, Home/End, F flip.</p>
      </div>

      <div className="an-right">
        <section className="card">
          <h1 className="an-title">Analysis board</h1>
          {opening && <p className="opening"><span aria-hidden="true">📖</span> {opening}</p>}
          {st.over && <p className="bad">{st.reason}{st.result && st.result !== "draw" ? `: ${st.result === "w" ? "White" : "Black"} wins` : ""}.</p>}
          {node.grade && node.move && (
            <p className="an-fb">
              <span className="cbadge" style={{ background: META[node.grade].color }}>{META[node.grade].sym}</span>{" "}
              {node.san} is {META[node.grade].art}.{bestSan ? ` The engine preferred ${bestSan}.` : ""}
            </p>
          )}
          {agree && <p className="muted">{agree}</p>}
        </section>

        <section className="card an-eng">
          <h2>Engines</h2>
          {KEYS.map((k) => (
            <label key={k} className="chk engrow">
              <input type="checkbox" checked={on[k]} disabled={!ready[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
              <span className="dotc" style={{ background: COLOR[k] }} />
              <span>{LABEL[k]}</span>
              <span className="muted">{statusText(k)}</span>
            </label>
          ))}
          {(!ready.leela || !ready.stockfish) && <p className="muted small-note">Connect Leela and Stockfish in <a href="/settings">Settings</a>; they run on your computer.</p>}
          <div className="row">
            <label className="chk">Lines
              <select value={multipv} onChange={(e) => setMultipv(+e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <label className="chk"><input type="checkbox" checked={lineArrows} onChange={(e) => setLineArrows(e.target.checked)} /> Arrows</label>
            <button className="btn small" onClick={() => setPaused(!paused)}>{paused ? "Resume analysis" : "Pause analysis"}</button>
            <button className="btn small" onClick={() => { checkLeela(); checkStockfish(); }}>Check engines</button>
          </div>
        </section>

        {active.length === 0 && <p className="muted">Turn on at least one engine to see its lines.</p>}
        {paused && active.length > 0 && <p className="muted">Analysis is paused.</p>}
        {!paused && active.map((k) => {
          const r = results[k], valid = r.fen === fen && r.lines;
          return (
            <section key={k} className="card an-panel" style={{ borderTopColor: COLOR[k] }}>
              <div className="an-phead">
                <strong>{LABEL[k]}</strong>
                {valid && r.lines!.length > 0 && <span className={"leval " + (toWhite(r.lines![0].score, node.state.turn) >= 0 ? "w" : "b")}>{fmtWhite(toWhite(r.lines![0].score, node.state.turn))}</span>}
                <span className="muted">{r.busy ? "analysing… " : ""}{valid ? r.label : ""}</span>
              </div>
              {r.error && <p className="bad">{r.error}</p>}
              {!valid && !r.error && <p className="muted">Analysing this position…</p>}
              {valid && r.lines!.length === 0 && <p className="muted">There are no moves here: the game is over.</p>}
              {valid && r.lines!.map((l, i) => (
                <div key={i} className={"lline" + (i === 0 ? " top" : "")}>
                  <span className={"leval " + (toWhite(l.score, node.state.turn) >= 0 ? "w" : "b")}>{fmtWhite(toWhite(l.score, node.state.turn))}</span>
                  <span className="lmoves">{pvTokens(node.state, l).map((t, j) => <button key={j} className="lm" onClick={() => playLine(r.lines!, i, j)} title="Play this line on the board">{t}</button>)}</span>
                </div>
              ))}
            </section>
          );
        })}

        <section className="card">
          <h2>Moves</h2>
          <div className="an-moves">{tree.nodes[0].children.length ? renderLine(0, false) : <span className="muted">Make a move on the board to start.</span>}</div>
          <div className="export">
            <button className="btn small" onClick={() => copyText(toPgn(tree), "PGN copied")}>Copy PGN</button>
            <button className="btn small" onClick={() => copyText(fen, "FEN copied")}>Copy FEN</button>
            {copied && <span className="good" role="status">{copied}</span>}
          </div>
        </section>

        <section className="card">
          <h2>Set up a position</h2>
          <label>FEN
            <input value={fenText} onChange={(e) => setFenText(e.target.value)} placeholder={START_FEN} onKeyDown={(e) => e.key === "Enter" && setPosition(fenText)} />
          </label>
          <div className="row">
            <button className="btn small primary" onClick={() => setPosition(fenText)}>Set position</button>
            <button className="btn small" onClick={() => { setErr(""); replaceTree(createTree(START_FEN), 0); }}>Starting position</button>
          </div>
          <label>Or paste a PGN
            <textarea rows={4} value={pgnText} onChange={(e) => setPgnText(e.target.value)} placeholder="1. e4 e5 2. Nf3 …" />
          </label>
          <div className="row"><button className="btn small primary" onClick={() => loadPgn(pgnText)}>Load PGN</button></div>
          {err && <p className="bad" role="alert">{err}</p>}
        </section>
      </div>
    </div>
  );
}
