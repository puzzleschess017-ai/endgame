# Chess Tactics Guide — Endgame Woodpecker

Chess endgame training with the Woodpecker Method: solve the same set of puzzles
over several cycles and watch your speed and accuracy improve. Puzzles come from
the [Lichess puzzle database](https://database.lichess.org/#puzzles).

## Run locally

Requirements: Node.js 22.18 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The terminal should print
`Chess Tactics Guide server listening on http://0.0.0.0:3000`.

No API keys or `.env` file are needed.

If `npm install` stops with a `node-gyp` or Python error, run `npm install --ignore-scripts`
instead: `better-sqlite3` ships prebuilt binaries for Windows, macOS and Linux, so nothing
needs to be compiled.

This is not a plain Vite app: `npm run dev` starts `server.ts` (an Express server
that exposes the puzzle API and serves the Vite dev server as middleware). Running
`vite` on its own, or opening `index.html` directly, shows the page without puzzles.

## Project layout

| Path | What it is |
| --- | --- |
| `src/` | React frontend (`App.tsx` is the Woodpecker trainer, `pages/` has one component per extra page such as `/coordinates` or `/editor`, plus `components/` and `utils/`) |
| `server.ts` | Express server: `/api/puzzles/sample`, `/api/puzzles/ladder`, `/api/puzzles`, `/api/stats`, `/api/health` |
| `server/ladder.ts` | Builds the easy-to-hard puzzle ladder for Streak and Race |
| `endgame.db` | SQLite database with about 80,000 Lichess puzzles, 18.6 MB (read-only at runtime) |
| `scripts/build-endgame-db.mjs` | Original build of the database from the Lichess CSV dump |
| `scripts/extend-db.mjs` | Adds more puzzles to the existing database (see "What is in the database") |
| `scripts/lib/endgame-rule.mjs` | The material rule that decides what counts as a real endgame (used by both scripts) |
| `public/` | Piece sets and fonts |

## Puzzle selection

Puzzles are sampled at random for the chosen difficulty (rating ranges: easy < 1200,
medium 1200–1599, hard 1600–1999, expert 2000+). Only puzzles flagged `is_endgame = 1`
are used. The flag is computed with the material rule in
`applyFirstMoveAndCheckEndgame` (`scripts/lib/endgame-rule.mjs`); the Lichess
`endgame` tag alone is much too loose and also matches positions with many pieces.
If the database has no `is_endgame` column, the server falls back to the tag.

## What is in the database

| Rows | What |
| --- | --- |
| 47,851 with `is_endgame = 1` | Real endgames. Only these are used by Woodpecker |
| about 32,000 with `is_endgame = 0` | Puzzles of every other kind (opening, middlegame, tactics) plus endgame-tagged puzzles with too much material. Meant for Streak, Race and Blindfold, which use every row |
| 10,445 one-move mates | Puzzles with exactly two moves (mate in 1); 4,419 of them have at most 10 pieces, for Blindfold |

The database is kept small on purpose because the site runs on free hosting (about 230 bytes
per puzzle). To add puzzles, download `lichess_db_puzzle.csv.zst` from
https://database.lichess.org/#puzzles and run
`node scripts/extend-db.mjs lichess_db_puzzle.csv.zst --dry` to see how many candidates there are, then
without `--dry` to write them. Existing rows are never changed, the choice is deterministic and
the new rows must pass the same quality filter (popularity at least 95, rating deviation at most 120).

## Production

```bash
npm run build
NODE_ENV=production npm start
```

In production `server.ts` serves the built files from `dist/` and falls back to
`index.html` for every other path.

Render builds with `bun install --frozen-lockfile && bun run build`, so
`bun.lock` must always match `package.json`. After adding, removing or updating
a dependency, run `bun install` and commit `bun.lock` together with
`package.json` and `package-lock.json`; otherwise the Render build fails.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Home, a dashboard: a Tools section (links to the Board Editor and the Analysis Board), then six overview tiles (puzzles solved, total training time and sessions, daily streak, average accuracy, best Puzzle Streak, Woodpecker cycles) and four bar charts (sessions, minutes, puzzles, accuracy per day) with a 7 / 30 / 90 days switch. Everything is read from the browser. Unknown paths show Home too |
| `/woodpecker` | Woodpecker endgame trainer (it used to be on `/`) |
| `/statistics` | Statistics: personal records of every mode and the last Woodpecker cycles |
| `/coordinates` | Coordinates trainer: click the named square against the clock (30 or 60 s, white, black or random side). The board has no labels, on purpose |
| `/streak` | Puzzle Streak: puzzles from the whole database, easy to hard, one wrong move ends the run, one skip allowed, best streak saved in the browser |
| `/race` | Puzzle Race: solve as many puzzles as possible in 1, 3 or 5 minutes, easy to hard from the whole database. A wrong move costs 10 seconds and moves on to the next puzzle. Best score per time saved in the browser (a run ended early is not saved) |
| `/blindfold` | Blindfold: *Mate in 1* (memorize a position for 5, 10 or 20 s, the pieces vanish, type the checkmate in algebraic notation; levels by number of pieces: up to 6, 8, 10 or any; a round is 10 puzzles) and *Drills* (60 s without a board: square color, same diagonal, knight route). Best scores saved in the browser |
| `/editor` | Board Editor: set up any position by dragging pieces in from the palette (or choosing a piece and tapping squares), moving them, or dragging them off the board; side to move, castling rights and en passant; load or copy a FEN; "Analyze this position" opens it on the Analysis Board. A position is only analyzable when it is legal (both kings, no pawns on the first or last rank, the side not to move is not in check) |
| `/analysis` | Analysis Board: play moves for both sides, step through the game (buttons, arrow keys, Home/End, click a move), play a different move to replace the rest of the line, flip, reset, load a FEN, import a PGN (main line; comments and variations are ignored) and copy the PGN. `?fen=...` in the address starts from that position. There is no engine, so no evaluation or best moves |

Every path is served by the same app (`main.tsx` picks the page from the URL). Logic that can be
tested without a browser lives in `src/utils/`; run all its tests with
`npx tsx --test src/utils/*.test.ts`.

Blindfold gets random mate-in-1 puzzles from `GET /api/puzzles/blindfold?maxPieces=8&count=10` (`maxPieces` is 6, 8, 10 or 32 = any; pieces are counted after the opponent's first move; the list of eligible ids is built once in memory by `server/blindfold.ts`). Run its tests with `npx tsx --test server/*.test.ts`.

Streak and Race get their puzzles from `GET /api/puzzles/ladder?start=500&step=40&count=30` (Race asks for `step=25`): one
random puzzle per rating step (start, start + step, ...), easy first, from every puzzle in the
database. `src/utils/ladderFeed.ts` asks for the next batch before the current one runs out, and
`src/hooks/usePuzzleSolver.ts` plays a puzzle on the board (opponent's replies, promotion, first
wrong move reported to the page).

### Adding a new mode

Every mode must look the same as Woodpecker: build the page with `TrainerLayout`
(`src/components/TrainerLayout.tsx`: the menu on the left, then the board column and the
right-hand panel in fixed places), draw the board inside an element that uses `BOARD_FRAME_CLASS`
and whose side comes from `snapBoardSize` (both in `src/utils/appearance.ts`), add the page to
`NAV_GROUPS` in `src/components/Sidebar.tsx` (pick a group, an icon and its colour) and to `PAGES`
in `src/main.tsx`. That keeps the board size, corners and panel position identical on every page.
Get the board size, colours and pieces from `useAppearance()` (`src/hooks/useAppearance.ts`) and pass
them to `TrainerLayout` as `appearance` / `onAppearanceChange`: the layout then shows the board size
buttons (+ / −) and the board settings button under the board, so every mode can resize its board and
the choice is saved once for all pages (`endgame_woodpecker_appearance_v1`).
To show the mode's records on the Statistics page, add its lines to `collectHomeStats` in
`src/utils/stats.ts`. To make its runs count in the Home dashboard, call `recordActivity` from
`src/utils/activity.ts` when a run ends (`mode`, time spent in ms, correct and wrong answers, puzzles).

The menu (`Sidebar.tsx`) is a full-height panel on the left from 1280 px width, with the groups
PUZZLES, TRAINING and PROGRESS that can be collapsed (remembered in `ctg_sidebar_collapsed_v1`);
on smaller screens it is a bar on top of the page with one scrolling row. Every page sits inside
`AppShell.tsx`, so the menu never moves. Each entry has a coloured icon.

Home and Statistics read the browser's data only:
`ctg_activity_v1` holds one total per day (sessions, time, answers, puzzles; the last 400 days) and
feeds the tiles and charts, it starts empty the first time the site is opened after this feature;
finished Woodpecker cycles are also kept in `ctg_woodpecker_history_v1` (last 300).

### Sound

Sounds are made with the Web Audio API in `src/utils/sound.ts` (no audio files). There are two
styles, *Robotic* (the original electronic blips, the default) and *Classic* (a piece set down on a
wooden board, built from filtered noise clicks and a short fading tone). The speaker button in the
menu (`src/components/SoundMenu.tsx`) opens a bubble with the volume slider, a mute switch and the
choice of style. Volume, style and mute are one setting for the whole site, saved in
`ctg_sound_v1` and read with `useSoundSettings()`. Pages just call `playMoveSound('move' | 'capture' |
'check' | 'error' | 'success')`; nothing needs to pass a muted flag around. In the volume slider 50 %
is the loudness the site always had and 100 % is twice that.

### Board Editor and Analysis Board

The two tools share the board component with the trainers. `ChessboardPanel` has an optional `edit`
prop that turns it into an editor (free movement, a piece dragged off the board is deleted, new
pieces can be dragged in with chessground's `dragNewPiece`). The logic that needs no browser lives in
`src/utils/editor.ts` (building, reading and validating FENs: castling rights and en passant are only
written when they are possible) and `src/utils/analysis.ts` (the game being looked at: moves, going
back and forth, replacing a line, status text, PGN in and out). Both are covered by unit tests.
Analysis has no engine on purpose: a chess engine would add a large download and its own licence.

## Saved progress

Training sessions and settings are stored in the browser (`localStorage`), so they
are tied to one browser and are lost if site data is cleared.
