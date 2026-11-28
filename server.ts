import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { parseBlindfoldParams, pickBlindfoldPuzzles } from './server/blindfold.ts';
import { parseLadderParams, pickLadderPuzzles } from './server/ladder.ts';
import { EBOOKS, ebookPath, findEbook } from './server/ebooks.ts';
import {
  actionFor,
  cancelUserSubscription,
  createCheckout,
  createPaymentStore,
  loadPaymentSettings,
  NO_SUBSCRIPTION,
  subscriptionOf,
  subscriptionView,
  verifyWebhook,
} from './server/payments.ts';
import { createTablebase } from './server/tablebase.ts';
import { createTierLookup } from './server/tier.ts';
import { DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL } from './src/auth/project.ts';
import { checkBlindfoldLevel, checkBlindfoldMateIn, checkWoodpecker, getsEbooksFree } from './src/utils/access.ts';
import type { BlindfoldLevel, MateIn } from './src/utils/blindfold.ts';
import type { PuzzleCountOption } from './src/types.ts';
import { contentFor } from './server/prerender.ts';
import { preloadTags, readManifest } from './server/preload.ts';
import {
  FLOW_COOKIE,
  authorizeUrl,
  clearFlowCookieHeader,
  finishLichessLogin,
  flowCookieHeader,
  loadLichessSettings,
  newPkce,
  openFlow,
  readCookie,
  safeNext,
  sealFlow,
} from './server/lichess.ts';
import { cleanSiteUrl, pageFor, renderPage, robotsTxt, sitemapXml } from './server/seo.ts';
import {
  RATING_BANDS,
  parseSampleQuery,
  splitMixedCount,
  type RatingBand,
  type SampleDifficulty,
  type SampleMode,
} from './server/woodpecker.ts';

const PORT = Number(process.env.PORT) || 3000;
const FONTS_DIR = path.resolve(process.cwd(), 'public', 'fonts');

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

// Extra SQL condition that limits puzzles to real endgames (empty for the classic set, which uses
// every puzzle).
// - New databases carry an `is_endgame` flag precomputed with the material rule
//   from scripts/build-endgame-db.mjs.
// - Older databases fall back to the (very loose) Lichess "endgame" theme tag.
function endgameCondition(
  database: Database.Database,
  hasThemes: boolean,
  mode: SampleMode = 'endgame',
): string {
  if (mode === 'classic') return '';
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

// Random puzzles for a difficulty. "mixed" takes an even share from every rating band, shuffled together.
// `mode` picks the pool: real endgames only, or every puzzle (classic).
function samplePuzzlesFromDb(
  database: Database.Database,
  difficulty: SampleDifficulty,
  count: number,
  meta: ReturnType<typeof getMeta>,
  mode: SampleMode
) {
  if (difficulty !== 'mixed') return samplePuzzlesOfBand(database, difficulty, count, meta, mode);

  const shares = splitMixedCount(count);
  const rows: ReturnType<typeof samplePuzzlesOfBand> = [];
  for (const band of RATING_BANDS) {
    if (shares[band] > 0) rows.push(...samplePuzzlesOfBand(database, band, shares[band], meta, mode));
  }
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = rows[i];
    rows[i] = rows[j];
    rows[j] = tmp;
  }
  return rows;
}

function samplePuzzlesOfBand(
  database: Database.Database,
  difficulty: RatingBand,
  count: number,
  meta: ReturnType<typeof getMeta>,
  mode: SampleMode
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
  const themeCondition = endgameCondition(database, hasThemes, mode);

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

  const siteUrl = cleanSiteUrl(process.env.SITE_URL);

  // Payments (Dodo Payments, see server/payments.ts). Off until the environment variables are set.
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const payments = loadPaymentSettings(process.env, supabaseUrl);
  const paymentStore = payments.webhook ? createPaymentStore({ url: supabaseUrl, serviceKey: payments.webhook.serviceKey }) : null;

  // Dodo tells the site about a payment here. This route comes before express.json(): the signature is over the
  // exact bytes that were sent, so the body must stay raw. A wrong signature is a 400; a failure to save is a 500, so
  // that Dodo sends the event again; everything else is acknowledged with 200.
  app.post('/api/webhooks/dodo', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!payments.webhook || !paymentStore) {
      res.status(503).json({ error: 'Payments are not set up on this server.' });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const header = (name: string) => req.header(name) ?? undefined;
    if (!verifyWebhook(payments.webhook.secret, { id: header('webhook-id'), timestamp: header('webhook-timestamp'), signature: header('webhook-signature') }, body)) {
      res.status(400).json({ error: 'Bad signature.' });
      return;
    }
    let event: unknown;
    try {
      event = JSON.parse(body.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'The body is not JSON.' });
      return;
    }
    const action = actionFor(event, payments.webhook.premiumProducts);
    if (action) {
      try {
        await paymentStore.apply(action);
        // The server remembers a plan for a minute: forget it, so the person sees the new plan at once.
        tierOf.forget(action.userId);
        const status = (event as { data?: { status?: unknown } }).data?.status;
        console.log(`[payments] ${(event as { type?: string }).type} (status ${typeof status === 'string' ? status : '-'}) -> ${action.kind} ${action.tier}`);
      } catch (err) {
        console.error('[payments] could not save', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'Could not save the payment.' });
        return;
      }
    } else if (typeof (event as { type?: unknown } | null)?.type === 'string' && /^(subscription|payment|refund)\./.test((event as { type: string }).type)) {
      // Not an error, but worth a line: a payment event that changed nothing (for example one without a user id).
      const status = (event as { data?: { status?: unknown } }).data?.status;
      console.log(`[payments] ${(event as { type: string }).type} (status ${typeof status === 'string' ? status : '-'}) ignored`);
    }
    res.status(200).json({ ok: true });
  });

  // "Continue with Lichess" (see server/lichess.ts). Off until SUPABASE_SERVICE_ROLE_KEY is set; the login page then says so.
  const lichess = loadLichessSettings(process.env, siteUrl, supabaseUrl);
  const secureCookies = siteUrl.startsWith('https://');
  const lichessFail = (res: express.Response, reason: string) => {
    res.set('Cache-Control', 'no-store');
    res.append('Set-Cookie', clearFlowCookieHeader(secureCookies));
    res.redirect(302, `/login?lichess=${encodeURIComponent(reason)}`);
  };
  app.get('/auth/lichess', (req, res) => {
    if (!lichess) return lichessFail(res, 'unavailable');
    // The cookie of the flow belongs to one host: start on the host of the site, the one Lichess sends the person back to.
    const wanted = new URL(siteUrl).host;
    if (req.headers.host && req.headers.host !== wanted) {
      const query = typeof req.query.next === 'string' ? `?next=${encodeURIComponent(req.query.next)}` : '';
      res.redirect(302, `${siteUrl}/auth/lichess${query}`);
      return;
    }
    const pkce = newPkce();
    res.set('Cache-Control', 'no-store');
    res.append('Set-Cookie', flowCookieHeader(sealFlow(lichess.cookieKey, { verifier: pkce.verifier, state: pkce.state, next: safeNext(req.query.next) }), secureCookies));
    res.redirect(302, authorizeUrl(lichess, pkce));
  });
  app.get('/auth/lichess/callback', async (req, res) => {
    if (!lichess) return lichessFail(res, 'unavailable');
    const flow = openFlow(lichess.cookieKey, readCookie(req.headers.cookie, FLOW_COOKIE));
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (typeof req.query.error === 'string') return lichessFail(res, 'denied');
    if (!flow || !code || req.query.state !== flow.state) return lichessFail(res, 'unavailable');
    const result = await finishLichessLogin({ code, verifier: flow.verifier }, lichess);
    if (!result.ok) {
      console.error(`[lichess] sign-in failed: ${result.reason}`);
      return lichessFail(res, result.reason);
    }
    res.set('Cache-Control', 'no-store');
    res.append('Set-Cookie', clearFlowCookieHeader(secureCookies));
    // In the fragment, so the one-time token is never sent to any server or written in a log.
    res.redirect(302, `/login#lichess=${encodeURIComponent(result.tokenHash)}&next=${encodeURIComponent(flow.next)}`);
  });

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

  // Woodpecker sets and Blindfold levels depend on the plan (guest, signed in, Premium): see src/utils/access.ts.
  const tierOf = createTierLookup({
    url: process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_KEY,
  });

  // The e-books are free to download for Premium. The files are not in public/ or dist/, so these routes are the only
  // way to get one: the browser sends the sign-in token and the plan is checked here, on the server.

  // What the eBooks and Pricing pages need: which books this visitor may download, and which Get Premium buttons work.
  app.get('/api/ebooks', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    res.json({
      books: EBOOKS.map((book) => ({ slug: book.slug, owned: getsEbooksFree(visitor.tier) })),
      // Whether the Get Premium buttons work: the monthly and the yearly product are set up.
      premium: {
        monthly: Boolean(payments.checkout?.offers['premium:monthly']),
        yearly: Boolean(payments.checkout?.offers['premium:yearly']),
      },
    });
  });

  // Buying Premium: makes a Dodo checkout for the signed-in person and gives back its address. The person's id comes
  // from the verified sign-in token, never from the request, so a payment can only ever be for the one who asks.
  app.post('/api/checkout', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const config = payments.checkout;
    if (!config) {
      res.status(503).json({ error: 'Buying is not open yet.' });
      return;
    }
    const offer = typeof req.body?.offer === 'string' ? req.body.offer : '';
    const productId = Object.hasOwn(config.offers, offer) ? config.offers[offer] : undefined;
    if (!productId) {
      res.status(400).json({ error: 'There is nothing to buy with that name.' });
      return;
    }
    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    if (visitor.tier === 'guest') {
      res.status(401).json({ error: 'Sign in to buy.' });
      return;
    }
    if (!visitor.userId) {
      res.status(503).json({ error: 'Your account could not be checked just now. Please try again.' });
      return;
    }
    if (visitor.tier === 'premium') {
      res.status(409).json({ error: 'You already have Premium.' });
      return;
    }
    try {
      const url = await createCheckout({
        config,
        offer,
        productId,
        userId: visitor.userId,
        email: visitor.email,
        // Dodo adds the result of the payment (for example status=succeeded) to the return address.
        returnUrl: `${siteUrl}/pricing?purchase=premium`,
        cancelUrl: `${siteUrl}/pricing`,
      });
      res.json({ url });
    } catch (err) {
      console.error('[payments] checkout failed', err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'The payment page could not be opened. Please try again.' });
    }
  });

  // The Premium subscription of the signed-in person, for the account section of the Pricing page, and its cancel. The
  // subscription is found by the id the webhook saved for this person, and Dodo's own record must name the same person.
  // Cancelling stops the renewal; Premium stays until the end of the period that is already paid.
  app.get('/api/subscription', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    if (visitor.tier !== 'premium' || !visitor.userId) {
      res.json(NO_SUBSCRIPTION);
      return;
    }
    if (!payments.checkout || !paymentStore) {
      res.json(NO_SUBSCRIPTION);
      return;
    }
    try {
      res.json(subscriptionView(await subscriptionOf({ store: paymentStore, api: payments.checkout, userId: visitor.userId })));
    } catch (err) {
      console.error('[payments] could not read the subscription', err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'Your subscription could not be checked just now. Please try again.' });
    }
  });

  app.post('/api/subscription/cancel', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    if (visitor.tier === 'guest') {
      res.status(401).json({ error: 'Sign in to manage your subscription.' });
      return;
    }
    if (!visitor.userId) {
      res.status(503).json({ error: 'Your account could not be checked just now. Please try again.' });
      return;
    }
    if (!payments.checkout || !paymentStore) {
      res.status(503).json({ error: 'Cancelling is not available just now.' });
      return;
    }
    const result = await cancelUserSubscription({ store: paymentStore, api: payments.checkout, userId: visitor.userId });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    console.log('[payments] subscription cancelled for the end of the period');
    res.json(result.view);
  });

  app.get('/api/ebooks/:slug', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const book = findEbook(req.params.slug);
    if (!book) {
      res.status(404).json({ error: 'There is no such e-book.' });
      return;
    }
    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    if (!getsEbooksFree(visitor.tier)) {
      res.status(403).json({
        error: visitor.tier === 'guest' ? 'Sign in and get Premium to download the e-books.' : 'The e-books are free to download with Premium.',
      });
      return;
    }
    const file = ebookPath(book);
    if (!file) {
      res.status(404).json({ error: 'The e-book is not on the server yet.' });
      return;
    }
    res.download(file, book.downloadName);
  });

  app.get('/api/puzzles/sample', async (req, res) => {
    const query = parseSampleQuery(req.query);
    if (!query.ok) {
      res.status(400).json({ error: query.error });
      return;
    }
    const { count: rawCount, difficulty, mode } = query;

    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    const allowed = checkWoodpecker(visitor.tier, { puzzleCount: rawCount as PuzzleCountOption, difficulty, puzzleMode: mode });
    if (!allowed.ok) {
      res.status(403).json({ error: allowed.reason, needs: allowed.needs });
      return;
    }

    try {
      const database = getDb();
      const meta = getMeta();
      const puzzles = samplePuzzlesFromDb(database, difficulty, rawCount, meta, mode);

      if (!puzzles || puzzles.length === 0) {
        res.status(500).json({ error: 'Insufficient puzzles available for selected difficulty.' });
        return;
      }

      res.json({
        difficulty,
        mode,
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

  // Puzzles for Blindfold: random mate in 1, 2 or 3 puzzles, limited by the number of pieces on the board.
  app.get('/api/puzzles/blindfold', async (req, res) => {
    const params = parseBlindfoldParams(req.query);
    if (!params) {
      res.status(400).json({
        error: 'Invalid blindfold request. maxPieces must be 6, 7, 8, 10 or 32, count 1-20 and mateIn 1, 2 or 3.',
      });
      return;
    }
    const visitor = await tierOf(req.headers.authorization);
    if (!visitor.ok) {
      res.status(visitor.status).json({ error: visitor.error });
      return;
    }
    const allowed = checkBlindfoldLevel(visitor.tier, params.maxPieces as BlindfoldLevel);
    if (!allowed.ok) {
      res.status(403).json({ error: allowed.reason, needs: allowed.needs });
      return;
    }
    const longMate = checkBlindfoldMateIn(visitor.tier, (params.mateIn ?? 1) as MateIn);
    if (!longMate.ok) {
      res.status(403).json({ error: longMate.reason, needs: longMate.needs });
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

  // The page of the tablebase became Board Analysis: old links and bookmarks go to the new address.
  app.get(['/tablebase', '/tablebase/'], (req, res) => {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(301, `/analysis${query}`);
  });

  // Puzzle Race was replaced by Puzzle Survival: old links and bookmarks go to the new page.
  app.get(['/race', '/race/'], (_req, res) => {
    res.redirect(301, '/survival');
  });

  // Endgame tablebase (Lichess Syzygy, up to 7 pieces). The Board Analysis page no longer asks for it; kept for later use. Answers are kept for a day.
  const tablebase = createTablebase({ baseUrl: process.env.TABLEBASE_URL });
  app.get('/api/tablebase', async (req, res) => {
    const lookup = await tablebase.lookup(req.query.fen);
    if (!lookup.ok) {
      res.status(lookup.status).json({ error: lookup.error });
      return;
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(lookup.result);
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

  // For search engines: robots.txt and sitemap.xml. SITE_URL (default https://chesstacticsguide.com) is
  // the address written into canonical links and the sitemap.
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(robotsTxt(siteUrl));
  });
  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml(siteUrl));
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
    // Files whose name has a content hash (Vite's /assets/name-AbCd1234.js) never change, so browsers can
    // keep them for a year. Other static files (piece images, the logo) are kept for a day. The page
    // itself is always re-checked, so a new deploy shows up on the next visit.
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, filePath) {
          const hashed = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(filePath);
          res.setHeader(
            'Cache-Control',
            hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
          );
        },
      }),
    );
    // The page: index.html with the title, description and canonical address of the path asked for.
    // A path the app does not have still shows Home (as before), but with status 404.
    const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    const manifest = readManifest(distDir);
    app.get('*', (req, res) => {
      const page = pageFor(req.path);
      res.status(page ? 200 : 404).set('Cache-Control', 'no-cache').type('html').send(renderPage(template, page, siteUrl, page ? contentFor(req.path) : undefined, preloadTags(manifest, req.path)));
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
