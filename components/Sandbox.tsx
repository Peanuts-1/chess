"use client";
import { useMemo, useState } from "react";
import Board from "./Board";
import { Move, makeMove, parseFen, status } from "@/lib/chess";

// A board you can freely play with. Either side can move; "Reset" restores the position.
export default function Sandbox({ fen, hint = "Tap a piece to see where it can go." }: { fen: string; hint?: string }) {
  const start = useMemo(() => parseFen(fen), [fen]);
  const [st, setSt] = useState(start);
  const [last, setLast] = useState<Move | null>(null);
  const s = status(st);
  const note = s.over ? (s.result === "draw" ? `Draw by ${(s.reason ?? "draw").toLowerCase()}.` : `${s.reason}.`) : s.check ? "Check!" : hint;
  return (
    <div className="boardwrap">
      <Board state={st} movable="both" lastMove={last} onMove={(m) => { setSt(makeMove(st, m)); setLast(m); }} />
      <div className="boardbar">
        <span>{note}</span>
        <button className="btn small" onClick={() => { setSt(start); setLast(null); }}>Reset</button>
      </div>
    </div>
  );
}
