"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import type { Arrow } from "./Board";
import { makeMove, moveFromUci, nameSq, parseFen, status, toFen } from "@/lib/chess";
import type { Color, Move, State } from "@/lib/chess";
import { bestMove } from "@/lib/engine";
import { findMating, uci } from "@/lib/puzzles";
import { COURSES, START, lessonKey, nextLesson } from "@/lib/curriculum";
import type { Step } from "@/lib/curriculum";
import { completeLesson, loadProgress, saveProgress } from "@/lib/progress";

const stepFen = (s: Step, carry: string) => ("fen" in s && s.fen ? s.fen : carry);
const sameMove = (a: Move | null, b: Move) => !!a && a.from === b.from && a.to === b.to && (a.promo ?? "q") === (b.promo ?? "q");

export default function LessonPlayer({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const course = COURSES.find((c) => c.id === courseId)!;
  const lesson = course.lessons.find((l) => l.id === lessonId)!;
  const steps = lesson.steps;

  const [i, setI] = useState(0);
  const carry = useRef(START);
  const [st, setSt] = useState<State>(() => parseFen(stepFen(steps[0], START)));
  const stRef = useRef(st); stRef.current = st;
  const [last, setLast] = useState<Move | null>(null);
  const [done, setDone] = useState(steps[0].kind === "explain");
  const [fb, setFb] = useState<{ kind: "ok" | "bad" | "info"; text: string } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [moves, setMoves] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<{ stars: number; xp: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const step = steps[i];
  const startFen = stepFen(step, carry.current);
  const startTurn = useMemo(() => parseFen(startFen).turn, [startFen]);
  const userColor: Color = step.kind === "line" ? (step.as ?? "w") : "w";
  const colorAt = (k: number): Color => (k % 2 === 0 ? startTurn : startTurn === "w" ? "b" : "w");

  function enter(idx: number) {
    if (timer.current) clearTimeout(timer.current);
    const s = steps[idx];
    const fen = stepFen(s, carry.current);
    if (s.kind === "explain" || s.kind === "quiz" || s.kind === "explore" || s.kind === "play") carry.current = fen;
    const ns = parseFen(fen);
    setSt(ns); stRef.current = ns; setLast(null); setDone(s.kind === "explain"); setFb(null);
    setHintLevel(0); setLineIdx(0); setMoves(0); setPicked(null); setWrong([]); setBusy(false);
  }
  useEffect(() => { enter(i); return () => { if (timer.current) clearTimeout(timer.current); }; }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Line steps: the opponent's moves are played automatically; the step ends after the last move.
  useEffect(() => {
    if (step.kind !== "line" || done) return;
    if (lineIdx >= step.moves.length) { carry.current = toFen(stRef.current); setDone(true); setBusy(false); return; }
    if (colorAt(lineIdx) === userColor) { setBusy(false); return; }
    setBusy(true);
    timer.current = setTimeout(() => {
      const m = moveFromUci(stRef.current, step.moves[lineIdx].uci);
      if (m) { setLast(m); setSt(makeMove(stRef.current, m)); setFb({ kind: "info", text: step.moves[lineIdx].note }); }
      setLineIdx((l) => l + 1);
    }, 650);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [i, lineIdx, done]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMove(m: Move) {
    if (finished || busy) return;
    if (step.kind === "explore") {
      const ns = makeMove(st, m); setSt(ns); setLast(m);
      const n = moves + 1, need = step.minMoves ?? 3; setMoves(n);
      if (n >= need) { setDone(true); carry.current = toFen(ns); setFb({ kind: "ok", text: "Great exploring! Press Continue." }); }
      else setFb({ kind: "info", text: `Moves made: ${n} of ${need}.` });
      return;
    }
    if (done) return;
    if (step.kind === "move") {
      const ns = makeMove(st, m), over = status(ns);
      const ok = step.accept === "mate" ? over.reason === "Checkmate" : step.accept.includes(uci(m));
      if (ok) { setSt(ns); setLast(m); setDone(true); carry.current = toFen(ns); setFb({ kind: "ok", text: step.success }); }
      else { setMistakes((x) => x + 1); setFb({ kind: "bad", text: over.reason === "Stalemate" ? "That's stalemate: a draw! Find the move that wins." : step.wrong ?? "Not quite. Try again." }); }
    } else if (step.kind === "line") {
      const exp = moveFromUci(st, step.moves[lineIdx].uci);
      if (exp && sameMove(exp, m)) { setSt(makeMove(st, m)); setLast(m); setFb({ kind: "ok", text: step.moves[lineIdx].note }); setLineIdx((l) => l + 1); setHintLevel(0); }
      else { setMistakes((x) => x + 1); setFb({ kind: "bad", text: "That's not the move in this line. Try again, or press Hint." }); }
    } else if (step.kind === "play") {
      const ns = makeMove(st, m); setSt(ns); setLast(m);
      const s1 = status(ns);
      if (s1.over) {
        if (s1.reason === "Checkmate") { setDone(true); carry.current = toFen(ns); setFb({ kind: "ok", text: step.success }); }
        else { setMistakes((x) => x + 1); setBusy(true); setFb({ kind: "bad", text: (s1.reason === "Stalemate" ? "Stalemate! That's a draw." : "The game ended in a draw.") + " Press Restart and try again." }); }
        return;
      }
      setBusy(true);
      timer.current = setTimeout(() => {
        const r = bestMove(ns, { depth: 2, ms: 150, noise: 0 });
        if (r) { setSt(makeMove(ns, r)); setLast(r); }
        setBusy(false);
      }, 500);
    }
  }

  function pick(idx: number) {
    if (done || step.kind !== "quiz") return;
    if (idx === step.answer) { setPicked(idx); setDone(true); setFb({ kind: "ok", text: step.explain }); }
    else { setMistakes((x) => x + 1); setWrong((w) => [...w, idx]); setFb({ kind: "bad", text: "Not quite. Try another answer." }); }
  }

  function target(): Move | null {
    if (step.kind === "move") return step.accept === "mate" ? findMating(st, 1) : moveFromUci(st, step.accept[0]) ?? null;
    if (step.kind === "line") return moveFromUci(st, step.moves[lineIdx]?.uci ?? "") ?? null;
    return null;
  }
  function hint() {
    if (done) return;
    if (hintLevel === 0) setHints((h) => h + 1);
    setHintLevel((l) => Math.min(2, l + 1));
  }

  function next() {
    if (i + 1 < steps.length) { setI(i + 1); return; }
    if (finished) return;
    const stars = mistakes === 0 && hints === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const before = loadProgress();
    saveProgress(completeLesson(before, lessonKey(courseId, lessonId), stars));
    setResult({ stars, xp: (before.done[lessonKey(courseId, lessonId)] ?? 0) === 0 ? 20 : 5 });
    setFinished(true);
  }

  // ---------------- completion ----------------
  if (finished && result) {
    const nl = nextLesson(courseId, lessonId);
    return (
      <div className="lp-complete">
        <div className="lp-stars" aria-label={`${result.stars} of 3 stars`}>
          {[1, 2, 3].map((n) => <span key={n} className={n <= result.stars ? "on" : ""}>★</span>)}
        </div>
        <h1>Lesson complete!</h1>
        <p className="lede">{lesson.title}</p>
        <p className="lp-xp">+{result.xp} XP</p>
        <p className="muted">{result.stars === 3 ? "Perfect: no mistakes and no hints." : "Replay the lesson for three stars: no mistakes and no hints."}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          {nl && <Link className="btn primary" href={`/learn/${nl.course}/${nl.lesson}`}>Next lesson</Link>}
          <Link className="btn" href={`/learn/${courseId}`}>Back to course</Link>
          <button className="btn" onClick={() => { setFinished(false); setResult(null); setMistakes(0); setHints(0); carry.current = START; setI(0); enter(0); }}>Replay</button>
        </div>
      </div>
    );
  }

  // ---------------- lesson ----------------
  const orientation: Color = step.kind === "line" ? userColor : step.kind === "move" || step.kind === "play" || step.kind === "explore" ? startTurn : "w";
  let movable: Color | "both" | null = null;
  if (!busy) {
    if (step.kind === "explore") movable = "both";
    else if (!done) {
      if (step.kind === "move") movable = st.turn;
      else if (step.kind === "line") movable = st.turn === userColor ? st.turn : null;
      else if (step.kind === "play") movable = st.turn === "w" ? "w" : null;
    }
  }
  const marks = step.kind === "explain" && step.marks ? step.marks.map(nameSq) : [];
  const arrows: Arrow[] = step.kind === "explain" && step.arrows ? step.arrows.map(([a, b]) => ({ from: nameSq(a), to: nameSq(b) })) : [];
  const t = hintLevel > 0 && !done ? target() : null;
  if (t && hintLevel >= 2) arrows.push({ from: t.from, to: t.to });
  const hintSq = t && hintLevel === 1 ? { from: t.from, to: t.from } : null;
  const pct = ((i + (done ? 1 : 0)) / steps.length) * 100;
  const isLast = i + 1 === steps.length;

  return (
    <div className="lp">
      <div className="lp-top">
        <Link href={`/learn/${courseId}`} className="lp-x" aria-label="Exit lesson">✕</Link>
        <div className="lp-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%`, background: course.color }} /></div>
        <span className="muted">{i + 1} / {steps.length}</span>
      </div>

      <div className="lp-main">
        <div className="lp-board boardwrap">
          <Board state={st} orientation={orientation} movable={movable} onMove={onMove} lastMove={last} hint={hintSq} arrows={arrows} marks={marks} />
        </div>

        <aside className="lp-coach">
          <div className="lp-head"><span className="lp-avatar" style={{ background: course.color }}>{course.glyph}</span><div><strong>{lesson.title}</strong><div className="muted">{course.title}</div></div></div>
          <div className="lp-bubble">
            <p>{step.text}</p>
            {step.kind === "play" && !done && <p className="muted">Tip: {step.tip}</p>}
            {step.kind === "explore" && !done && fb === null && <p className="muted">Moves made: {moves} of {step.minMoves ?? 3}.</p>}
          </div>

          {step.kind === "quiz" && (
            <div className="lp-options" role="group" aria-label="Answers">
              {step.options.map((o, k) => (
                <button key={k} className={"lp-opt" + (picked === k ? " right" : wrong.includes(k) ? " wrong" : "")} disabled={done || wrong.includes(k)} onClick={() => pick(k)}>{o}</button>
              ))}
            </div>
          )}

          {fb && <div className={"lp-fb " + fb.kind} role="status" aria-live="polite">{fb.text}</div>}

          <div className="lp-actions">
            {(step.kind === "move" || step.kind === "line") && !done && !busy && <button className="btn small" onClick={hint}>{hintLevel === 0 ? "Hint" : "Show the move"}</button>}
            {(step.kind === "play" || step.kind === "explore") && <button className="btn small" onClick={() => enter(i)}>Restart</button>}
            {done && <button className="btn primary" onClick={next}>{isLast ? "Finish lesson" : "Continue"}</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}
