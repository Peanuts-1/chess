"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { COURSES, allLessons, lessonKey } from "@/lib/curriculum";
import { EMPTY, loadProgress } from "@/lib/progress";
import type { Progress } from "@/lib/progress";

const day = (d: Date) => d.toLocaleDateString("en-CA");

export const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map((k) => <span key={k} className={k <= n ? "on" : ""}>★</span>)}</span>
);

export default function LearnHub() {
  const [p, setP] = useState<Progress>(EMPTY);
  useEffect(() => setP(loadProgress()), []);
  const all = allLessons();
  const isDone = (c: string, l: string) => !!p.done[lessonKey(c, l)];
  const doneCount = all.filter((x) => isDone(x.course.id, x.lesson.id)).length;
  const stars = Object.values(p.done).reduce((a, b) => a + b, 0);
  const pct = Math.round((doneCount / all.length) * 100);
  const nextUp = all.find((x) => !isDone(x.course.id, x.lesson.id));
  const alive = p.lastDay === day(new Date()) || p.lastDay === day(new Date(Date.now() - 864e5));
  const R = 34, C = 2 * Math.PI * R;

  return (
    <div className="lh">
      <header className="lh-hero">
        <div>
          <h1>Learn chess</h1>
          <p className="lede">Short, interactive lessons. Move the pieces, answer quick questions and earn stars as you go.</p>
        </div>
        <div className="lh-stats">
          <div className="lh-ring" aria-label={`${pct}% of lessons complete`}>
            <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r={R} className="bg" /><circle cx="40" cy="40" r={R} className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 40 40)" /></svg>
            <span>{pct}%</span>
          </div>
          <div className="lh-stat"><strong>{doneCount}/{all.length}</strong><span>lessons</span></div>
          <div className="lh-stat"><strong>{stars}</strong><span>stars</span></div>
          <div className="lh-stat"><strong>{p.xp}</strong><span>XP</span></div>
          <div className="lh-stat"><strong>{alive ? p.streak : 0}</strong><span>day streak</span></div>
        </div>
      </header>

      {nextUp ? (
        <section className="lh-next card" style={{ borderLeftColor: nextUp.course.color }}>
          <div>
            <span className="muted">{doneCount === 0 ? "Start here" : "Up next"} · {nextUp.course.title}</span>
            <h2>{nextUp.lesson.title}</h2>
            <p className="muted">{nextUp.lesson.blurb}</p>
          </div>
          <Link className="btn primary" href={`/learn/${nextUp.course.id}/${nextUp.lesson.id}`}>{doneCount === 0 ? "Start lesson" : "Continue"}</Link>
        </section>
      ) : (
        <section className="lh-next card"><div><h2>You have finished every lesson!</h2><p className="muted">Keep sharpening your tactics on the Puzzles page, or review a game.</p></div><Link className="btn primary" href="/puzzles">Train tactics</Link></section>
      )}

      {(["Beginner", "Intermediate"] as const).map((level) => (
        <section key={level}>
          <h2 className="lh-level">{level}</h2>
          <div className="lh-grid">
            {COURSES.filter((c) => c.level === level).map((c) => {
              const d = c.lessons.filter((l) => isDone(c.id, l.id)).length;
              return (
                <Link key={c.id} href={`/learn/${c.id}`} className="lh-card">
                  <div className="lh-band" style={{ background: c.color }}><span>{c.glyph}</span></div>
                  <div className="lh-body">
                    <h3>{c.title}</h3>
                    <p className="muted">{c.blurb}</p>
                    <div className="lh-progress"><div style={{ width: `${(d / c.lessons.length) * 100}%`, background: c.color }} /></div>
                    <span className="muted">{d} of {c.lessons.length} lessons</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
