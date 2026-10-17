"use client";
import { BOARDS, PIECE_STYLES, useSettings } from "./Settings";
import type { BoardTheme, EngineChoice, Mode, PieceStyle } from "./Settings";
import PieceSvg from "./Pieces";

const MODES: { id: Mode; label: string }[] = [
  { id: "system", label: "Match my device" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" },
];

export default function SettingsPanel() {
  const { settings, set, leela, checkLeela, stockfish, checkStockfish } = useSettings();
  const note =
    settings.engine !== "leela" ? "Not in use." :
    leela.status === "ready" ? "Connected. Leela is used for Review, hints and the Play opponent." :
    leela.status === "missing" ? leela.reason || "Not connected." : "Checking…";
  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="card">
        <h2>Appearance</h2>
        <div className="radios" role="radiogroup" aria-label="Colour mode">
          {MODES.map((m) => (
            <label key={m.id} className={"radio" + (settings.mode === m.id ? " on" : "")}>
              <input type="radio" name="mode" checked={settings.mode === m.id} onChange={() => set({ mode: m.id as Mode })} />{m.label}
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Board colours</h2>
        <div className="swatches" role="radiogroup" aria-label="Board colours">
          {BOARDS.map((b) => (
            <button key={b.id} data-board={b.id} className={"swatch" + (settings.board === b.id ? " on" : "")}
              role="radio" aria-checked={settings.board === b.id} onClick={() => set({ board: b.id as BoardTheme })}>
              <span className="sw"><i /><i /><i /><i /><i /><i /><i /><i /></span>
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Piece style</h2>
        <div className="swatches" role="radiogroup" aria-label="Piece style">
          {PIECE_STYLES.map((ps) => (
            <button key={ps.id} data-pieces={ps.id} className={"swatch" + (settings.pieces === ps.id ? " on" : "")}
              role="radio" aria-checked={settings.pieces === ps.id} onClick={() => set({ pieces: ps.id as PieceStyle })}>
              <span className="pp"><PieceSvg type="n" white /><PieceSvg type="q" white={false} /></span>
              {ps.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Engine</h2>
        <div className="radios" role="radiogroup" aria-label="Engine">
          <label className={"radio" + (settings.engine === "builtin" ? " on" : "")}>
            <input type="radio" name="engine" checked={settings.engine === "builtin"} onChange={() => set({ engine: "builtin" as EngineChoice })} />Built-in engine
          </label>
          <label className={"radio" + (settings.engine === "leela" ? " on" : "")}>
            <input type="radio" name="engine" checked={settings.engine === "leela"} onChange={() => set({ engine: "leela" as EngineChoice })} />Leela Chess Zero (lc0)
          </label>
        </div>
        <p className={leela.status === "ready" && settings.engine === "leela" ? "good" : leela.status === "missing" && settings.engine === "leela" ? "bad" : "muted"}>{note}</p>
        <button className="btn small" onClick={checkLeela}>Test connection</button>

        <details>
          <summary>How to set up Leela</summary>
          <ol className="steps">
            <li>Download <strong>lc0</strong> and a network file from <a href="https://lczero.org" target="_blank" rel="noreferrer">lczero.org</a>. Leela needs a network to play. Any lc0-compatible network works, including human-like ones such as Maia.</li>
            <li>In the project folder, copy <code>.env.local.example</code> to <code>.env.local</code> and fill in <code>LC0_PATH</code> (the lc0 program) and <code>LC0_WEIGHTS</code> (the network file). Add <code>LC0_BACKEND</code> if lc0 does not pick a backend that suits your computer. <code>LC0_PROCESSES</code> (default 2, up to 4) sets how many lc0 processes review games at once: more is faster if your computer can take it.</li>
            <li>Restart <code>npm run dev</code>, choose Leela above, and press Test connection.</li>
          </ol>
          <p className="muted">Leela runs on your own computer through the site&apos;s server, so this works when you run the site locally. It will not work on hosting that cannot run lc0.</p>
        </details>
      </section>

      <section className="card">
        <h2>Stockfish (analysis board)</h2>
        <p className={stockfish.status === "ready" ? "good" : stockfish.status === "missing" ? "bad" : "muted"}>
          {stockfish.status === "ready" ? "Connected. Stockfish lines are available on the Analysis page."
            : stockfish.status === "missing" ? stockfish.reason || "Not connected."
            : stockfish.status === "checking" ? "Checking…" : "Not checked yet."}
        </p>
        <button className="btn small" onClick={checkStockfish}>Test connection</button>
        <details>
          <summary>How to set up Stockfish</summary>
          <ol className="steps">
            <li>Download <strong>Stockfish</strong> for your system from <a href="https://stockfishchess.org" target="_blank" rel="noreferrer">stockfishchess.org</a> and unzip it.</li>
            <li>In <code>.env.local</code>, set <code>STOCKFISH_PATH</code> to the Stockfish program. Optional: <code>STOCKFISH_THREADS</code> (default 1), <code>STOCKFISH_HASH</code> in MB (default 64) and <code>STOCKFISH_PROCESSES</code> (default 2).</li>
            <li>Restart <code>npm run dev</code> and press Test connection.</li>
          </ol>
          <p className="muted">Like Leela, Stockfish runs on your own computer through the site&apos;s server.</p>
        </details>
      </section>
    </div>
  );
}
