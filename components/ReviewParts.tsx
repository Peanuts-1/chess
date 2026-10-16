"use client";
import type { Color, State } from "@/lib/chess";
import type { PhaseStat } from "@/lib/review";
import PieceSvg from "./Pieces";

// ---------------------------------------------------------------- captured pieces and material
const START_COUNT: Record<string, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };
const VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const ORDER = ["q", "r", "b", "n", "p"];

function counts(s: State) {
  const have: Record<Color, Record<string, number>> = { w: { q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { q: 0, r: 0, b: 0, n: 0, p: 0 } };
  for (const p of s.board) if (p && p.toLowerCase() !== "k") have[p === p.toUpperCase() ? "w" : "b"][p.toLowerCase()]++;
  return have;
}

// Pieces this side has captured, and how far ahead it is on material (as on chess.com and lichess).
export function Captured({ state, color }: { state: State; color: Color }) {
  const have = counts(state);
  const enemy: Color = color === "w" ? "b" : "w";
  const points = (c: Color) => ORDER.reduce((a, t) => a + VALUE[t] * have[c][t], 0);
  const diff = points(color) - points(enemy);
  const icons: JSX.Element[] = [];
  for (const t of ORDER) {
    const missing = Math.max(0, START_COUNT[t] - have[enemy][t]);
    for (let k = 0; k < missing; k++) icons.push(<PieceSvg key={t + k} type={t} white={enemy === "w"} />);
  }
  return (
    <span className="cap" aria-label={diff > 0 ? `Ahead by ${diff} points of material` : undefined}>
      {icons}
      {diff > 0 && <span className="capdiff">+{diff}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- time spent per move (lichess "move times")
export function MoveTimes({ times, ply, onPick }: { times: (number | null)[]; ply: number; onPick: (p: number) => void }) {
  const n = times.length;
  const max = Math.max(10, Math.min(120, Math.max(...times.map((t) => t ?? 0))));
  const h = (t: number | null) => (t == null ? 0 : Math.sqrt(Math.min(t, max) / max) * 46);
  return (
    <div className="timechart">
      <svg viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" role="img" aria-label="Time spent on each move">
        <line x1="0" x2={n * 10} y1="50" y2="50" stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {times.map((t, i) => {
          const white = i % 2 === 0, bh = h(t);
          return (
            <g key={i} onClick={() => onPick(i + 1)} style={{ cursor: "pointer" }}>
              <rect x={i * 10} y="0" width="10" height="100" fill="transparent" />
              <rect x={i * 10 + 1.2} y={white ? 50 - bh : 50} width="7.6" height={bh} fill={white ? "#f4f6f8" : "#2b3541"} stroke={ply === i + 1 ? "#3a4fd7" : "#6b7785"} strokeWidth={ply === i + 1 ? 2.2 : 0.8} vectorEffect="non-scaling-stroke">
                <title>{t == null ? "no clock" : `${t.toFixed(1)} s`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="muted small-note">Time spent on each move: White above the line, Black below.</div>
    </div>
  );
}

// ---------------------------------------------------------------- accuracy by phase of the game
export function PhasesTable({ phases, names }: { phases: PhaseStat[]; names: [string, string] }) {
  const cell = (v: number | null) =>
    v == null ? <span className="muted">–</span> : (
      <span className="phcell"><span className="phbar"><i style={{ width: `${v}%`, background: v >= 90 ? "#5b9a4a" : v >= 75 ? "#e0a526" : "#ca3431" }} /></span>{v.toFixed(0)}</span>
    );
  return (
    <table className="ctable phases">
      <thead><tr><th>Game phase</th><th>{names[0]}</th><th>{names[1]}</th></tr></thead>
      <tbody>{phases.filter((p) => p.w != null || p.b != null).map((p) => <tr key={p.phase}><td>{p.phase}</td><td>{cell(p.w)}</td><td>{cell(p.b)}</td></tr>)}</tbody>
    </table>
  );
}
