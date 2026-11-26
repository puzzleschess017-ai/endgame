// Adds more puzzles to the existing endgame.db from the Lichess puzzle dump.
//
//   node scripts/extend-db.mjs /path/to/lichess_db_puzzle.csv.zst            # add puzzles
//   node scripts/extend-db.mjs /path/to/lichess_db_puzzle.csv.zst --dry      # only count candidates
//
// Options (all optional):
//   --endgames N   new real endgames, split evenly over the 4 difficulty bands (default 18000)
//   --general N    new puzzles of any other kind (opening, middlegame...), 4 bands (default 18000)
//   --mate1 N      new one-move mates with at most 10 pieces, for blindfold (default 4000)
//   --min-popularity N (95), --max-rd N (120), --min-plays N (190)   quality filter; the existing rows
//                  are all popularity 100 / rd <= 120 / plays >= 190, and 100 alone has too few left for hard and expert
//
// Nothing already in the database is touched. New rows get is_endgame = 1 only when the puzzle has a
// Lichess endgame tag, no opening/middlegame tag, and passes the material rule in lib/endgame-rule.mjs.
// Woodpecker only uses is_endgame = 1 rows; Streak, Race and Blindfold can use every row.
//
// The choice is deterministic (a hash of the puzzle id), so running it again gives the same rows.
// Keep the database small: the site is on free hosting, ~230 bytes per puzzle.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';
import {
  ENDGAME_TAGS,
  boardAfterFirstMove,
  countPieces,
  hasEndgameMaterial,
} from './lib/endgame-rule.mjs';

const DB_PATH = path.resolve(process.cwd(), 'endgame.db');

function parseArgs(argv) {
  const args = {
    input: null,
    dry: false,
    endgames: 18000,
    general: 18000,
    mate1: 4000,
    minPopularity: 95,
    maxRd: 120,
    minPlays: 190,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--endgames') args.endgames = Number(argv[++i]);
    else if (a === '--general') args.general = Number(argv[++i]);
    else if (a === '--mate1') args.mate1 = Number(argv[++i]);
    else if (a === '--min-popularity') args.minPopularity = Number(argv[++i]);
    else if (a === '--max-rd') args.maxRd = Number(argv[++i]);
    else if (a === '--min-plays') args.minPlays = Number(argv[++i]);
    else if (!a.startsWith('--') && !args.input) args.input = a;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.input) throw new Error('Usage: node scripts/extend-db.mjs <lichess_db_puzzle.csv.zst> [--dry]');
  for (const key of ['endgames', 'general', 'mate1', 'minPopularity', 'maxRd', 'minPlays']) {
    if (!Number.isFinite(args[key])) throw new Error(`Bad value for ${key}`);
  }
  return args;
}

/** FNV-1a, 32 bit, with a seed string so different uses give independent orders. */
function hash32(str, seed) {
  let h = 0x811c9dc5;
  const s = seed + ':' + str;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function difficultyBand(rating) {
  if (rating < 1200) return 0;
  if (rating < 1600) return 1;
  if (rating < 2000) return 2;
  return 3;
}
const BAND_NAMES = ['easy', 'medium', 'hard', 'expert'];

/** Keeps the `quota` items with the smallest score, without holding everything in memory. */
class Pool {
  constructor(quota) {
    this.quota = quota;
    this.items = [];
    this.candidates = 0;
  }
  add(item) {
    this.candidates++;
    this.items.push(item);
    if (this.items.length > this.quota * 2 + 1000) this.trim();
  }
  trim() {
    this.items.sort((a, b) => a.score - b.score);
    if (this.items.length > this.quota) this.items.length = this.quota;
  }
  result() {
    this.trim();
    return this.items;
  }
}

function* readCsvLines(file) {
  const buf = fs.readFileSync(file);
  // The dump is a series of zstd frames, each behind a 12-byte skippable header.
  const offsets = [];
  for (let i = 0; i < buf.length - 16; i++) {
    if (
      buf[i] === 0x50 && buf[i + 1] === 0x2a && buf[i + 2] === 0x4d && buf[i + 3] === 0x18 &&
      buf[i + 4] === 0x04 && buf[i + 5] === 0x00 && buf[i + 6] === 0x00 && buf[i + 7] === 0x00 &&
      buf[i + 12] === 0x28 && buf[i + 13] === 0xb5 && buf[i + 14] === 0x2f && buf[i + 15] === 0xfd
    ) {
      offsets.push(i);
    }
  }
  if (offsets.length === 0) throw new Error('This does not look like the Lichess puzzle .zst file.');
  console.log(`Found ${offsets.length} compressed blocks.`);
  let rest = '';
  for (let k = 0; k < offsets.length; k++) {
    const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length;
    const text = rest + zlib.zstdDecompressSync(buf.subarray(offsets[k] + 12, end)).toString('utf8');
    let start = 0;
    for (;;) {
      const nl = text.indexOf('\n', start);
      if (nl === -1) {
        rest = text.slice(start);
        break;
      }
      yield text.slice(start, nl);
      start = nl + 1;
    }
  }
  if (rest.trim()) yield rest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(DB_PATH)) throw new Error(`Missing ${DB_PATH}; run this from the repo root.`);
  const db = new Database(DB_PATH, { readonly: args.dry });

  const existingIds = new Set();
  const existingKeys = new Set();
  for (const r of db.prepare('SELECT puzzle_id, fen, moves FROM puzzles').iterate()) {
    existingIds.add(r.puzzle_id);
    existingKeys.add(`${r.fen.split(' ').slice(0, 2).join(' ')}|${r.moves}`);
  }
  console.log(`Existing puzzles: ${existingIds.size}`);

  const perBandEndgame = Math.floor(args.endgames / 4);
  const perBandGeneral = Math.floor(args.general / 4);
  const mate1Quotas = {
    le6: Math.round(args.mate1 * 0.25),
    le8: Math.round(args.mate1 * 0.375),
    le10: args.mate1 - Math.round(args.mate1 * 0.25) - Math.round(args.mate1 * 0.375),
  };
  const pools = {
    endgame: BAND_NAMES.map(() => new Pool(perBandEndgame)),
    general: BAND_NAMES.map(() => new Pool(perBandGeneral)),
    mate1: { le6: new Pool(mate1Quotas.le6), le8: new Pool(mate1Quotas.le8), le10: new Pool(mate1Quotas.le10) },
  };

  let scanned = 0;
  let skippedQuality = 0;
  let skippedExisting = 0;
  for (const line of readCsvLines(args.input)) {
    if (scanned === 0 && line.startsWith('PuzzleId,')) {
      scanned++;
      continue;
    }
    scanned++;
    const cols = line.split(',');
    if (cols.length < 9) continue;
    const [puzzleId, fen, movesStr, ratingStr, rdStr, popStr, playsStr, themes, gameUrl] = cols;
    const rating = parseInt(ratingStr, 10);
    const rd = parseInt(rdStr, 10);
    const popularity = parseInt(popStr, 10);
    const plays = parseInt(playsStr, 10);
    if (![rating, rd, popularity, plays].every(Number.isFinite)) continue;
    if (popularity < args.minPopularity || rd > args.maxRd || plays < args.minPlays) {
      skippedQuality++;
      continue;
    }
    if (existingIds.has(puzzleId)) {
      skippedExisting++;
      continue;
    }

    const moves = movesStr.split(' ');
    if (moves.length < 2) continue;
    const tags = themes.split(' ');
    let hasEndgameTag = false;
    let hasExcluded = false;
    let isMate1 = false;
    for (const tag of tags) {
      if (ENDGAME_TAGS.has(tag)) hasEndgameTag = true;
      else if (tag === 'opening' || tag === 'middlegame') hasExcluded = true;
      else if (tag === 'mateIn1') isMate1 = true;
    }

    // Only the positions that need the board are parsed (endgames and one-move mates).
    const needsBoard = hasEndgameTag || (isMate1 && moves.length === 2);
    const board = needsBoard ? boardAfterFirstMove(fen, moves[0]) : null;
    if (needsBoard && board === null) continue;

    const material = board !== null && hasEndgameMaterial(board);
    const isEndgame = hasEndgameTag && !hasExcluded && material ? 1 : 0;
    const dedupKey = `${fen.split(' ').slice(0, 2).join(' ')}|${movesStr}`;
    const item = {
      score: hash32(puzzleId, 'pick'),
      puzzleId,
      fen,
      moves: movesStr,
      rating,
      rd,
      popularity,
      plays,
      themes,
      gameUrl,
      isEndgame,
      dedupKey,
    };

    if (isMate1 && moves.length === 2 && board !== null) {
      const pieces = countPieces(board);
      if (pieces <= 10) {
        pools.mate1[pieces <= 6 ? 'le6' : pieces <= 8 ? 'le8' : 'le10'].add(item);
        continue;
      }
    }
    if (isEndgame) {
      pools.endgame[difficultyBand(rating)].add(item);
    } else if (!hasEndgameTag) {
      pools.general[difficultyBand(rating)].add(item);
    }
  }

  console.log(`Scanned ${scanned} lines (${skippedQuality} below the quality filter, ${skippedExisting} already in the database).`);
  const report = (label, pool, quota) =>
    console.log(`  ${label.padEnd(18)} candidates ${String(pool.candidates).padStart(8)}   wanted ${String(quota).padStart(6)}`);
  BAND_NAMES.forEach((n, i) => report(`endgame ${n}`, pools.endgame[i], perBandEndgame));
  BAND_NAMES.forEach((n, i) => report(`general ${n}`, pools.general[i], perBandGeneral));
  report('mate in 1, <=6 pcs', pools.mate1.le6, mate1Quotas.le6);
  report('mate in 1, 7-8 pcs', pools.mate1.le8, mate1Quotas.le8);
  report('mate in 1, 9-10 pcs', pools.mate1.le10, mate1Quotas.le10);

  if (args.dry) {
    console.log('Dry run: nothing written.');
    return;
  }

  // Collect the final picks, dropping any position that is already in (or twice in) the database.
  const picked = [];
  const seen = new Set(existingKeys);
  const counts = { endgame: 0, general: 0, mate1: 0 };
  const take = (items, kind) => {
    for (const it of items) {
      if (seen.has(it.dedupKey)) continue;
      seen.add(it.dedupKey);
      picked.push(it);
      counts[kind]++;
    }
  };
  pools.endgame.forEach((p) => take(p.result(), 'endgame'));
  pools.general.forEach((p) => take(p.result(), 'general'));
  Object.values(pools.mate1).forEach((p) => take(p.result(), 'mate1'));

  db.pragma('journal_mode = DELETE');
  db.pragma('synchronous = OFF');
  const insert = db.prepare(`
    INSERT INTO puzzles
      (puzzle_id, fen, moves, rating, rating_deviation, popularity, nb_plays, themes, game_url,
       is_sample, signature, rand_key, is_endgame)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)
  `);
  db.transaction(() => {
    for (const p of picked) {
      insert.run(
        p.puzzleId, p.fen, p.moves, p.rating, p.rd, p.popularity, p.plays, p.themes, p.gameUrl,
        hash32(p.puzzleId, 'rand') & 0x7fffffff,
        p.isEndgame,
      );
    }
  })();

  // Keep db_meta in step with the table.
  const total = db.prepare('SELECT COUNT(*) AS c FROM puzzles').get().c;
  const band = (lo, hi, extra = '') =>
    db.prepare(`SELECT COUNT(*) AS c FROM puzzles WHERE rating >= ? AND rating < ? ${extra}`).get(lo, hi).c;
  const bandRanges = [[0, 1200], [1200, 1600], [1600, 2000], [2000, 100000]];
  const difficultyCounts = {};
  const endgameByDifficulty = {};
  BAND_NAMES.forEach((n, i) => {
    difficultyCounts[n] = band(...bandRanges[i]);
    endgameByDifficulty[n] = band(...bandRanges[i], 'AND is_endgame = 1');
  });
  const flagged = db.prepare('SELECT COUNT(*) AS c FROM puzzles WHERE is_endgame = 1').get().c;
  const setMeta = db.prepare('INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)');
  setMeta.run('total_puzzles', String(total));
  setMeta.run('difficulty_counts', JSON.stringify(difficultyCounts));
  setMeta.run(
    'endgame_filter',
    JSON.stringify({
      rule: 'material filter from scripts/lib/endgame-rule.mjs (hasEndgameMaterial)',
      flagged,
      byDifficulty: endgameByDifficulty,
    }),
  );
  // Every run leaves its own record (extension_v1, extension_v2, ...); earlier ones are never overwritten.
  const lastRun = db
    .prepare("SELECT key FROM db_meta WHERE key LIKE 'extension_v%'")
    .all()
    .reduce((max, r) => Math.max(max, Number(r.key.slice('extension_v'.length)) || 0), 0);
  setMeta.run(
    `extension_v${lastRun + 1}`,
    JSON.stringify({ source: 'Lichess puzzle database (CC0)', added: picked.length, ...counts }),
  );

  db.exec('VACUUM');
  db.close();
  const size = fs.statSync(DB_PATH).size;
  console.log(`Added ${picked.length} puzzles (${counts.endgame} endgames, ${counts.general} general, ${counts.mate1} one-move mates).`);
  console.log(`Total ${total} puzzles, ${flagged} flagged as endgames. Database size: ${(size / 1e6).toFixed(1)} MB.`);
}

main();
