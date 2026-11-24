/** Rules for the puzzle sets Woodpecker asks for (`GET /api/puzzles/sample`). */

export const SAMPLE_COUNTS = [10, 50, 100, 200] as const;

/** The four rating bands, in order. Mixed draws from all of them. */
export const RATING_BANDS = ['easy', 'medium', 'hard', 'expert'] as const;
export type RatingBand = (typeof RATING_BANDS)[number];

export const SAMPLE_DIFFICULTIES = [...RATING_BANDS, 'mixed'] as const;
export type SampleDifficulty = (typeof SAMPLE_DIFFICULTIES)[number];

export type SampleQuery =
  | { ok: true; count: number; difficulty: SampleDifficulty }
  | { ok: false; error: string };

/** Checks the query string of the sample endpoint. */
export function parseSampleQuery(query: { count?: unknown; difficulty?: unknown }): SampleQuery {
  const count = Number(query.count);
  if (!Number.isInteger(count) || !(SAMPLE_COUNTS as readonly number[]).includes(count)) {
    return { ok: false, error: `Invalid count. Must be ${SAMPLE_COUNTS.join(', ')}.` };
  }
  const difficulty = typeof query.difficulty === 'string' ? query.difficulty.toLowerCase() : '';
  if (!(SAMPLE_DIFFICULTIES as readonly string[]).includes(difficulty)) {
    return {
      ok: false,
      error: 'Invalid difficulty. Must be easy, medium, hard, expert, or mixed.',
    };
  }
  return { ok: true, count, difficulty: difficulty as SampleDifficulty };
}

/**
 * How many puzzles a Mixed set takes from each rating band: as even as possible, and when the count
 * does not divide by four (10 puzzles = 2 + 2 + 3 + 3, for example) the extra ones go to randomly
 * chosen bands so no band is favoured.
 */
export function splitMixedCount(
  count: number,
  random: () => number = Math.random,
): Record<RatingBand, number> {
  const base = Math.floor(count / RATING_BANDS.length);
  const split = Object.fromEntries(RATING_BANDS.map((band) => [band, base])) as Record<RatingBand, number>;
  const bands = [...RATING_BANDS];
  for (let i = bands.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }
  for (let i = 0; i < count - base * RATING_BANDS.length; i++) split[bands[i]] += 1;
  return split;
}
