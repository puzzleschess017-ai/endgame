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
| `src/` | React frontend (`App.tsx` is the Woodpecker trainer, `pages/` has one component per extra page such as `/coordinates`, plus `components/` and `utils/`) |
| `server.ts` | Express server: `/api/puzzles/sample`, `/api/puzzles`, `/api/stats`, `/api/health` |
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
| `/` | Woodpecker endgame trainer |
| `/coordinates` | Coordinates trainer: click the named square against the clock (30 or 60 s, white, black or random side). The board has no labels, on purpose |

Every path is served by the same app (`main.tsx` picks the page from the URL). Logic that can be
tested without a browser lives in `src/utils/`; run its tests with
`npx tsx --test src/utils/coordinates.test.ts`.

### Adding a new mode

Every mode must look the same as Woodpecker: build the page with `TrainerLayout`
(`src/components/TrainerLayout.tsx`, header, board column and right-hand panel in fixed places),
draw the board inside an element that uses `BOARD_FRAME_CLASS` and whose side comes from
`snapBoardSize` (both in `src/utils/appearance.ts`), and add the page to `NAV_ITEMS` in
`SiteHeader.tsx`. That keeps the board size, corners and panel position identical on every page.

## Saved progress

Training sessions and settings are stored in the browser (`localStorage`), so they
are tied to one browser and are lost if site data is cleared.
