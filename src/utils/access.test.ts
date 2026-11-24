import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCESS,
  ALL_COUNTS,
  ALL_CYCLES,
  ALL_DIFFICULTIES,
  ALL_LEVELS,
  ALL_MATE_IN,
  ALL_MEMORIZE,
  canOpenBlindfold,
  checkBlindfoldDrill,
  checkBlindfoldLevel,
  checkBlindfoldMateIn,
  clampBlindfold,
  clampDrill,
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
    for (const kind of ['color', 'check', 'diagonal', 'knight', 'reconstruct'] as const) assert.equal(ok(checkBlindfoldDrill('guest', kind)), false);
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
  it('signed in: the square colours and check or not drills', () => {
    assert.ok(ok(checkBlindfoldDrill('free', 'color')));
    assert.ok(ok(checkBlindfoldDrill('free', 'check')));
    const diagonal = checkBlindfoldDrill('free', 'diagonal');
    assert.deepEqual([diagonal.ok, !diagonal.ok && diagonal.needs], [false, 'premium']);
    assert.equal(ok(checkBlindfoldDrill('free', 'knight')), false);
    const rebuild = checkBlindfoldDrill('free', 'reconstruct');
    assert.deepEqual([rebuild.ok, !rebuild.ok && rebuild.needs], [false, 'premium']);
  });
  it('premium has everything', () => {
    assert.deepEqual(ACCESS.premium.woodpecker.cycles, ALL_CYCLES);
    assert.deepEqual(ACCESS.premium.woodpecker.counts, ALL_COUNTS);
    assert.deepEqual(ACCESS.premium.woodpecker.difficulties, ALL_DIFFICULTIES);
    assert.deepEqual(ACCESS.premium.woodpecker.types, ['classic', 'endgame']);
    assert.deepEqual(ACCESS.premium.blindfold.levels, ALL_LEVELS);
    assert.deepEqual(ACCESS.premium.blindfold.memorize, ALL_MEMORIZE);
    assert.deepEqual(ACCESS.premium.blindfold.mateIn, ALL_MATE_IN);
    for (const kind of ['color', 'check', 'diagonal', 'knight', 'reconstruct'] as const) assert.ok(ok(checkBlindfoldDrill('premium', kind)));
  });
  it('every tier has at least what the lower tier has', () => {
    for (const [low, high] of [['guest', 'free'], ['free', 'premium']] as const) {
      const a = ACCESS[low].woodpecker, b = ACCESS[high].woodpecker;
      for (const key of ['cycles', 'counts', 'difficulties', 'types'] as const) {
        for (const v of a[key] as unknown[]) assert.ok((b[key] as unknown[]).includes(v), `${high} lacks ${key} ${String(v)}`);
      }
      for (const v of ACCESS[low].blindfold.levels) assert.ok(ACCESS[high].blindfold.levels.includes(v));
      for (const v of ACCESS[low].blindfold.memorize) assert.ok(ACCESS[high].blindfold.memorize.includes(v));
      for (const v of ACCESS[low].blindfold.mateIn) assert.ok(ACCESS[high].blindfold.mateIn.includes(v));
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
    assert.equal(tierFor((a) => a.blindfold.drills, 'check'), 'free');
    assert.equal(tierFor((a) => a.blindfold.drills, 'diagonal'), 'premium');
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

describe('the biggest Woodpecker sets are Premium only', () => {
  it('300 and 500 puzzles, 8 and 9 cycles: only Premium', () => {
    for (const tier of ['guest', 'free'] as const) {
      assert.ok(!ACCESS[tier].woodpecker.counts.includes(300) && !ACCESS[tier].woodpecker.counts.includes(500), tier);
      assert.ok(!ACCESS[tier].woodpecker.cycles.includes(8) && !ACCESS[tier].woodpecker.cycles.includes(9), tier);
    }
    assert.ok(ACCESS.premium.woodpecker.counts.includes(300) && ACCESS.premium.woodpecker.counts.includes(500));
    assert.ok(ACCESS.premium.woodpecker.cycles.includes(8) && ACCESS.premium.woodpecker.cycles.includes(9));
    assert.equal(tierFor((a) => a.woodpecker.counts, 500), 'premium');
    assert.equal(tierFor((a) => a.woodpecker.cycles, 9), 'premium');
    assert.ok(!ok(checkWoodpecker('free', { puzzleCount: 300, difficulty: 'easy', puzzleMode: 'classic' })));
    assert.ok(ok(checkWoodpecker('premium', { puzzleCount: 500, totalCycles: 9, difficulty: 'mixed', puzzleMode: 'endgame' })));
  });
});

describe('checks the server can make and the clamps', () => {
  it('checkWoodpecker without cycles only checks type, difficulty and count', () => {
    assert.ok(ok(checkWoodpecker('guest', { puzzleCount: 50, difficulty: 'medium', puzzleMode: 'classic' })));
    assert.ok(!ok(checkWoodpecker('guest', { puzzleCount: 100, difficulty: 'medium', puzzleMode: 'classic' })));
    assert.ok(!ok(checkWoodpecker('free', { puzzleCount: 50, difficulty: 'expert', puzzleMode: 'classic' })));
    assert.ok(!ok(checkWoodpecker('free', { puzzleCount: 50, difficulty: 'easy', puzzleMode: 'endgame' })));
    assert.ok(ok(checkWoodpecker('premium', { puzzleCount: 200, difficulty: 'mixed', puzzleMode: 'endgame' })));
  });
  it('a set with no type is an endgame set (old saved sessions)', () => {
    assert.ok(!ok(checkWoodpecker('free', { puzzleCount: 50, difficulty: 'easy' })));
  });
  it('checkBlindfoldLevel: guests none, free 6 and 7, premium all', () => {
    assert.ok(!ok(checkBlindfoldLevel('guest', 6)));
    assert.ok(ok(checkBlindfoldLevel('free', 6)) && ok(checkBlindfoldLevel('free', 7)));
    assert.ok(!ok(checkBlindfoldLevel('free', 8)) && !ok(checkBlindfoldLevel('free', 32)));
    for (const level of ALL_LEVELS) assert.ok(ok(checkBlindfoldLevel('premium', level)));
  });
  it('checkBlindfoldMateIn: mate in 1 for signed-in accounts, mate in 2 and 3 only for Premium', () => {
    assert.ok(!ok(checkBlindfoldMateIn('guest', 1)));
    assert.ok(ok(checkBlindfoldMateIn('free', 1)));
    for (const n of [2, 3] as const) {
      const free = checkBlindfoldMateIn('free', n);
      assert.deepEqual([free.ok, !free.ok && free.needs], [false, 'premium']);
      assert.ok(ok(checkBlindfoldMateIn('premium', n)));
    }
    assert.equal(tierFor((a) => a.blindfold.mateIn, 1), 'free');
    assert.equal(tierFor((a) => a.blindfold.mateIn, 3), 'premium');
  });
  it('checkBlindfoldMate looks at the length of the mate too', () => {
    const settings = { level: 7, memorize: 10 } as const;
    assert.ok(ok(checkBlindfoldMate('free', settings)));
    assert.ok(ok(checkBlindfoldMate('free', { ...settings, mateIn: 1 })));
    assert.ok(!ok(checkBlindfoldMate('free', { ...settings, mateIn: 2 })));
    assert.ok(ok(checkBlindfoldMate('premium', { level: 32, memorize: 5, mateIn: 3 })));
  });
  it('clampBlindfold takes a mate length the tier does not have back to one it has', () => {
    assert.equal(clampBlindfold('free', { level: 7, memorize: 10, mateIn: 3 }).mateIn, 1);
    assert.equal(clampBlindfold('free', { level: 7, memorize: 10, mateIn: 2 }).mateIn, 1);
    assert.equal(clampBlindfold('premium', { level: 7, memorize: 10, mateIn: 3 }).mateIn, 3);
    assert.deepEqual(clampBlindfold('free', { level: 7, memorize: 10, mateIn: 2 }), { level: 7, memorize: 10, mateIn: 1 });
  });
  it('clampBlindfold keeps allowed settings and moves the others to the nearest allowed ones', () => {
    assert.deepEqual(clampBlindfold('free', { level: 7, memorize: 10 }), { level: 7, memorize: 10 });
    assert.deepEqual(clampBlindfold('free', { level: 10, memorize: 20 }), { level: 7, memorize: 10 });
    assert.deepEqual(clampBlindfold('free', { level: 32, memorize: 5 }), { level: 7, memorize: 10 });
    assert.deepEqual(clampBlindfold('premium', { level: 32, memorize: 5 }), { level: 32, memorize: 5 });
    assert.deepEqual(clampBlindfold('guest', { level: 32, memorize: 5 }), { level: 32, memorize: 5 });
  });
  it('clampDrill: free keeps the colour and check drills and moves the others to the first one', () => {
    assert.equal(clampDrill('free', 'color'), 'color');
    assert.equal(clampDrill('free', 'check'), 'check');
    assert.equal(clampDrill('free', 'reconstruct'), 'color');
    assert.equal(clampDrill('premium', 'reconstruct'), 'reconstruct');
    assert.equal(clampDrill('free', 'knight'), 'color');
    assert.equal(clampDrill('premium', 'knight'), 'knight');
  });
});
