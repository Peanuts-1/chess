"use client";
import { useMemo, useState } from "react";
import Board from "./Board";
import Sandbox from "./Sandbox";
import { Move, State, legalMoves, makeMove, moveFromUci, parseFen, sqName, status, toSan } from "@/lib/chess";
import type { Lesson } from "@/lib/lessons";

export default function LessonBoard({ lesson }: { lesson: Lesson }) {
  if (lesson.kind === "puzzle") return <Puzzle lesson={lesson} />;
  if (lesson.kind === "line") return <Line lesson={lesson} />;
  return <Sandbox fen={lesson.fen} />;
}

function Puzzle({ lesson }: { lesson: Lesson }) {
  const start = useMemo(() => parseFen(lesson.fen), [lesson.fen]);
  const [st, setSt] = useState(start);
  const [last, setLast] = useState<Move | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isSolution = (s: State, m: Move) =>
    lesson.solutions ? lesson.solutions.includes(sqName(m.from) + sqName(m.to)) : status(makeMove(s, m)).reason === "Checkmate";

  function onMove(m: Move) {
    if (isSolution(st, m)) {
      setMsg({ ok: true, text: `${toSan(st, m)} — correct!` });
      setSt(makeMove(st, m)); setLast(m); setHint(null);
    } else {
      setMsg({ ok: false, text: lesson.solutions ? "Not the best move. Try again." : "That isn't checkmate. Try again." });
    }
  }
  const reset = () => { setSt(start); setLast(null); setHint(null); setMsg(null); };

  return (
    <div className="boardwrap">
      <Board state={st} movable={msg?.ok ? null : "w"} lastMove={last} hint={hint} onMove={onMove} />
      <div className="boardbar">
        <span className={msg ? (msg.ok ? "good" : "bad") : ""}>{msg ? msg.text : "White to move."}</span>
        <span className="btns">
          {!msg?.ok && <button className="btn small" onClick={() => setHint(legalMoves(start).find((m) => isSolution(start, m)) ?? null)}>Show answer</button>}
          <button className="btn small" onClick={reset}>Reset</button>
        </span>
      </div>
    </div>
  );
}

function Line({ lesson }: { lesson: Lesson }) {
  const steps = useMemo(() => {
    const out: { state: State; move: Move | null; san: string }[] = [{ state: parseFen(lesson.fen), move: null, san: "" }];
    for (const m of lesson.moves ?? []) {
      const prev = out[out.length - 1].state;
      const mv = moveFromUci(prev, m.uci)!;
      out.push({ state: makeMove(prev, mv), move: mv, san: toSan(prev, mv) });
    }
    return out;
  }, [lesson]);
  const [i, setI] = useState(0);
  const cur = steps[i];
  return (
    <div className="boardwrap">
      <Board state={cur.state} lastMove={cur.move} />
      <p className="moves">
        {steps.slice(1).map((e, k) => (
          <span key={k} className={k + 1 === i ? "now" : ""}>{k % 2 === 0 ? `${k / 2 + 1}. ` : ""}{e.san} </span>
        ))}
      </p>
      <div className="boardbar">
        <span>{i === 0 ? "Press Next to play the first move." : lesson.moves![i - 1].note}</span>
        <span className="btns">
          <button className="btn small" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          <button className="btn small" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>Next</button>
        </span>
      </div>
    </div>
  );
}
