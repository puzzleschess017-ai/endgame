import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { parseBlindfoldParams, pickBlindfoldPuzzles } from './server/blindfold.ts';
import { parseLadderParams, pickLadderPuzzles } from './server/ladder.ts';

const PORT = Number(process.env.PORT) || 3000;
const FONTS_DIR = path.resolve(process.cwd(), 'public', 'fonts');

const VALID_COUNTS = new Set([10, 50, 100, 200]);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'expert']);
const DIFFICULTY_TO_CODE: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  expert: 3,
};

const DIFFICULTY_RATING_RANGES: Record<string, { minRating: number; maxRating: number }> = {
  easy: { minRating: 0, maxRating: 1200 },
  medium: { minRating: 1200, maxRating: 1600 },
  hard: { minRating: 1600, maxRating: 2000 },
  expert: { minRating: 2000, maxRating: 4000 },
};

interface RawPuzzleRow {
  puzzle_id: string;
  fen: string;
  moves: string;
  rating: number;
  rating_deviation?: number;
  popularity?: number;
  themes: string;
  num_moves?: number;
}

interface RangeMeta {
  minId: number;
  maxId: number;
  count: number;
}

let db: Database.Database | null = null;
let resolvedDbPath: string | null = null;
let cachedMeta: {
  totalPuzzles: number;
  dbSizeBytes: number;
  ranges: Record<string, RangeMeta>;
  byDifficulty: Record<string, number>;
  byTheme: Record<string, number>;
} | null = null;

function findDatabasePath(): string {
  const candidates = [
    process.env.DB_PATH,
    process.env.PUZZLE_DB_PATH,
    path.resolve(process.cwd(), 'endgame.db'),
    path.resolve(process.cwd(), 'puzzles.db'),
    path.resolve(process.cwd(), 'data', 'puzzles.db'),
    path.resolve(process.cwd(), '..', 'chess-training (6)', 'data', 'puzzles.db'),
    path.resolve(process.cwd(), '..', 'chess-training', 'data', 'puzzles.db'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.size > 1024 * 1024) {
          return candidate;
        }
      } catch {
        // ignore
      }
    }
  }

  return path.resolve(process.cwd(), 'endgame.db');
}

function hasTable(database: Database.Database, tableName: string): boolean {
  try {
    const row = database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName);
    return Boolean(row);
  } catch {
    return false;
  }
}

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  try {
    const cols = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return cols.some((c) => c.name === columnName);
  } catch {
    return false;
  }
}

function hasIndex(database: Database.Database, indexName: string): boolean {
  try {
    const row = database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get(indexName);
    return Boolean(row);
  } catch {
    return false;
  }
}

function getDb(): Database.Database {
  if (!db) {
    resolvedDbPath = findDatabasePath();
    if (!fs.existsSync(resolvedDbPath)) {
      throw new Error(`Database file not found on disk: ${resolvedDbPath}`);
    }
    const stat = fs.statSync(resolvedDbPath);
    if (stat.size === 0) {
      throw new Error(`Database file is empty (0 bytes): ${resolvedDbPath}`);
    }
    console.log(`[Database] Connecting to SQLite database: ${resolvedDbPath} (${(stat.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
    db = new Database(resolvedDbPath, { readonly: true, fileMustExist: true });
    try {
      db.pragma('journal_mode = WAL');
    } catch {
      // WAL pragma might be read-only if permissions forbid journal creation
    }
  }
  return db;
}

function getMeta() {
  if (cachedMeta) return cachedMeta;
  const database = getDb();
  const actualSize = resolvedDbPath && fs.existsSync(resolvedDbPath) ? fs.statSync(resolvedDbPath).size : 0;

  let totalPuzzles = 0;
  let ranges: Record<string, RangeMeta> = {};
  let byDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
  let byTheme: Record<string, number> = {};

  // Safely check if db_meta table exists without assuming it does
  if (hasTable(database, 'db_meta')) {
    try {
      const rows = database.prepare('SELECT key, value FROM db_meta').all() as Array<{ key: string; value: string }>;
      const map = new Map<string, string>();
      for (const row of rows) {
        map.set(row.key, row.value);
      }

      if (map.has('dataset_stats_v1')) {
        try {
          const stats = JSON.parse(map.get('dataset_stats_v1')!);
          totalPuzzles = Number(stats.totalPuzzles ?? 0);
          if (stats.themeCounts) {
            byTheme = stats.themeCounts;
          }
        } catch {
          // ignore
        }
      }

      if (map.has('total_puzzles')) {
        totalPuzzles = Number(map.get('total_puzzles') ?? 0);
      }
      if (map.has('ranges')) {
        try {
          ranges = JSON.parse(map.get('ranges')!);
        } catch {}
      }
      if (map.has('difficulty_counts')) {
        try {
          byDifficulty = JSON.parse(map.get('difficulty_counts')!);
        } catch {}
      }
      if (map.has('theme_counts')) {
        try {
          byTheme = JSON.parse(map.get('theme_counts')!);
        } catch {}
      }
    } catch (err) {
      console.warn('[Database] Failed to read db_meta, falling back safely:', err);
    }
  }

  // If totalPuzzles not in metadata, query from puzzles table if available
  if (!totalPuzzles && hasTable(database, 'puzzles')) {
    try {
      const row = database.prepare('SELECT COUNT(*) as count FROM puzzles').get() as { count: number } | undefined;
      totalPuzzles = row?.count ?? 0;
    } catch {
      totalPuzzles = 0;
    }
  }

  cachedMeta = {
    totalPuzzles,
    dbSizeBytes: actualSize,
    ranges,
    byDifficulty,
    byTheme,
  };
  return cachedMeta;
}

// Extra SQL condition that limits puzzles to real endgames.
// - New databases carry an `is_endgame` flag precomputed with the material rule
//   from scripts/build-endgame-db.mjs.
// - Older databases fall back to the (very loose) Lichess "endgame" theme tag.
function endgameCondition(database: Database.Database, hasThemes: boolean): string {
  if (hasColumn(database, 'puzzles', 'is_endgame')) {
    return 'AND is_endgame = 1';
  }
  return hasThemes ? "AND themes LIKE '%endgame%'" : '';
}

function formatPuzzle(row: RawPuzzleRow) {
  const moveList = row.moves.trim().split(/\s+/);
  const numMoves =
    typeof row.num_moves === 'number' && Number.isFinite(row.num_moves)
      ? row.num_moves
      : Math.max(1, Math.ceil((moveList.length - 1) / 2));

  return {
    puzzleId: row.puzzle_id,
    fen: row.fen,
    moves: moveList,
    rating: row.rating,
    ratingDeviation: row.rating_deviation ?? 75,
    popularity: row.popularity ?? 90,
    themes: row.themes.trim().split(/\s+/),
    numMoves,
  };
}

function samplePuzzlesFromDb(
  database: Database.Database,
  difficulty: string,
  count: number,
  meta: ReturnType<typeof getMeta>
) {
  const hasIdCol = hasColumn(database, 'puzzles', 'id');
  const hasDiffCol = hasColumn(database, 'puzzles', 'difficulty');
  const hasRandKey = hasColumn(database, 'puzzles', 'rand_key');
  const hasThemes = hasColumn(database, 'puzzles', 'themes');

  const range = meta.ranges?.[difficulty];
  if (hasIdCol && hasDiffCol && range && range.count >= count) {
    const span = range.maxId - range.minId + 1;
    const chosenIds = new Set<number>();
    while (chosenIds.size < count) {
      const randId = range.minId + Math.floor(Math.random() * span);
      chosenIds.add(randId);
    }
    const ids = Array.from(chosenIds);
    const placeholders = ids.map(() => '?').join(',');
    const rows = database
      .prepare(`
        SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes, num_moves
        FROM puzzles
        WHERE id IN (${placeholders})
      `)
      .all(...ids) as RawPuzzleRow[];

    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = rows[i];
      rows[i] = rows[j];
      rows[j] = tmp;
    }
    return rows.map(formatPuzzle);
  }

  // Actual Lichess database structure
  const ratingRange = DIFFICULTY_RATING_RANGES[difficulty] ?? { minRating: 1200, maxRating: 1600 };
  const themeCondition = endgameCondition(database, hasThemes);

  if (hasRandKey) {
    const MAX_RAND_KEY = 2147483647;
    const pivot = 1 + Math.floor(Math.random() * (MAX_RAND_KEY - 1));
    const hasRandIdx = hasIndex(database, 'idx_puzzles_rand_rating');
    const indexHint = hasRandIdx ? 'INDEXED BY idx_puzzles_rand_rating' : '';

    const sqlForward = `
      SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes
      FROM puzzles ${indexHint}
      WHERE rand_key >= ? AND rating >= ? AND rating < ? ${themeCondition}
      ORDER BY rand_key ASC
      LIMIT ?
    `;

    let rows = database
      .prepare(sqlForward)
      .all(pivot, ratingRange.minRating, ratingRange.maxRating, count) as RawPuzzleRow[];

    if (rows.length < count) {
      const sqlWrap = `
        SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes
        FROM puzzles ${indexHint}
        WHERE rand_key < ? AND rating >= ? AND rating < ? ${themeCondition}
        ORDER BY rand_key ASC
        LIMIT ?
      `;
      const wrapRows = database
        .prepare(sqlWrap)
        .all(pivot, ratingRange.minRating, ratingRange.maxRating, count - rows.length) as RawPuzzleRow[];
      rows = rows.concat(wrapRows);
    }

    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = rows[i];
      rows[i] = rows[j];
      rows[j] = tmp;
    }

    return rows.map(formatPuzzle);
  }

  // Fallback
  const rows = database
    .prepare(`
      SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes
      FROM puzzles
      WHERE rating >= ? AND rating < ? ${themeCondition}
      LIMIT ?
    `)
    .all(ratingRange.minRating, ratingRange.maxRating, count) as RawPuzzleRow[];

  return rows.map(formatPuzzle);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Eagerly initialize and verify database connection
  try {
    getDb();
    getMeta();
  } catch (err) {
    console.error('[Database] Initialization error:', err);
  }

  // Serve dynamic @font-face declarations when Futura font files are provided in public/fonts/
  app.get('/fonts/futura.css', (_req, res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (!fs.existsSync(FONTS_DIR)) {
      res.send('/* Place Futura font files (.woff2/.woff/.ttf/.otf) in public/fonts/ to activate custom @font-face rules. */\n');
      return;
    }
    const formatMap: Record<string, string> = {
      '.woff2': 'woff2',
      '.woff': 'woff',
      '.ttf': 'truetype',
      '.otf': 'opentype',
    };
    const files = fs
      .readdirSync(FONTS_DIR)
      .filter((name) => /\.(woff2|woff|ttf|otf)$/i.test(name) && /^[a-zA-Z0-9._-]+$/.test(name));
    if (files.length === 0) {
      res.send('/* Place Futura font files (.woff2/.woff/.ttf/.otf) in public/fonts/ to activate custom @font-face rules. */\n');
      return;
    }
    const rules = files.map((file) => {
      const ext = path.extname(file).toLowerCase();
      const fmt = formatMap[ext] ?? 'woff2';
      const lower = file.toLowerCase();
      const weight = lower.includes('bold') ? 700 : lower.includes('medium') || lower.includes('500') ? 500 : 400;
      const style = lower.includes('italic') || lower.includes('oblique') ? 'italic' : 'normal';
      return `@font-face {\n  font-family: "Futura";\n  src: url("/fonts/${encodeURIComponent(file)}") format("${fmt}");\n  font-weight: ${weight};\n  font-style: ${style};\n  font-display: swap;\n}`;
    });
    res.send(rules.join('\n\n') + '\n');
  });

  app.get('/api/health', (_req, res) => {
    try {
      const meta = getMeta();
      res.json({
        ok: true,
        totalPuzzles: meta.totalPuzzles,
        dbSizeBytes: meta.dbSizeBytes,
      });
    } catch (err) {
      res.status(503).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Database unavailable',
      });
    }
  });

  app.get('/api/stats', (_req, res) => {
    try {
      const meta = getMeta();
      res.json({
        totalPuzzles: meta.totalPuzzles,
        dbSizeBytes: meta.dbSizeBytes,
        byDifficulty: meta.byDifficulty,
        byTheme: meta.byTheme,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load database stats',
      });
    }
  });

  app.get('/api/puzzles/sample', (req, res) => {
    const rawCount = Number(req.query.count);
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty.toLowerCase() : '';

    if (!Number.isInteger(rawCount) || !VALID_COUNTS.has(rawCount)) {
      res.status(400).json({ error: 'Invalid count. Must be 10, 50, 100, or 200.' });
      return;
    }
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      res.status(400).json({ error: 'Invalid difficulty. Must be easy, medium, hard, or expert.' });
      return;
    }

    try {
      const database = getDb();
      const meta = getMeta();
      const puzzles = samplePuzzlesFromDb(database, difficulty, rawCount, meta);

      if (!puzzles || puzzles.length === 0) {
        res.status(500).json({ error: 'Insufficient puzzles available for selected difficulty.' });
        return;
      }

      res.json({
        difficulty,
        count: puzzles.length,
        puzzles,
      });
    } catch (err) {
      console.error('Failed to sample puzzles:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to sample puzzles',
      });
    }
  });

  // Puzzles for Streak and Race: one per rating step, easy first, from every puzzle in the database.
  app.get('/api/puzzles/ladder', (req, res) => {
    const params = parseLadderParams(req.query);
    if (!params) {
      res.status(400).json({
        error: 'Invalid ladder request. start 0-3200, step 5-100 and count 1-60 must be whole numbers.',
      });
      return;
    }
    try {
      const puzzles = pickLadderPuzzles(getDb(), params).map(formatPuzzle);
      if (puzzles.length === 0) {
        res.status(500).json({ error: 'No puzzles available for this rating range.' });
        return;
      }
      res.json({ ...params, puzzles });
    } catch (err) {
      console.error('Failed to build puzzle ladder:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to build puzzle ladder',
      });
    }
  });

  // Puzzles for Blindfold: random mate-in-1 puzzles, limited by the number of pieces on the board.
  app.get('/api/puzzles/blindfold', (req, res) => {
    const params = parseBlindfoldParams(req.query);
    if (!params) {
      res.status(400).json({
        error: 'Invalid blindfold request. maxPieces must be 6, 8, 10 or 32 and count 1-20.',
      });
      return;
    }
    try {
      const puzzles = pickBlindfoldPuzzles(getDb(), params).map(formatPuzzle);
      if (puzzles.length === 0) {
        res.status(500).json({ error: 'No puzzles available for this level.' });
        return;
      }
      res.json({ ...params, puzzles });
    } catch (err) {
      console.error('Failed to pick blindfold puzzles:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to pick blindfold puzzles',
      });
    }
  });

  app.get('/api/puzzles', (req, res) => {
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty.toLowerCase() : 'medium';
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      res.status(400).json({ error: 'Invalid difficulty.' });
      return;
    }
    const rawLimit = Number(req.query.limit ?? 20);
    const rawOffset = Number(req.query.offset ?? 0);
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 200 ? rawLimit : 20;
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    try {
      const database = getDb();
      const hasDiffCol = hasColumn(database, 'puzzles', 'difficulty');
      const hasIdCol = hasColumn(database, 'puzzles', 'id');
      const hasThemes = hasColumn(database, 'puzzles', 'themes');

      let rows: RawPuzzleRow[];
      if (hasDiffCol && hasIdCol) {
        const diffCode = DIFFICULTY_TO_CODE[difficulty];
        rows = database
          .prepare(
            `SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes, num_moves
             FROM puzzles
             WHERE difficulty = ?
             ORDER BY id ASC
             LIMIT ? OFFSET ?`
          )
          .all(diffCode, limit, offset) as RawPuzzleRow[];
      } else {
        const ratingRange = DIFFICULTY_RATING_RANGES[difficulty] ?? { minRating: 1200, maxRating: 1600 };
        const themeCondition = endgameCondition(database, hasThemes);
        rows = database
          .prepare(
            `SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes
             FROM puzzles
             WHERE rating >= ? AND rating < ? ${themeCondition}
             ORDER BY rating ASC
             LIMIT ? OFFSET ?`
          )
          .all(ratingRange.minRating, ratingRange.maxRating, limit, offset) as RawPuzzleRow[];
      }

      res.json({
        difficulty,
        limit,
        offset,
        puzzles: rows.map(formatPuzzle),
      });
    } catch (err) {
      console.error('Failed to query puzzles:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to query puzzles',
      });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chess Tactics Guide server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
