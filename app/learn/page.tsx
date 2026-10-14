import LessonBoard from "@/components/LessonBoard";
import { SECTIONS } from "@/lib/lessons";

export const metadata = { title: "Learn chess — Openfile" };

export default function Learn() {
  return (
    <div className="learn">
      <h1>Learn chess</h1>
      <p className="lede">Each lesson has a board you can move on. Start at the top if you are new, or jump to the puzzles.</p>
      <nav className="toc">
        {SECTIONS.map((s) => <a key={s.title} href={`#${s.title.replace(/\W+/g, "-").toLowerCase()}`}>{s.title}</a>)}
      </nav>
      {SECTIONS.map((s) => (
        <section key={s.title} id={s.title.replace(/\W+/g, "-").toLowerCase()}>
          <h2>{s.title}</h2>
          <p className="lede">{s.intro}</p>
          {s.lessons.map((l) => (
            <article key={l.id} className="lesson">
              <div className="lesson-text">
                <h3>{l.title}</h3>
                {l.body.map((t, i) => <p key={i}>{t}</p>)}
              </div>
              <LessonBoard lesson={l} />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
