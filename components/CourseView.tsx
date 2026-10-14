"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { COURSES, lessonKey } from "@/lib/curriculum";
import { EMPTY, loadProgress } from "@/lib/progress";
import type { Progress } from "@/lib/progress";
import { Stars } from "./LearnHub";

export default function CourseView({ courseId }: { courseId: string }) {
  const c = COURSES.find((x) => x.id === courseId)!;
  const [p, setP] = useState<Progress>(EMPTY);
  useEffect(() => setP(loadProgress()), []);
  const done = c.lessons.filter((l) => p.done[lessonKey(c.id, l.id)]).length;
  const nextIdx = c.lessons.findIndex((l) => !p.done[lessonKey(c.id, l.id)]);
  return (
    <div className="cv">
      <Link href="/learn" className="cv-back">← All courses</Link>
      <header className="cv-head" style={{ borderTopColor: c.color }}>
        <span className="lp-avatar big" style={{ background: c.color }}>{c.glyph}</span>
        <div>
          <span className="muted">{c.level}</span>
          <h1>{c.title}</h1>
          <p className="lede">{c.blurb}</p>
          <div className="lh-progress"><div style={{ width: `${(done / c.lessons.length) * 100}%`, background: c.color }} /></div>
          <span className="muted">{done} of {c.lessons.length} lessons complete</span>
        </div>
      </header>
      <ol className="cv-list">
        {c.lessons.map((l, idx) => {
          const stars = p.done[lessonKey(c.id, l.id)] ?? 0;
          return (
            <li key={l.id}>
              <Link href={`/learn/${c.id}/${l.id}`} className={"cv-row" + (idx === nextIdx ? " next" : "")}>
                <span className={"cv-num" + (stars ? " done" : "")} style={stars ? { background: c.color } : undefined}>{stars ? "✓" : idx + 1}</span>
                <span className="cv-text"><strong>{l.title}</strong><span className="muted">{l.blurb} · {l.steps.length} steps</span></span>
                {stars ? <Stars n={stars} /> : idx === nextIdx ? <span className="chip static">{done === 0 ? "Start" : "Up next"}</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
