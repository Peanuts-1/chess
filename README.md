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
