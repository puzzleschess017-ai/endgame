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

Woodpecker has two puzzle types, chosen above the difficulty: *Endgame* (the default) draws only from
real endgames, *Classic* draws from every puzzle in the database (endgames included, about 60 % of the
rows, the rest are opening, middlegame and tactics puzzles). The API takes `mode=classic|endgame`
(`GET /api/puzzles/sample?count=50&difficulty=mixed&mode=classic`, endgame when `mode` is missing).

Puzzles are sampled at random for the chosen difficulty (rating ranges: easy < 1200,
medium 1200–1599, hard 1600–1999, expert 2000+). *Mixed* takes an even share from each of the four
ranges and shuffles them together (10 puzzles = 2 or 3 from each; the extra ones go to randomly
chosen ranges, see `server/woodpecker.ts`). In the Endgame type only puzzles flagged `is_endgame = 1`
are used. The flag is computed with the material rule in
`applyFirstMoveAndCheckEndgame` (`scripts/lib/endgame-rule.mjs`); the Lichess
`endgame` tag alone is much too loose and also matches positions with many pieces.
If the database has no `is_endgame` column, the server falls back to the tag.

## What is in the database

| Rows | What |
| --- | --- |
| 47,851 with `is_endgame = 1` | Real endgames. The only puzzles in the Endgame type of Woodpecker (Classic uses all rows) |
| about 32,000 with `is_endgame = 0` | Puzzles of every other kind (opening, middlegame, tactics) plus endgame-tagged puzzles with too much material. Used by Classic Woodpecker, Streak, Race and Blindfold, which use every row |
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
| `/` | Home, a dashboard: six overview tiles (puzzles solved, total training time and sessions, daily streak, average accuracy, best Puzzle Streak, Woodpecker cycles) and four bar charts (sessions, minutes, puzzles, accuracy per day) with a 7 / 30 / 90 days switch. Everything is read from the browser. Unknown paths show Home too |
| `/woodpecker` | Woodpecker endgame trainer (it used to be on `/`) |
| `/statistics` | Statistics: personal records of every mode and the last Woodpecker cycles |
| `/coordinates` | Coordinates trainer: click the named square against the clock (30 or 60 s, white, black or random side). The board has no labels, on purpose |
| `/streak` | Puzzle Streak: puzzles from the whole database, easy to hard, one wrong move ends the run, one skip allowed, best streak saved in the browser |
| `/race` | Puzzle Race: solve as many puzzles as possible in 1, 3 or 5 minutes, easy to hard from the whole database. A wrong move costs 10 seconds and moves on to the next puzzle. Best score per time saved in the browser (a run ended early is not saved) |
| `/login` | Sign in, create an account or play as a guest; the account page (name, email, plan, Sign out) for someone signed in |
| `/blindfold` | Blindfold: *Checkmate* (mate in 1, 2 or 3: memorize a position for 5, 10 or 20 s, the pieces vanish, type the checkmate in algebraic notation; in a mate in 2 or 3 you type your moves one at a time, the opponent's reply is shown as text after each right one and the board stays empty; checkmate always counts, other moves must be the puzzle's own; levels by number of pieces: up to 6, 7, 8, 10 or any; a round is 10 puzzles; a best score for each length and level) and *Drills* (60 s without a board: square color, check or not, same diagonal, knight route). Best scores saved in the browser |
| `/editor` | Board Editor: set up any position by dragging pieces in from the palette (or choosing a piece and tapping squares), moving them, or dragging them off the board; side to move, castling rights and en passant; load or copy a FEN; "Check in the Tablebase" opens it on the Tablebase page. The button is only on when the position is legal (both kings, no pawns on the first or last rank, the side not to move is not in check) |
| `/tablebase` | Endgame Tablebase: perfect play for any position with 7 pieces or fewer (Syzygy tables, through the public Lichess tablebase). Shows who wins (with the mate distance when known), draws by the 50-move rule, and every legal move marked Wins / Draws / Loses, best first; click a move to play it, hover to see it as an arrow. Play on the board, step through the game (buttons, arrow keys, Home/End), try the example positions (K+Q vs K, K+R vs K, K+P vs K, Lucena), load a FEN, import and copy a PGN. `?fen=...` starts from a position. Positions with more than 7 pieces or with castling rights cannot be looked up and say so |

Every path is served by the same app (`main.tsx` picks the page from the URL). Logic that can be
tested without a browser lives in `src/utils/`; run all its tests with
`npx tsx --test src/utils/*.test.ts`.

Blindfold gets random mate puzzles from `GET /api/puzzles/blindfold?maxPieces=8&count=10&mateIn=2` (`mateIn` is 1, 2 or 3 and 1 when missing: a mate in N is a puzzle with 2N moves, and for 2 and 3 also with Lichess's `mateInN` tag, about 9,200 and 3,300 puzzles, no new data; `maxPieces` is 6, 7, 8, 10 or 32 = any; pieces are counted after the opponent's first move; the list of eligible ids is built once in memory by `server/blindfold.ts`). Run its tests with `npx tsx --test server/*.test.ts`.

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
PUZZLES, TRAINING, TOOLS (Board Editor, Endgame Tablebase) and PROGRESS that can be collapsed (remembered in `ctg_sidebar_collapsed_v1`);
on smaller screens it is a bar on top of the page with one scrolling row. Every page sits inside
`AppShell.tsx`, so the menu never moves. Each entry has a coloured icon.

Home and Statistics read the browser's data only:
`ctg_activity_v1` holds one total per day (sessions, time, answers, puzzles; the last 400 days) and
feeds the tiles and charts, it starts empty the first time the site is opened after this feature;
finished Woodpecker cycles are also kept in `ctg_woodpecker_history_v1` (last 300).

### Sound

Sounds are made with the Web Audio API in `src/utils/sound.ts` (no audio files): short electronic
blips. The speaker button in the menu (`src/components/SoundMenu.tsx`) opens a bubble with the volume
slider and a mute switch; letting go of the slider plays one sound so the level can be heard. Volume
and mute are one setting for the whole site, saved in `ctg_sound_v1` and read with
`useSoundSettings()`. Pages just call `playMoveSound('move' | 'capture' | 'check' | 'error' |
'success')`; nothing needs to pass a muted flag around. In the volume slider 50 % is the loudness
the site always had and 100 % is twice that.

### Board Editor and Endgame Tablebase

The two tools are for bigger screens: below 640 px (phones) they are not in the top menu, and opening `/editor` or
`/tablebase` there shows a short note with a link Home (`BigScreenOnly`; the tool code is not even downloaded).
On phones the top menu also scrolls so the current page's entry sits in the middle and stays highlighted.

The two tools share the board component with the trainers. `ChessboardPanel` has an optional `edit`
prop that turns it into an editor (free movement, a piece dragged off the board is deleted, new
pieces can be dragged in with chessground's `dragNewPiece`). The logic that needs no browser lives in
`src/utils/editor.ts` (building, reading and validating FENs: castling rights and en passant are only
written when they are possible), `src/utils/analysis.ts` (the game being looked at: moves, going
back and forth, replacing a line, status text, PGN in and out) and `src/utils/tablebase.ts` (what can
be looked up and how the answer is worded). All are covered by unit tests.

The Tablebase page asks our own server, `GET /api/tablebase?fen=...`, never Lichess directly
(`server/tablebase.ts`). The server checks the FEN (legal, 7 pieces or fewer, no castling rights),
asks `https://tablebase.lichess.org/standard`, turns the move results around so they describe the
player who makes the move, and keeps every answer for a day (the same position is one request, even
when many people ask at once). Failures are never kept, and there is a ceiling of 240 requests per
minute to Lichess in total. Set `TABLEBASE_URL` to use another host (the tests use a local fake).
There is no engine: a chess engine would add a large download and its own licence, so only the
endgames the tablebase covers are analysed.

### Search engines (SEO)

`server/seo.ts` holds the title, description and "may be listed" flag of every page (`PAGES`). In
production the server puts them into `index.html` for the path asked for (title, description, canonical
link, robots, Open Graph and Twitter tags, JSON-LD), because not every crawler runs the app. It also
serves `/robots.txt` and `/sitemap.xml` (the indexable pages). `/statistics` is personal, so it is
`noindex` and not in the sitemap; a path the app does not have shows Home with status 404.
`SITE_URL` (default `https://chesstacticsguide.com`) is the address used in canonical links and the
sitemap. **A new page needs one entry in `PAGES`** (plus its route in `src/main.tsx`). Descriptions
should stay 50-170 characters and titles under 70; `server/seo.test.ts` checks that.

### Accounts (sign-in)

Sign-in uses [Supabase](https://supabase.com) (project address and public key in `src/auth/project.ts`;
they are public by design, the data is protected by row level security; `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` override them). There is no extra package: `src/auth/client.ts` talks to
Supabase with `fetch`, `src/auth/store.ts` keeps who is signed in (saved in `ctg_auth_v1`, token refreshed
before it ends, other tabs follow) and `useAuth()` gives a page `tier`: `guest` (nobody signed in), `free`
or `premium`. The page `/login` has sign in, create account and "Play as a guest"; for someone signed in it
shows the account and Sign out. `?next=/streak` sends the visitor back to that page afterwards.

`supabase/schema.sql` is pasted once into Supabase (SQL Editor) and makes the `profiles` table (name and
plan, one row per account, created by a trigger). People can read their row and change their name only;
the plan (`free` or `premium`) is changed by hand in the Supabase Table Editor until payments exist.

#### Welcome window

A visitor who has neither signed in nor chosen "Play as a guest" sees a window over every page (the page behind
it is blurred and cannot be used): create a free account, sign in, or play as a guest
(`src/components/AccessGate.tsx`, drawn by `AppShell`). `/login` itself is never covered. The guest choice is
remembered in this browser (`ctg_guest_v1`, `src/auth/guest.ts`) and forgotten when someone signs out, so the
window comes back after signing out.

#### What each plan may use

`src/utils/access.ts` is the one table of rules, used by the pages and by the server.

| | Guest | Signed in (free) | Premium |
|---|---|---|---|
| Woodpecker type | Classic | Classic | Classic and Endgame |
| Difficulty | Easy, Medium | Easy, Medium, Hard | all, with Expert and Mixed |
| Puzzles per cycle | 10, 50 | 10, 50, 100 | 10, 50, 100, 200, 300, 500 |
| Cycles | 2, 3 | 2, 3, 4 | 2 to 9 |
| Blindfold mate in 1 | page visible, every choice locked | up to 6 or 7 pieces, 10 s | all levels, 5, 10 and 20 s |
| Blindfold mate in 2 and 3 | locked | locked | yes |
| Blindfold drills | page visible, every choice locked | square colours, check or not | all |
| Streak, Race, Coordinates, Board Editor, Tablebase, Statistics | yes | yes | yes |

Choices a visitor may not use stay visible with a small lock; clicking one says to sign in or that it is
Premium (`src/components/locks.tsx`). A guest who opens Blindfold sees the same page as everybody, with every choice locked and "Create a free account to play" instead of Start. The server checks the rest: `/api/puzzles/sample` (type, difficulty, number of puzzles) and
`/api/puzzles/blindfold` (pieces, and mate in 2 or 3) read the sign-in token from the `Authorization` header, ask Supabase who it
is and which plan the account has (`server/tier.ts`, answers kept for a minute) and answer `403` with
`{ error, needs }` when the plan is too low, `401` when the token has expired. If Supabase cannot be
reached a signed-in visitor counts as free. The number of cycles, the memorize time and the drills never
reach the server, so those are locked in the browser only. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`
can override the project on the server too.

#### Results on the account (sync)

Results follow the account to every device (`src/sync/`). The pages still write their results to
`localStorage` as before; the sync watches only the keys in `src/sync/data.ts` (daily activity, finished
Woodpecker cycles, personal bests of Streak, Race, Coordinates, Blindfold and Drills). Settings such as board
colours and sound stay on the device. On the server they are one row per key in the table `user_data`
(created by `supabase/schema.sql`, protected so everybody sees only their own rows).

- **Signing in:** the account's results are read and put together with the ones in this browser. Results made
  as a guest are *added* to the account (days are summed, bests take the larger value, cycles are joined by
  their id), once. Later syncs of the same account never add anything twice (`reconcile`: the larger value of
  each day wins).
- **While signed in:** a changed result is saved within about 5 seconds; the account is read again when the
  tab comes back, after reconnecting and every 5 minutes, so results from another device show up (Home and
  Statistics redraw by themselves).
- **Signing out:** the results are saved first (waits 4 seconds at most), then removed from this browser, so the
  next visitor is a guest. Results that could not be saved are kept and count as the guest's own, and go to
  the next account that signs in.
- **When saving fails** (offline, or the table is missing) nothing in the browser changes; the account page
  says so and the sync tries again after a minute.
- Known limit: two devices that train on the same day while offline both count that day; when they meet, the
  larger day total is kept, so a few sessions of that day can be missed.

## Saved progress

Training sessions and settings are stored in the browser (`localStorage`). Results (not settings or the
unfinished Woodpecker set) are also saved on the account when someone is signed in; as a guest they live in the
browser only and are lost if site data is cleared.
