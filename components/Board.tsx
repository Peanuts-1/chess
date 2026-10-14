"use client";
import { useEffect, useMemo, useState } from "react";
import { Color, Move, State, colorOf, inCheck, legalMoves, sqName } from "@/lib/chess";

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export interface Arrow { from: number; to: number; color?: string }
export interface Badge { sq: number; text: string; color: string }

export interface BoardProps {
  state: State;
  orientation?: Color;
  movable?: Color | "both" | null; // who may move pieces on this board
  onMove?: (m: Move) => void;
  lastMove?: Move | null;
  hint?: { from: number; to: number } | null; // highlighted squares
  arrows?: Arrow[];
  badge?: Badge | null; // small label on a square, e.g. the quality of the last move
  marks?: number[];     // squares to highlight (lessons)
}

function ArrowShape({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const head = 0.34, w = 0.21, bx = x2 - ux * head, by = y2 - uy * head, px = -uy * w, py = ux * w;
  return (
    <g opacity="0.85">
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth="0.17" strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`} fill={color} />
    </g>
  );
}

export default function Board({ state, orientation = "w", movable = null, onMove, lastMove, hint, arrows, badge, marks }: BoardProps) {
  const [sel, setSel] = useState<number | null>(null);
  const legal = useMemo(() => legalMoves(state), [state]);
  useEffect(() => setSel(null), [state]);

  const targets = sel === null ? [] : legal.filter((m) => m.from === sel);
  const kingSq = inCheck(state) ? state.board.indexOf(state.turn === "w" ? "K" : "k") : -1;
  const canMove = movable === "both" || movable === state.turn;
  const pos = (i: number) => (orientation === "w" ? { x: i & 7, y: i >> 3 } : { x: 7 - (i & 7), y: 7 - (i >> 3) });

  function click(i: number) {
    if (canMove) {
      const mv = targets.find((m) => m.to === i && (!m.promo || m.promo === "q")); // auto-queen
      if (mv) { setSel(null); onMove?.(mv); return; }
      const p = state.board[i];
      if (p && colorOf(p) === state.turn) { setSel(i === sel ? null : i); return; }
    }
    setSel(null);
  }

  const cells = [];
  for (let k = 0; k < 64; k++) {
    const i = orientation === "w" ? k : 63 - k;
    const p = state.board[i];
    const light = ((i >> 3) + (i & 7)) % 2 === 0;
    const isTarget = targets.some((m) => m.to === i);
    const cls = ["sq", light ? "light" : "dark",
      sel === i && "sel",
      lastMove && (lastMove.from === i || lastMove.to === i) && "last",
      hint && (hint.from === i || hint.to === i) && "hint",
      marks?.includes(i) && "mark",
      kingSq === i && "check",
      isTarget && (p ? "ring" : "dot"),
    ].filter(Boolean).join(" ");
    cells.push(
      <button key={i} className={cls} onClick={() => click(i)} aria-label={`${sqName(i)}${p ? " " + p : ""}`}>
        {p && <span className={"piece " + (colorOf(p) === "w" ? "pw" : "pb")}>{GLYPH[p.toLowerCase()]}&#xFE0E;</span>}
        {k % 8 === 0 && <i className="rank">{8 - (i >> 3)}</i>}
        {k >= 56 && <i className="file">{"abcdefgh"[i & 7]}</i>}
      </button>
    );
  }

  const bp = badge ? pos(badge.sq) : null;
  return (
    <div className="boardframe">
      <div className="board" role="grid">{cells}</div>
      {((arrows && arrows.length > 0) || badge) && (
        <div className="overlay">
          {arrows && arrows.length > 0 && (
            <svg viewBox="0 0 8 8">
              {arrows.map((a, k) => {
                const f = pos(a.from), t = pos(a.to);
                return <ArrowShape key={k} x1={f.x + 0.5} y1={f.y + 0.5} x2={t.x + 0.5} y2={t.y + 0.5} color={a.color ?? "#3fa34d"} />;
              })}
            </svg>
          )}
          {badge && bp && (
            <span className="badge" style={{ left: `${(bp.x + 1) * 12.5}%`, top: `${bp.y * 12.5}%`, background: badge.color }}>{badge.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
