// Endless supply of puzzles that get harder one by one, for Streak and Survival.
// The server builds the puzzles in batches (/api/puzzles/ladder); this class asks for the next
// batch before the current one runs out, so the player never waits between puzzles.
import type { Puzzle } from '../types';

export interface LadderBatchRequest {
  start: number;
  step: number;
  count: number;
}

export type FetchLadderBatch = (request: LadderBatchRequest) => Promise<Puzzle[]>;

/** Same limit as the server (server/ladder.ts). */
export const LADDER_MAX_START = 3200;

export async function fetchLadderBatch({ start, step, count }: LadderBatchRequest): Promise<Puzzle[]> {
  const response = await fetch(`/api/puzzles/ladder?start=${start}&step=${step}&count=${count}`);
  if (!response.ok) {
    let message = `Could not load puzzles (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  const body = (await response.json()) as { puzzles?: Puzzle[] };
  return Array.isArray(body.puzzles) ? body.puzzles : [];
}

export interface LadderFeedOptions {
  /** Rating of the first rung. */
  start: number;
  /** Rating added with every rung. */
  step: number;
  /** Puzzles per request. */
  batchSize?: number;
  /** Ask for more when this many or fewer are left in the queue. */
  prefetchBelow?: number;
  fetchBatch?: FetchLadderBatch;
}

export class LadderFeed {
  private readonly step: number;
  private readonly batchSize: number;
  private readonly prefetchBelow: number;
  private readonly fetchBatch: FetchLadderBatch;
  private nextStart: number;
  private queue: Puzzle[] = [];
  private readonly seen = new Set<string>();
  private pending: Promise<void> | null = null;
  private exhausted = false;

  constructor(options: LadderFeedOptions) {
    this.nextStart = options.start;
    this.step = options.step;
    this.batchSize = options.batchSize ?? 30;
    this.prefetchBelow = options.prefetchBelow ?? 8;
    this.fetchBatch = options.fetchBatch ?? fetchLadderBatch;
  }

  /** The next, slightly harder puzzle, or null when the ladder has no more puzzles. */
  async next(): Promise<Puzzle | null> {
    if (this.queue.length === 0) {
      await this.load();
    }
    const puzzle = this.queue.shift() ?? null;
    if (this.queue.length <= this.prefetchBelow) {
      // Fire and forget: a failure here only matters if the queue really runs dry.
      this.load().catch(() => undefined);
    }
    return puzzle;
  }

  /** Loads the first batch so the first puzzle is ready when the run starts. */
  async prepare(): Promise<void> {
    if (this.queue.length === 0) await this.load();
  }

  get remaining(): number {
    return this.queue.length;
  }

  private load(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.exhausted) return Promise.resolve();
    const request: LadderBatchRequest = {
      start: Math.min(this.nextStart, LADDER_MAX_START),
      step: this.step,
      count: this.batchSize,
    };
    const run = async () => {
      const batch = await this.fetchBatch(request);
      this.nextStart += this.batchSize * this.step;
      let added = 0;
      for (const puzzle of batch) {
        if (this.seen.has(puzzle.puzzleId)) continue;
        this.seen.add(puzzle.puzzleId);
        this.queue.push(puzzle);
        added++;
      }
      if (added === 0 || request.start >= LADDER_MAX_START) this.exhausted = true;
    };
    this.pending = run().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}
