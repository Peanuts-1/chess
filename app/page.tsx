import Link from "next/link";
import Sandbox from "@/components/Sandbox";

export default function Home() {
  return (
    <section className="hero">
      <div className="hero-text">
        <h1>Play chess. Then get better at it.</h1>
        <p>
          Openfile is a chess board that runs entirely in your browser. Play against an engine at three strengths,
          work through short lessons, or load a game from chess.com or a PGN file and get a move-by-move review with advice on what to improve.
        </p>
        <div className="cta">
          <Link href="/play" className="btn primary">Play the engine</Link>
          <Link href="/learn" className="btn">Start learning</Link>
          <Link href="/puzzles" className="btn">Solve puzzles</Link>
          <Link href="/review" className="btn">Review a game</Link>
        </div>
      </div>
      <Sandbox
        fen="r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 4 5"
        hint="This board is live. Tap a piece and move it."
      />
    </section>
  );
}
