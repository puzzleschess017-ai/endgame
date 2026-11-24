import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';
import { ENDGAME_TAGS, applyFirstMoveAndCheckEndgame } from './lib/endgame-rule.mjs';

const INPUT_ZST = '/tmp/lichess_db_puzzle.csv.zst';
const DB_PATH = path.resolve(process.cwd(), 'endgame.db');
const MAX_DB_BYTES = 395_000_000; // Strictly < 400 MB (both decimal MB and binary MiB)

function hash64(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (BigInt(h1 >>> 0) << 32n) | BigInt(h2 >>> 0);
}

function getDifficultyBucket(rating) {
  if (rating < 1200) return 0; // easy
  if (rating < 1600) return 1; // medium
  if (rating < 2000) return 2; // hard
  return 3; // expert
}

function build() {
  if (!fs.existsSync(INPUT_ZST)) {
    throw new Error(`Missing ${INPUT_ZST}`);
  }
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  console.log('Reading compressed Lichess database...');
  const buf = fs.readFileSync(INPUT_ZST);
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
  console.log(`Found ${offsets.length} zstd frames.`);

  // Collect filtered endgame puzzles grouped by difficulty bucket
  const buckets = [[], [], [], []];
  const seenIds = new Set();
  const seenPosMoves = new Set();
  let duplicatesRemoved = 0;
  let totalScanned = 0;

  let rem = '';
  for (let k = 0; k < offsets.length; k++) {
    const start = offsets[k] + 12;
    const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length;
    const dec = zlib.zstdDecompressSync(buf.subarray(start, end)).toString('utf8');
    const text = rem + dec;
    let lineStart = 0;
    while (true) {
      const nl = text.indexOf('\n', lineStart);
      if (nl === -1) {
        rem = text.slice(lineStart);
        break;
      }
      const line = text.slice(lineStart, nl);
      lineStart = nl + 1;
      if (totalScanned === 0 && line.startsWith('PuzzleId,')) continue;
      totalScanned++;

      const cols = line.split(',');
      if (cols.length < 8) continue;

      const puzzleId = cols[0];
      const fen = cols[1];
      const movesStr = cols[2];
      const themesStr = cols[7];

      const themes = themesStr.split(' ');
      let hasEndgame = false;
      let hasExcluded = false;
      for (let t = 0; t < themes.length; t++) {
        const tag = themes[t];
        if (ENDGAME_TAGS.has(tag)) hasEndgame = true;
        if (tag === 'opening' || tag === 'middlegame') hasExcluded = true;
      }
      if (!hasEndgame || hasExcluded) continue;

      const moves = movesStr.split(' ');
      if (moves.length < 2) continue;

      if (!applyFirstMoveAndCheckEndgame(fen, moves[0])) continue;

      if (seenIds.has(puzzleId)) {
        duplicatesRemoved++;
        continue;
      }
      const fenParts = fen.split(' ');
      const dedupKey = hash64(`${fenParts[0]} ${fenParts[1]}|${movesStr}`);
      if (seenPosMoves.has(dedupKey)) {
        duplicatesRemoved++;
        continue;
      }
      seenIds.add(puzzleId);
      seenPosMoves.add(dedupKey);

      const rating = parseInt(cols[3], 10);
      const rd = parseInt(cols[4], 10);
      const pop = parseInt(cols[5], 10);
      if (Number.isNaN(rating) || Number.isNaN(rd) || Number.isNaN(pop)) continue;

      const numMoves = Math.ceil((moves.length - 1) / 2);
      const diff = getDifficultyBucket(rating);
      buckets[diff].push({
        puzzleId,
        fen,
        moves: movesStr,
        rating,
        rd,
        pop,
        themes: themesStr,
        numMoves,
      });
    }
  }

  seenIds.clear();
  seenPosMoves.clear();

  const rawTotal = buckets.reduce((acc, b) => acc + b.length, 0);
  console.log(`Scanned ${totalScanned} puzzles. Strict endgame candidates: ${rawTotal}. Duplicates removed: ${duplicatesRemoved}.`);

  // Helper to build DB from buckets (or trimmed buckets if size > MAX_DB_BYTES)
  function writeDatabase(selectedBuckets) {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    const db = new Database(DB_PATH);
    db.pragma('page_size = 8192');
    db.pragma('journal_mode = DELETE');
    db.pragma('synchronous = OFF');
    db.pragma('temp_store = MEMORY');

    db.exec(`
      CREATE TABLE puzzles (
        id INTEGER PRIMARY KEY,
        puzzle_id TEXT NOT NULL UNIQUE,
        fen TEXT NOT NULL,
        moves TEXT NOT NULL,
        rating INTEGER NOT NULL,
        rating_deviation INTEGER NOT NULL,
        popularity INTEGER NOT NULL,
        themes TEXT NOT NULL,
        num_moves INTEGER NOT NULL,
        difficulty INTEGER NOT NULL
      );
      CREATE TABLE db_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const insertStmt = db.prepare(`
      INSERT INTO puzzles (id, puzzle_id, fen, moves, rating, rating_deviation, popularity, themes, num_moves, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let nextId = 1;
    const ranges = {};
    const diffNames = ['easy', 'medium', 'hard', 'expert'];
    const diffCounts = { easy: 0, medium: 0, hard: 0, expert: 0 };
    const themeCounts = {};

    const insertAll = db.transaction(() => {
      for (let d = 0; d < 4; d++) {
        const list = selectedBuckets[d];
        const minId = nextId;
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          insertStmt.run(nextId, p.puzzleId, p.fen, p.moves, p.rating, p.rd, p.pop, p.themes, p.numMoves, d);
          nextId++;
          const tags = p.themes.split(' ');
          for (let t = 0; t < tags.length; t++) {
            const tag = tags[t];
            if (ENDGAME_TAGS.has(tag)) {
              themeCounts[tag] = (themeCounts[tag] || 0) + 1;
            }
          }
        }
        const maxId = nextId - 1;
        ranges[diffNames[d]] = { minId, maxId, count: list.length };
        diffCounts[diffNames[d]] = list.length;
      }
    });

    insertAll();

    console.log('Creating indexes...');
    db.exec(`
      CREATE INDEX idx_puzzles_difficulty_rating ON puzzles(difficulty, rating);
      CREATE INDEX idx_puzzles_rating ON puzzles(rating);
    `);

    const totalCount = nextId - 1;
    const insertMeta = db.prepare('INSERT INTO db_meta (key, value) VALUES (?, ?)');
    insertMeta.run('total_puzzles', String(totalCount));
    insertMeta.run('ranges', JSON.stringify(ranges));
    insertMeta.run('difficulty_counts', JSON.stringify(diffCounts));
    insertMeta.run('theme_counts', JSON.stringify(themeCounts));

    console.log('Running VACUUM to compact B-trees...');
    db.exec('VACUUM;');
    db.close();

    const sizeBytes = fs.statSync(DB_PATH).size;
    // Update db_size_bytes in db_meta without expanding DB
    const db2 = new Database(DB_PATH);
    db2.pragma('journal_mode = DELETE');
    db2.prepare('INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)').run('db_size_bytes', String(sizeBytes));
    db2.close();

    return {
      totalCount,
      sizeBytes: fs.statSync(DB_PATH).size,
      diffCounts,
      themeCounts,
      ranges,
    };
  }

  let stats = writeDatabase(buckets);
  console.log(`Initial DB size: ${(stats.sizeBytes / 1_000_000).toFixed(2)} MB (${(stats.sizeBytes / 1048576).toFixed(2)} MiB) for ${stats.totalCount} puzzles.`);

  if (stats.sizeBytes > MAX_DB_BYTES) {
    console.log('Exceeds 395 MB target; trimming lowest-quality puzzles proportionally to fit strictly under 400 MB...');
    // Sort each bucket by quality score descending: higher popularity, lower RD
    for (let d = 0; d < 4; d++) {
      buckets[d].sort((a, b) => (b.pop - b.rd * 0.25) - (a.pop - a.rd * 0.25));
    }
    // Calculate ratio with 4% safety margin
    const ratio = (MAX_DB_BYTES * 0.96) / stats.sizeBytes;
    const trimmed = buckets.map((b) => b.slice(0, Math.floor(b.length * ratio)));
    stats = writeDatabase(trimmed);
    console.log(`Compacted DB size: ${(stats.sizeBytes / 1_000_000).toFixed(2)} MB (${(stats.sizeBytes / 1048576).toFixed(2)} MiB) for ${stats.totalCount} puzzles.`);
  }

  console.log('FINAL DATABASE REPORT:');
  console.log(JSON.stringify(stats, null, 2));
}

build();
