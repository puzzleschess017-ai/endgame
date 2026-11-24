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
| `endgame.db` | SQLite database with 40,000 Lichess puzzles (read-only at runtime) |
| `scripts/build-endgame-db.mjs` | Rebuilds the database from the Lichess CSV dump |
| `public/` | Piece sets and fonts |

## Puzzle selection

Puzzles are sampled at random for the chosen difficulty (rating ranges: easy < 1200,
medium 1200–1599, hard 1600–1999, expert 2000+). Only puzzles flagged `is_endgame = 1`
are used. The flag is computed with the material rule in
`applyFirstMoveAndCheckEndgame` (`scripts/build-endgame-db.mjs`); the Lichess
`endgame` tag alone is much too loose and also matches positions with many pieces.
If the database has no `is_endgame` column, the server falls back to the tag.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

In production `server.ts` serves the built files from `dist/` and falls back to
`index.html` for every other path.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Woodpecker endgame trainer |
| `/coordinates` | Coordinates trainer: find the named square or name the highlighted one against the clock |

Every path is served by the same app (`main.tsx` picks the page from the URL). Logic that can be
tested without a browser lives in `src/utils/`; run its tests with
`npx tsx --test src/utils/coordinates.test.ts`.

## Saved progress

Training sessions and settings are stored in the browser (`localStorage`), so they
are tied to one browser and are lost if site data is cleared.
