import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACCESS } from './access.ts';
import { pricingGroups, type PricingRow } from './pricing.ts';

function find(label: RegExp): PricingRow {
  for (const group of pricingGroups()) {
    const hit = group.rows.find((r) => label.test(r.label));
    if (hit) return hit;
  }
  throw new Error(`no row for ${label}`);
}

describe('pricing table', () => {
  it('has a guest, free and Premium cell in every row', () => {
    for (const group of pricingGroups()) {
      assert.ok(group.rows.length > 0, group.id);
      for (const r of group.rows) {
        for (const cell of [r.guest, r.free, r.premium]) assert.ok(typeof cell === 'string' || typeof cell === 'boolean', r.label);
      }
    }
  });
  it('follows the access rules: what a plan can pick is what the row says', () => {
    const cycles = find(/Cycles/);
    assert.deepEqual([cycles.guest, cycles.free, cycles.premium], ['Up to 3', 'Up to 4', 'Up to 9']);
    const counts = find(/Puzzles in a set/);
    assert.deepEqual([counts.guest, counts.free, counts.premium], ['Up to 50', 'Up to 100', 'Up to 500']);
    assert.equal(ACCESS.premium.woodpecker.counts.at(-1), 500);
    assert.equal(find(/Difficulty/).free, 'Easy, Medium, Hard');
    assert.equal(find(/Puzzle types/).free, 'Classic');
    assert.equal(find(/Puzzle types/).premium, 'Classic, Endgame');
  });
  it('a closed mode is "not included" (false) for a guest and open for the others', () => {
    for (const label of [/Mate positions/, /Time to memorize/, /^Mate in/, /^Drills/, /Timed drills/]) {
      const r = find(label);
      assert.equal(r.guest, false, String(label));
      assert.equal(typeof r.free, 'string', String(label));
      assert.equal(typeof r.premium, 'string', String(label));
    }
    assert.equal(find(/^Drills/).free, 'Square color');
    assert.equal(find(/^Drills/).premium, 'All 10 drills');
    assert.equal(find(/Mate positions/).free, 'Up to 7 pieces');
    assert.equal(find(/Mate positions/).premium, 'Any number of pieces');
    assert.equal(find(/^Mate in/).free, '1 move');
    assert.equal(find(/^Mate in/).premium, 'Up to 3 moves');
    assert.equal(find(/Timed drills/).premium, '1 minute or No time limit');
  });
  it('the account rows: sync and the engine need an account, e-books need Premium', () => {
    const sync = find(/saved to your account/);
    assert.deepEqual([sync.guest, sync.free, sync.premium], [false, true, true]);
    const engine = find(/engine/);
    assert.deepEqual([engine.guest, engine.free, engine.premium], [false, true, true]);
    const books = find(/e-book/);
    assert.deepEqual([books.guest, books.free, books.premium], [false, false, true]);
  });
});
