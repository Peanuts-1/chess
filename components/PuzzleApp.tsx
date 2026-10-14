"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import type { Arrow } from "./Board";
import { makeMove, moveFromUci, parseFen, status, toSan } from "@/lib/chess";
import type { Move, State } from "@/lib/chess";
import { bestMove } from "@/lib/engine";
import { PUZZLES } from "@/lib/puzzle-data";
import { THEMES, findMating, isMatingMove, uci } from "@/lib/puzzles";
import type { Puzzle, Theme } from "@/lib/puzzles";

type Result = "clean" | "assisted";
interface Progress { solved: Record<number, Result>; streak: number; best: number }
const KEY = "openfile-puzzles";

export default function PuzzleApp() {
  const [filter, setFilter] = useState<Theme | "all">("all");
  const [id, setId] = useState(PUZZLES[0]?.id ?? 0);
  const puzzle: Puzzle = PUZZLES.find((p) => p.id === id) ?? PUZZLES[0];
  const side = useMemo(() => parseFen(puzzle.fen).turn, [puzzle]);

  const [st, setSt] = useState<State>(() => parseFen(PUZZLES[0].fen));
  const [last, setLast] = useState<Move | null>(null);
  const [phase, setPhase] = useState<"play" | "solved" | "shown">("play");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [userMoves, setUserMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [helped, setHelped] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [busy, setBusy] = useState(false);
  const [solutionText, setSolutionText] = useState("");
  const [progress, setProgress] = useState<Progress>({ solved: {}, streak: 0, best: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setProgress({ solved: {}, streak: 0, best: 0, ...JSON.parse(s) }); } catch { /* ignore */ }
  }, []);
  const save = (p: Progress) => { setProgress(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };

  function load(p: Puzzle) {
    if (timer.current) clearTimeout(timer.current);
    setSt(parseFen(p.fen)); setLast(null); setPhase("play"); setMsg(null); setUserMoves(0); setMistakes(0);
    setHelped(false); setHintLevel(0); setHintMove(null); setBusy(false); setSolutionText("");
  }
  useEffect(() => { load(puzzle); return () => { if (timer.current) clearTimeout(timer.current); }; }, [puzzle.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = filter === "all" ? PUZZLES : PUZZLES.filter((p) => p.theme === filter);
  const movesNeeded = puzzle.theme === "mate1" ? 1 : 2;

  function solve(finalMsg: string) {
    const clean = mistakes === 0 && !helped;
    const solved = { ...progress.solved, [puzzle.id]: progress.solved[puzzle.id] === "clean" || clean ? "clean" : "assisted" } as Record<number, Result>;
    const streak = clean ? progress.streak + 1 : 0;
    save({ solved, streak, best: Math.max(progress.best, streak) });
    setPhase("solved");
    setMsg({ ok: true, text: clean ? finalMsg : `${finalMsg} (solved with some help)` });
  }

  function onMove(m: Move) {
    if (busy || phase !== "play") return;
    const left = movesNeeded - userMoves;
    const ok = puzzle.theme === "tactic" ? (puzzle.accepted ?? puzzle.solution).includes(uci(m)) : isMatingMove(st, m, left);
    if (!ok) {
      if (mistakes === 0 && progress.streak > 0) save({ ...progress, streak: 0 });
      setMistakes((x) => x + 1);
      setMsg({ ok: false, text: "That's not it. Try again." });
      return;
    }
    const ns = makeMove(st, m);
    setSt(ns); setLast(m); setHintLevel(0); setHintMove(null); setUserMoves((u) => u + 1);
    if (puzzle.theme === "tactic") { solve("Correct! That wins material."); return; }
    if (status(ns).over) { solve("Checkmate!"); return; }
    setBusy(true); setMsg({ ok: true, text: "Correct. Keep going…" });
    timer.current = setTimeout(() => {
      const r = bestMove(ns, { depth: 2, ms: 200, noise: 0 });
      if (r) { setSt(makeMove(ns, r)); setLast(r); }
      setBusy(false);
    }, 500);
  }

  function hint() {
    if (phase !== "play" || busy) return;
    const best = puzzle.theme === "tactic" ? moveFromUci(st, puzzle.solution[0]) : findMating(st, movesNeeded - userMoves);
    if (!best) return;
    setHelped(true);
    if (hintLevel === 0) { setHintMove(best); setHintLevel(1); } else setHintLevel(2);
  }

  function showSolution() {
    if (busy) return;
    let s = parseFen(puzzle.fen);
    const out: string[] = [];
    for (const u of puzzle.solution) { const m = moveFromUci(s, u); if (!m) break; out.push(toSan(s, m)); s = makeMove(s, m); }
    setSolutionText(out.join("  →  ")); setHelped(true); setPhase("shown");
    setMsg({ ok: false, text: "Here is the solution." });
    if (mistakes === 0 && progress.streak > 0) save({ ...progress, streak: 0 });
  }

  function pick(t: Theme | "all") {
    setFilter(t);
    const l = t === "all" ? PUZZLES : PUZZLES.filter((p) => p.theme === t);
    if (l.length && !l.some((p) => p.id === id)) setId(l[0].id);
  }
  function next() {
    if (!list.length) return;
    const idx = list.findIndex((p) => p.id === id);
    const order = [...list.slice(idx + 1), ...list.slice(0, idx + 1)];
    setId((order.find((p) => !progress.solved[p.id]) ?? order[0]).id);
  }

  const first = moveFromUci(parseFen(puzzle.fen), puzzle.solution[0]);
  const arrows: Arrow[] = [];
  if (phase === "shown" && first) arrows.push({ from: first.from, to: first.to });
  if (hintLevel === 2 && hintMove) arrows.push({ from: hintMove.from, to: hintMove.to });
  const solvedCount = Object.keys(progress.solved).length;

  return (
    <div className="puzzles">
      <div className="pz-main">
        <div className="boardwrap">
          <Board state={st} orientation={side} movable={phase === "play" && !busy ? side : null} lastMove={last} onMove={onMove}
            hint={hintLevel === 1 && hintMove ? { from: hintMove.from, to: hintMove.from } : null} arrows={arrows} />
        </div>

        <aside className="panel">
          <h1>Puzzles</h1>
          <p className="pz-meta"><span className="chip static">{THEMES[puzzle.theme].label}</span> <span className="muted">Puzzle {puzzle.id} of {PUZZLES.length}</span></p>
          <p className="pz-turn"><span className={"pdot " + side} /> {side === "w" ? "White" : "Black"} to move. {THEMES[puzzle.theme].blurb}</p>
          <div className={"pz-msg " + (msg ? (msg.ok ? "ok" : "no") : "")} role="status" aria-live="polite">
            {msg ? msg.text : "Find the best move."}
            {solutionText && <div className="pz-sol">{solutionText}</div>}
          </div>
          <div className="row">
            <button className="btn small" onClick={hint} disabled={phase !== "play" || busy}>{hintLevel === 0 ? "Hint" : "Show the move"}</button>
            <button className="btn small" onClick={showSolution} disabled={phase === "shown" || busy}>Solution</button>
            <button className="btn small" onClick={() => load(puzzle)}>Retry</button>
            <button className={"btn small" + (phase === "solved" ? " primary" : "")} onClick={next}>Next puzzle</button>
          </div>
          <div className="pz-stats">
            <div><strong>{solvedCount}</strong><span>solved of {PUZZLES.length}</span></div>
            <div><strong>{progress.streak}</strong><span>streak</span></div>
            <div><strong>{progress.best}</strong><span>best streak</span></div>
          </div>
        </aside>
      </div>

      <section className="pz-browse">
        <div className="pz-filters" role="group" aria-label="Puzzle type">
          {(["all", "mate1", "mate2", "tactic"] as const).map((t) => (
            <button key={t} className={"chip" + (filter === t ? " on" : "")} onClick={() => pick(t)}>{t === "all" ? "All" : THEMES[t].label}</button>
          ))}
        </div>
        <div className="pz-grid">
          {list.map((p) => (
            <button key={p.id} className={"pz-cell" + (p.id === id ? " cur" : "") + (progress.solved[p.id] ? " " + progress.solved[p.id] : "")}
              onClick={() => setId(p.id)} aria-label={`Puzzle ${p.id}${progress.solved[p.id] ? ", solved" : ""}`}>{p.id}</button>
          ))}
        </div>
        <p className="muted">Green means solved on your own, amber means solved with a hint. Progress is saved in this browser.</p>
      </section>
    </div>
  );
}
