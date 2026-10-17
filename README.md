# Openfile — play and learn chess (Next.js)

```bash
npm install
npm run dev      # http://localhost:3000
```

- `lib/chess.ts`   rules: move generation, check/mate/stalemate, castling, en passant, promotion, SAN
- `lib/engine.ts`  engine: alpha-beta search with quiescence, iterative deepening, 3 strength levels
- `lib/lessons.ts` lesson and puzzle content for /learn
- `components/Board.tsx` the interactive board (tap a piece, tap a highlighted square)

## Themes
Settings → Appearance (system, light, dark) and Board colours. Choices are saved in the browser.

## Leela Chess Zero (optional)
The built-in engine works out of the box. To use the real Leela for Review, hints and the Play opponent:

1. Download `lc0` and a network file from https://lczero.org
2. `cp .env.local.example .env.local` and set `LC0_PATH` and `LC0_WEIGHTS`
3. Restart `npm run dev`, open Settings, choose Leela, press Test connection

lc0 is started by the site's server (`lib/lc0.ts`), so this only works when you run the site yourself.
Don't expose a server with `LC0_PATH` set to the public internet: anyone could use your CPU/GPU.

## Tactics trainer (/puzzles)
Modelled on ChessTempo's tactics trainer: a solve timer, your own Glicko rating and a rating for each problem,
Standard and Blitz scoring, Give up / Next problem, tags revealed after each problem, a session panel,
a rating graph and a list of recent problems you can retry.

- **Lichess source (default):** problems come from the Lichess open puzzle database through `app/api/puzzle/route.ts`
  (needs an internet connection). Pick a problem type (fork, pin, mate in 2, endgame, ...) and they are chosen near your rating.
- **Offline source:** 41 generated, verified problems in `lib/puzzle-data.ts`. Their ratings are estimates.
- If Lichess can't be reached, the trainer falls back to the offline set.
- Ratings and history are saved in your browser (`localStorage`).

## Learn (/learn)
A course library in the style of chess.com's Lessons: 7 courses, 44 lessons, 163 steps (including 15 opening lessons) (`lib/curriculum.ts`).
Lessons mix explanations, free exploration, "make this move" tasks, play-along opening lines, quizzes and
checkmate practice against the engine. Hints, stars (3 = no mistakes and no hints), XP and a day streak are saved in the browser.
To add a lesson, add an entry to `COURSES` in `lib/curriculum.ts`: step types are `explain`, `explore`, `move`, `quiz`, `line` and `play`.

## Speed and pieces
- **Engine:** transposition table, lazy move legality and killer-move ordering make the built-in search about 8x faster at the same depth (`lib/engine.ts`).
- **Review:** positions are analysed in parallel on Web Workers (`lib/pool.ts`, `lib/analysis.worker.ts`). A fast first pass shows the review within seconds; Standard and Deeper then refine the grades in the background.
- **Pieces:** vector SVG pieces (`components/Pieces.tsx`) instead of font characters, so they look the same on every device. Settings → Piece style switches between Classic, Slate, Wood and High contrast.

## Review: engine lines and drawing
- **Engine lines** (Review → right panel): the top three moves for the position on screen, each with an evaluation and a short variation
  (`analyzeLines` in `lib/engine.ts`, run on a Web Worker). Click a move to play the line on the board, or move the pieces yourself;
  the engine re-analyses the new position. Esc or "Back to game" returns to the game.
- **Drawing** (`components/Board.tsx`): right-click and drag draws an arrow, right-click a square circles it.
  Shift = red, Ctrl = blue, Alt = yellow. Click the board or change position to clear. The "✎ Draw" button lets you draw with the left button or a finger.

## Leela review speed
Reviews with Leela show a quick first look within seconds (30 nodes per position), then refine it (Standard 300, Deeper 1200 nodes).
The server runs `LC0_PROCESSES` lc0 processes (default 2, max 4) so several positions are searched at once, caches results it has already computed,
and uses fewer nodes on the first moves of a game. Extra lc0 options can be passed with `LC0_ARGS`.

## Review: more like chess.com and lichess
- **Opening names and Book moves** (`lib/openings.ts`): ~110 openings matched by position, so transpositions are recognised. Theory moves are graded "Book".
- **Miss**: a grade for failing to punish an opponent's mistake. Average centipawn loss and accuracy per game phase are in the Insights tab.
- **Clocks**: if the PGN has `[%clk]` comments (chess.com and lichess exports do), the review shows each player's clock and a "move times" chart.
- **Material**: captured pieces and the material lead are shown next to each player.
- **Learn from your mistakes**: steps through your mistakes, misses and blunders and asks you to find a better move for each.
- **Export**: copy or download an annotated PGN (`[%eval]` and `[%clk]` comments, `?!` `?` `??` marks) and copy the current FEN.
- **Shortcuts**: arrows step, Home/End, F flips, `[` and `]` jump to the previous/next mistake, Esc leaves a line you are exploring.

## Analysis board (/analysis)
A free board for self-study. Move pieces for either side, try variations (shown like lichess, with brackets), load a FEN or a PGN, and
watch live engine lines. Turn on any of **Stockfish**, **Leela (lc0)** and the **built-in engine**: each shows its top moves with
evaluations and variations (click a move to play the line), and the page tells you when the engines disagree. Every move you play is graded
(best, inaccuracy, blunder...) from the engine evaluations. Engines search in stages (shallow first, then deeper), so answers appear quickly and improve.
- Stockfish and Leela run on your computer through the site's server (`lib/uci.ts`, `app/api/engine/route.ts`). Set `STOCKFISH_PATH` (and optionally
  `STOCKFISH_THREADS`, `STOCKFISH_HASH`, `STOCKFISH_PROCESSES`) next to the Leela settings in `.env.local`.
- The Review page's "Open in analysis board" button sends the current game here.
- Layout: the board stays in view while a single side panel scrolls. Engine toggles and lines sit at the top, the move list (a table, with variations as indented blocks) fills the rest, and FEN/PGN setup is on its own tab.
