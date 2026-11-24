// Endgame tablebase lookups for the Tablebase page. The browser asks our server, the server asks the
// public Lichess tablebase (Syzygy, up to 7 pieces) and keeps the answers for a day, so the same
// position is never asked twice, many people looking at the same endgame cost one request, and the
// total number of requests we send to Lichess has a hard ceiling.
import { Chess } from 'chess.js';

export const TABLEBASE_MAX_PIECES = 7;
export const DEFAULT_TABLEBASE_URL = 'https://tablebase.lichess.org';

/** The result of a position, always from the point of view of the side that is asked about. */
export type Outcome = 'win' | 'cursed-win' | 'draw' | 'blessed-loss' | 'loss' | 'unknown';

export interface TablebaseMove {
  uci: string;
  san: string;
  /** What this move leads to for the player who makes it. */
  outcome: Outcome;
  /** The move gives checkmate. */
  checkmate: boolean;
  /** The move captures or moves a pawn (the 50-move counter starts again). */
  zeroing: boolean;
}

export interface TablebaseResult {
  fen: string;
  /** Result for the side to move. */
  outcome: Outcome;
  /** Moves until checkmate with best play by both sides, or null when the tables do not say. */
  matein: number | null;
  checkmate: boolean;
  stalemate: boolean;
  insufficientMaterial: boolean;
  /** Legal moves, best first. */
  moves: TablebaseMove[];
}

export type Lookup =
  | { ok: true; result: TablebaseResult; cached: boolean }
  | { ok: false; status: number; error: string };

/** Counts the pieces in the first field of a FEN. */
export function countPieces(fen: string): number {
  return (fen.split(' ')[0].match(/[pnbrqkPNBRQK]/g) ?? []).length;
}

/** Checks a FEN before it is sent anywhere. Returns the clean FEN, or what is wrong with it. */
export function checkPosition(raw: unknown): { ok: true; fen: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 100) return { ok: false, error: 'A FEN is required.' };
  let fen: string;
  try {
    fen = new Chess(raw.trim().replace(/_/g, ' ')).fen();
  } catch {
    return { ok: false, error: 'This is not a valid position.' };
  }
  if (countPieces(fen) > TABLEBASE_MAX_PIECES) {
    return { ok: false, error: `The tablebase covers positions with ${TABLEBASE_MAX_PIECES} pieces or fewer.` };
  }
  if (fen.split(' ')[2] !== '-') {
    return { ok: false, error: 'The tablebase does not handle castling, so positions with castling rights cannot be looked up.' };
  }
  return { ok: true, fen };
}

/** The same result seen from the other side. */
export function flipOutcome(outcome: Outcome): Outcome {
  switch (outcome) {
    case 'win':
      return 'loss';
    case 'loss':
      return 'win';
    case 'cursed-win':
      return 'blessed-loss';
    case 'blessed-loss':
      return 'cursed-win';
    default:
      return outcome;
  }
}

/** Turns the category names of the Lichess tablebase into outcomes. */
export function outcomeOf(category: unknown): Outcome {
  switch (category) {
    case 'win':
    case 'syzygy-win':
    case 'maybe-win':
      return 'win';
    case 'cursed-win':
      return 'cursed-win';
    case 'draw':
      return 'draw';
    case 'blessed-loss':
      return 'blessed-loss';
    case 'loss':
    case 'syzygy-loss':
    case 'maybe-loss':
      return 'loss';
    default:
      return 'unknown';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Reads the answer of the Lichess tablebase. The category of a move describes the position after it,
 * from the point of view of the opponent, so it is turned around to describe the player who moves.
 * Returns null when the answer does not look like a tablebase answer at all.
 */
export function normalizeResponse(fen: string, body: unknown): TablebaseResult | null {
  if (!isRecord(body) || !Array.isArray(body.moves) || typeof body.category !== 'string') return null;
  const dtm = asNumber(body.dtm);
  const moves: TablebaseMove[] = [];
  for (const raw of body.moves) {
    if (!isRecord(raw) || typeof raw.uci !== 'string' || typeof raw.san !== 'string') return null;
    moves.push({
      uci: raw.uci,
      san: raw.san,
      outcome: flipOutcome(outcomeOf(raw.category)),
      checkmate: raw.checkmate === true,
      zeroing: raw.zeroing === true,
    });
  }
  const outcome = outcomeOf(body.category);
  return {
    fen,
    outcome,
    // The tables count plies; a mate on the 17th ply is "mate in 9".
    matein: dtm !== null && dtm !== 0 && (outcome === 'win' || outcome === 'loss') ? Math.ceil(Math.abs(dtm) / 2) : null,
    checkmate: body.checkmate === true,
    stalemate: body.stalemate === true,
    insufficientMaterial: body.insufficient_material === true,
    moves,
  };
}

export interface TablebaseOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** How long an answer is kept. */
  ttlMs?: number;
  maxEntries?: number;
  timeoutMs?: number;
  /** The most requests sent to the Lichess tablebase in one minute, whoever is asking. */
  maxUpstreamPerMinute?: number;
}

export function createTablebase(options: TablebaseOptions = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_TABLEBASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = options.maxEntries ?? 3000;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxUpstreamPerMinute = options.maxUpstreamPerMinute ?? 240;

  const cache = new Map<string, { at: number; result: TablebaseResult }>();
  const inFlight = new Map<string, Promise<Lookup>>();
  let recent: number[] = [];

  function remember(fen: string, result: TablebaseResult) {
    cache.delete(fen);
    cache.set(fen, { at: now(), result });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
  }

  async function ask(fen: string): Promise<Lookup> {
    const t = now();
    recent = recent.filter((time) => t - time < 60_000);
    if (recent.length >= maxUpstreamPerMinute) {
      return { ok: false, status: 503, error: 'The tablebase is busy, try again in a minute.' };
    }
    recent.push(t);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/standard?fen=${encodeURIComponent(fen)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'chesstacticsguide.com endgame trainer' },
      });
      if (response.status === 429) return { ok: false, status: 503, error: 'The tablebase is busy, try again in a minute.' };
      if (response.status === 404) return { ok: false, status: 422, error: 'The tablebase has no answer for this position.' };
      if (!response.ok) return { ok: false, status: 502, error: 'The tablebase could not be reached.' };
      const result = normalizeResponse(fen, await response.json());
      if (!result) return { ok: false, status: 502, error: 'The tablebase gave an answer that could not be read.' };
      remember(fen, result);
      return { ok: true, result, cached: false };
    } catch {
      return { ok: false, status: 502, error: 'The tablebase could not be reached.' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** Looks a position up. Only answers are kept, failures are always tried again. */
    async lookup(rawFen: unknown): Promise<Lookup> {
      const checked = checkPosition(rawFen);
      if (!checked.ok) return { ok: false, status: 400, error: checked.error };
      const fen = checked.fen;
      const hit = cache.get(fen);
      if (hit && now() - hit.at < ttlMs) return { ok: true, result: hit.result, cached: true };
      const pending = inFlight.get(fen);
      if (pending) return pending;
      const request = ask(fen).finally(() => inFlight.delete(fen));
      inFlight.set(fen, request);
      return request;
    },
    cacheSize: () => cache.size,
  };
}
