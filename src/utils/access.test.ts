import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCESS,
  ALL_COUNTS,
  ALL_CYCLES,
  ALL_DIFFICULTIES,
  ALL_LEVELS,
  ALL_MEMORIZE,
  canOpenBlindfold,
  checkBlindfoldDrill,
  checkBlindfoldMate,
  checkWoodpecker,
  defaultWoodpecker,
  isTier,
  tierFor,
  unlockHint,
} from './access.ts';

const ok = (c: { ok: boolean }) => c.ok;

describe('the three tiers', () => {
  it('guest: Woodpecker Classic, easy and medium, 10 or 50 puzzles, 2 or 3 cycles', () => {
    const w = ACCESS.guest.woodpecker;
    assert.deepEqual(w.types, ['classic']);
    assert.deepEqual(w.difficulties, ['easy', 'medium']);
    assert.deepEqual(w.counts, [10, 50]);
    assert.deepEqual(w.cycles, [2, 3]);
  });
  it('guest: no Blindfold at all', () => {
    assert.equal(canOpenBlindfold('guest'), false);
    assert.equal(ok(checkBlindfoldMate('guest', { level: 6, memorize: 10 })), false);
    for (const kind of ['color', 'diagonal', 'knight'] as const) assert.equal(ok(checkBlindfoldDrill('guest', kind)), false);
  });
  it('signed in: Classic, easy to hard, 10 to 100 puzzles, 2 to 4 cycles', () => {
    const w = ACCESS.free.woodpecker;
    assert.deepEqual(w.types, ['classic']);
    assert.deepEqual(w.difficulties, ['easy', 'medium', 'hard']);
    assert.deepEqual(w.counts, [10, 50, 100]);
    assert.deepEqual(w.cycles, [2, 3, 4]);
  });
  it('signed in: Blindfold mate in 1 with up to 6 or 7 pieces and only 10 seconds', () => {
    assert.equal(canOpenBlindfold('free'), true);
    assert.ok(ok(checkBlindfoldMate('free', { level: 6, memorize: 10 })));
    assert.ok(ok(checkBlindfoldMate('free', { level: 7, memorize: 10 })));
    assert.equal(ok(checkBlindfoldMate('free', { level: 6, memorize: 5 })), false);
    assert.equal(ok(checkBlindfoldMate('free', { level: 6, memorize: 20 })), false);
    assert.equal(ok(checkBlindfoldMate('free', { level: 8, memorize: 10 })), false);
    assert.equal(ok(checkBlindfoldMate('free', { level: 32, memorize: 10 })), false);
  });
  it('signed in: only the square colours drill', () => {
    assert.ok(ok(checkBlindfoldDrill('free', 'color')));
    const diagonal = checkBlindfoldDrill('free', 'diagonal');
    assert.deepEqual([diagonal.ok, !diagonal.ok && diagonal.needs], [false, 'premium']);
    assert.equal(ok(checkBlindfoldDrill('free', 'knight')), false);
  });
  it('premium has everything', () => {
    assert.deepEqual(ACCESS.premium.woodpecker.cycles, ALL_CYCLES);
    assert.deepEqual(ACCESS.premium.woodpecker.counts, ALL_COUNTS);
    assert.deepEqual(ACCESS.premium.woodpecker.difficulties, ALL_DIFFICULTIES);
    assert.deepEqual(ACCESS.premium.woodpecker.types, ['classic', 'endgame']);
    assert.deepEqual(ACCESS.premium.blindfold.levels, ALL_LEVELS);
    assert.deepEqual(ACCESS.premium.blindfold.memorize, ALL_MEMORIZE);
    for (const kind of ['color', 'diagonal', 'knight'] as const) assert.ok(ok(checkBlindfoldDrill('premium', kind)));
  });
  it('every tier has at least what the lower tier has', () => {
    for (const [low, high] of [['guest', 'free'], ['free', 'premium']] as const) {
      const a = ACCESS[low].woodpecker, b = ACCESS[high].woodpecker;
      for (const key of ['cycles', 'counts', 'difficulties', 'types'] as const) {
        for (const v of a[key] as unknown[]) assert.ok((b[key] as unknown[]).includes(v), `${high} lacks ${key} ${String(v)}`);
      }
      for (const v of ACCESS[low].blindfold.levels) assert.ok(ACCESS[high].blindfold.levels.includes(v));
      for (const v of ACCESS[low].blindfold.memorize) assert.ok(ACCESS[high].blindfold.memorize.includes(v));
      for (const v of ACCESS[low].blindfold.drills) assert.ok(ACCESS[high].blindfold.drills.includes(v));
    }
  });
});

describe('checkWoodpecker', () => {
  const classic = { puzzleCount: 50 as const, totalCycles: 3 as const, difficulty: 'medium' as const, puzzleMode: 'classic' as const };
  it('accepts a setup inside the limits', () => {
    assert.ok(ok(checkWoodpecker('guest', classic)));
    assert.ok(ok(checkWoodpecker('free', { ...classic, puzzleCount: 100, totalCycles: 4, difficulty: 'hard' })));
  });
  it('refuses each thing above the tier and says who has it', () => {
    const endgame = checkWoodpecker('free', { ...classic, puzzleMode: 'endgame' });
    assert.deepEqual([endgame.ok, !endgame.ok && endgame.needs], [false, 'premium']);
    const hard = checkWoodpecker('guest', { ...classic, difficulty: 'hard' });
    assert.deepEqual([hard.ok, !hard.ok && hard.needs], [false, 'free']);
    const expert = checkWoodpecker('free', { ...classic, difficulty: 'expert' });
    assert.deepEqual([expert.ok, !expert.ok && expert.needs], [false, 'premium']);
    const mixed = checkWoodpecker('free', { ...classic, difficulty: 'mixed' });
    assert.equal(mixed.ok, false);
    const hundred = checkWoodpecker('guest', { ...classic, puzzleCount: 100 });
    assert.deepEqual([hundred.ok, !hundred.ok && hundred.needs], [false, 'free']);
    const twoHundred = checkWoodpecker('free', { ...classic, puzzleCount: 200 });
    assert.deepEqual([twoHundred.ok, !twoHundred.ok && twoHundred.needs], [false, 'premium']);
    const cycles = checkWoodpecker('guest', { ...classic, totalCycles: 4 });
    assert.deepEqual([cycles.ok, !cycles.ok && cycles.needs], [false, 'free']);
    assert.equal(checkWoodpecker('free', { ...classic, totalCycles: 5 }).ok, false);
  });
  it('a session saved before Classic existed counts as an endgame set', () => {
    const { puzzleMode: _unused, ...old } = classic;
    assert.equal(checkWoodpecker('free', old).ok, false);
    assert.ok(ok(checkWoodpecker('premium', old)));
  });
  it('premium accepts every combination', () => {
    for (const puzzleCount of ALL_COUNTS) for (const totalCycles of ALL_CYCLES) for (const difficulty of ALL_DIFFICULTIES) for (const puzzleMode of ['classic', 'endgame'] as const) {
      assert.ok(ok(checkWoodpecker('premium', { puzzleCount, totalCycles, difficulty, puzzleMode })));
    }
  });
});

describe('helpers', () => {
  it('tierFor finds the lowest tier that has a choice', () => {
    assert.equal(tierFor((a) => a.woodpecker.difficulties, 'easy'), 'guest');
    assert.equal(tierFor((a) => a.woodpecker.difficulties, 'hard'), 'free');
    assert.equal(tierFor((a) => a.woodpecker.difficulties, 'expert'), 'premium');
    assert.equal(tierFor((a) => a.woodpecker.counts, 200), 'premium');
    assert.equal(tierFor((a) => a.woodpecker.counts, 7 as never), null);
    assert.equal(tierFor((a) => a.blindfold.drills, 'color'), 'free');
    assert.equal(tierFor((a) => a.blindfold.drills, 'knight'), 'premium');
    assert.equal(tierFor((a) => a.blindfold.levels, 7), 'free');
  });
  it('unlockHint', () => {
    assert.equal(unlockHint('guest', 'free'), 'Sign in to unlock');
    assert.equal(unlockHint('guest', 'premium'), 'Premium');
    assert.equal(unlockHint('free', 'premium'), 'Premium');
    assert.equal(unlockHint('free', 'free'), '');
    assert.equal(unlockHint('premium', 'free'), '');
    assert.equal(unlockHint('guest', null), '');
  });
  it('isTier', () => {
    assert.ok(isTier('guest') && isTier('free') && isTier('premium'));
    assert.ok(!isTier('admin') && !isTier(undefined));
  });
  it('the starting setup of every tier is allowed for that tier', () => {
    for (const tier of ['guest', 'free', 'premium'] as const) assert.ok(ok(checkWoodpecker(tier, defaultWoodpecker(tier))), tier);
    assert.equal(defaultWoodpecker('premium').puzzleMode, 'endgame');
    assert.equal(defaultWoodpecker('guest').puzzleMode, 'classic');
  });
});
