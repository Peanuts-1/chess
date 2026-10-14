"use client";
import { useEffect, useMemo, useState } from "react";
import Board from "@/components/Board";
import { useSettings } from "@/components/Settings";
import { Color, Move, START_FEN, State, makeMove, parseFen, status, toSan } from "@/lib/chess";
import { LEVELS, bestMove } from "@/lib/engine";
import { leelaAnalyze } from "@/lib/leela";

interface Entry { state: State; move: Move | null; san: string }
const fresh = (): Entry[] => [{ state: parseFen(START_FEN), move: null, san: "" }];
const LEELA_NODES = { easy: 1, medium: 40, hard: 300 }; // 1 node = Leela's raw first instinct

const fmt = (cp: number, turn: Color) => {
  const w = turn === "w" ? cp : -cp;
  return Math.abs(w) > 90000 ? (w > 0 ? "mate for White" : "mate for Black") : `${w > 0 ? "+" : ""}${(w / 100).toFixed(2)}`;
};

export default function Play() {
  const { settings, leela } = useSettings();
  const leelaOn = settings.engine === "leela" && leela.status === "ready";
  const [player, setPlayer] = useState<Color>("w");
  const [level, setLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [hist, setHist] = useState<Entry[]>(fresh);
  const [thinking, setThinking] = useState(false);
  const [hintInfo, setHintInfo] = useState<{ move: Move; text: string } | null>(null);
  const [note, setNote] = useState("");

  const cur = hist[hist.length - 1];
  const st = useMemo(() => status(cur.state), [cur]);
  const myTurn = cur.state.turn === player;

  function play(m: Move) {
    setHist((h) => {
      const last = h[h.length - 1];
      return [...h, { state: makeMove(last.state, m), move: m, san: toSan(last.state, m) }];
    });
    setHintInfo(null);
  }

  // The engine replies whenever it is its turn.
  useEffect(() => {
    if (st.over || myTurn) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setThinking(true);
    const finish = (m: Move | null) => { if (dead) return; setThinking(false); if (m) play(m); };
    const builtin = () => { timer = setTimeout(() => finish(bestMove(cur.state, LEVELS[level])), 80); };
    if (leelaOn) {
      leelaAnalyze(cur.state, LEELA_NODES[level]).then((r) => finish(r.move)).catch(() => {
        if (dead) return;
        setNote("Leela did not answer, so the built-in engine moved instead.");
        builtin();
      });
    } else builtin();
    return () => { dead = true; if (timer) clearTimeout(timer); setThinking(false); };
  }, [cur, player, level, st.over, myTurn, leelaOn]);

  function newGame(color: Color) { setPlayer(color); setHist(fresh()); setHintInfo(null); setNote(""); }
  function undo() {
    const h = hist.slice();
    do { h.pop(); } while (h.length > 1 && h[h.length - 1].state.turn !== player);
    setHist(h); setHintInfo(null);
  }

  async function showHint() {
    const s = cur.state;
    if (leelaOn) {
      setThinking(true);
      try {
        const r = await leelaAnalyze(s, 200);
        if (r.move) setHintInfo({ move: r.move, text: `Leela suggests ${toSan(s, r.move)}. Evaluation ${fmt(r.score, s.turn)}.` });
        setThinking(false);
        return;
      } catch { setNote("Leela did not answer, so the built-in engine gave the hint."); setThinking(false); }
    }
    const m = bestMove(s, LEVELS.medium);
    if (m) setHintInfo({ move: m, text: `The engine suggests ${toSan(s, m)}.` });
  }

  let message = "";
  if (st.over) {
    message = st.result === "draw" ? `Draw: ${st.reason}.` : st.result === player ? `${st.reason}. You win!` : `${st.reason}. The engine wins.`;
  } else if (thinking) message = "Engine is thinking…";
  else if (myTurn) message = st.check ? "Your move. You are in check." : "Your move.";

  const rows: { n: number; w?: string; b?: string }[] = [];
  hist.slice(1).forEach((e, i) => {
    if (i % 2 === 0) rows.push({ n: i / 2 + 1, w: e.san });
    else rows[rows.length - 1].b = e.san;
  });

  return (
    <div className="play">
      <div className="boardwrap">
        <Board
          state={cur.state}
          orientation={player}
          movable={st.over || thinking ? null : player}
          lastMove={cur.move}
          hint={hintInfo?.move ?? null}
          onMove={play}
        />
        <div className="boardbar"><span className={st.over ? "good" : ""}>{message}</span></div>
        {hintInfo && <p className="hinttext">{hintInfo.text}</p>}
      </div>

      <aside className="panel">
        <h1>Play the engine</h1>
        <label>Strength
          <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <p className="muted">
          Opponent: {leelaOn ? "Leela Chess Zero" : "built-in engine"}.{" "}
          {settings.engine === "leela" && leela.status === "missing" ? "Leela is not connected, see Settings." : "Change this in Settings."}
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => newGame("w")}>New game as White</button>
          <button className="btn" onClick={() => newGame("b")}>New game as Black</button>
        </div>
        <div className="row">
          <button className="btn small" disabled={hist.length < 2 || thinking} onClick={undo}>Undo</button>
          <button className="btn small" disabled={!myTurn || st.over || thinking} onClick={showHint}>Hint</button>
        </div>
        {note && <p className="bad">{note}</p>}
        <div className="movelist" aria-label="Moves">
          {rows.length === 0 && <p className="muted">Moves will appear here.</p>}
          {rows.map((r) => (
            <div key={r.n} className="mrow"><span className="mn">{r.n}.</span><span>{r.w}</span><span>{r.b}</span></div>
          ))}
        </div>
        <p className="muted">Pawns promote to a queen automatically.</p>
      </aside>
    </div>
  );
}
