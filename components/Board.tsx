"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, Move, State, colorOf, inCheck, legalMoves, sqName } from "@/lib/chess";
import PieceSvg from "./Pieces";

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
  drawable?: boolean;   // right-click and drag draws arrows; right-click a square circles it (like chess.com)
  drawMode?: boolean;   // also draw with the left mouse button / a finger (touch screens)
}

const GREEN = "#3fa34d", RED = "#d9453a", BLUE = "#3b82d6", YELLOW = "#e0b42a";
interface Drawn { arrows: Arrow[]; rings: { sq: number; color: string }[] }
const NONE: Drawn = { arrows: [], rings: [] };

function ArrowShape({ x1, y1, x2, y2, color, opacity = 0.85 }: { x1: number; y1: number; x2: number; y2: number; color: string; opacity?: number }) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const head = 0.34, w = 0.21, bx = x2 - ux * head, by = y2 - uy * head, px = -uy * w, py = ux * w;
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth="0.17" strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`} fill={color} />
    </g>
  );
}

export default function Board({ state, orientation = "w", movable = null, onMove, lastMove, hint, arrows, badge, marks, drawable = false, drawMode = false }: BoardProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<Drawn>(NONE);
  const [drag, setDrag] = useState<{ from: number; to: number; color: string } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const legal = useMemo(() => legalMoves(state), [state]);
  useEffect(() => { setSel(null); setDrawn(NONE); }, [state]); // a new position clears your drawings, as on chess.com

  const targets = sel === null ? [] : legal.filter((m) => m.from === sel);
  const kingSq = inCheck(state) ? state.board.indexOf(state.turn === "w" ? "K" : "k") : -1;
  const canMove = movable === "both" || movable === state.turn;
  const pos = (i: number) => (orientation === "w" ? { x: i & 7, y: i >> 3 } : { x: 7 - (i & 7), y: 7 - (i >> 3) });

  function click(i: number) {
    if (drawable && (drawn.arrows.length || drawn.rings.length)) setDrawn(NONE);
    if (canMove) {
      const mv = targets.find((m) => m.to === i && (!m.promo || m.promo === "q")); // auto-queen
      if (mv) { setSel(null); onMove?.(mv); return; }
      const p = state.board[i];
      if (p && colorOf(p) === state.turn) { setSel(i === sel ? null : i); return; }
    }
    setSel(null);
  }

  // ---- drawing arrows and circles ----
  function sqAt(e: { clientX: number; clientY: number }): number | null {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - 3) / (r.width - 6), y = (e.clientY - r.top - 3) / (r.height - 6);
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    const k = Math.floor(y * 8) * 8 + Math.floor(x * 8);
    return orientation === "w" ? k : 63 - k;
  }
  const colorFor = (e: React.PointerEvent) => (e.shiftKey ? RED : e.ctrlKey || e.metaKey ? BLUE : e.altKey ? YELLOW : GREEN);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawable) return;
    if (!(e.button === 2 || (drawMode && e.button === 0))) return;
    const sq = sqAt(e);
    if (sq === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: sq, to: sq, color: colorFor(e) });
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const sq = sqAt(e);
    if (sq !== null && sq !== drag.to) setDrag({ ...drag, to: sq });
  }
  function onPointerUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    setDrawn((cur) => {
      if (d.from === d.to) { // circle a square; again to remove it
        const same = cur.rings.find((r) => r.sq === d.from);
        const rest = cur.rings.filter((r) => r.sq !== d.from);
        return { ...cur, rings: same && same.color === d.color ? rest : [...rest, { sq: d.from, color: d.color }] };
      }
      const same = cur.arrows.find((a) => a.from === d.from && a.to === d.to);
      const rest = cur.arrows.filter((a) => !(a.from === d.from && a.to === d.to));
      return { ...cur, arrows: same && same.color === d.color ? rest : [...rest, { from: d.from, to: d.to, color: d.color }] };
    });
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
        {p && <PieceSvg type={p.toLowerCase()} white={colorOf(p) === "w"} />}
        {k % 8 === 0 && <i className="rank">{8 - (i >> 3)}</i>}
        {k >= 56 && <i className="file">{"abcdefgh"[i & 7]}</i>}
      </button>
    );
  }

  const bp = badge ? pos(badge.sq) : null;
  const anyDrawn = drawn.arrows.length > 0 || drawn.rings.length > 0 || !!drag;
  const hasOverlay = (arrows && arrows.length > 0) || badge || anyDrawn;
  const allArrows = [...(arrows ?? []).map((a) => ({ ...a, color: a.color ?? GREEN })), ...drawn.arrows.map((a) => ({ ...a, color: a.color ?? GREEN }))];
  return (
    <div
      className="boardframe"
      onContextMenu={drawable ? (e) => e.preventDefault() : undefined}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}
      style={drawable && drawMode ? { touchAction: "none" } : undefined}
    >
      <div className="board" role="grid" ref={boardRef}>{cells}</div>
      {hasOverlay && (
        <div className="overlay">
          <svg viewBox="0 0 8 8">
            {drawn.rings.map((r) => {
              const p = pos(r.sq);
              return <circle key={"r" + r.sq} cx={p.x + 0.5} cy={p.y + 0.5} r="0.44" fill="none" stroke={r.color} strokeWidth="0.075" opacity="0.85" />;
            })}
            {allArrows.map((a, k) => {
              const f = pos(a.from), t = pos(a.to);
              return <ArrowShape key={k} x1={f.x + 0.5} y1={f.y + 0.5} x2={t.x + 0.5} y2={t.y + 0.5} color={a.color} />;
            })}
            {drag && drag.from !== drag.to && (() => {
              const f = pos(drag.from), t = pos(drag.to);
              return <ArrowShape x1={f.x + 0.5} y1={f.y + 0.5} x2={t.x + 0.5} y2={t.y + 0.5} color={drag.color} opacity={0.6} />;
            })()}
            {drag && drag.from === drag.to && (() => {
              const p = pos(drag.from);
              return <circle cx={p.x + 0.5} cy={p.y + 0.5} r="0.44" fill="none" stroke={drag.color} strokeWidth="0.075" opacity="0.6" />;
            })()}
          </svg>
          {badge && bp && (
            <span className="badge" style={{ left: `${(bp.x + 1) * 12.5}%`, top: `${bp.y * 12.5}%`, background: badge.color }}>{badge.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
