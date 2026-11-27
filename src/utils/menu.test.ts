import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isActive, NAV_GROUPS, NAV_ITEMS } from '../utils/menu.ts';

const item = (id: string) => NAV_ITEMS.find((i) => i.id === id)!;

describe('the menu entries', () => {
  it('every page has its own id and address, and an address that is a path', () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    const hrefs = NAV_ITEMS.map((i) => i.href);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(hrefs).size, hrefs.length);
    for (const href of hrefs) assert.match(href, /^\/[a-z]*$/);
  });
  it('the groups of the drop-down menus have a name and entries; Pricing is the only one in Premium', () => {
    for (const group of NAV_GROUPS) {
      assert.ok(group.label.length > 0 && group.items.length > 0, group.id);
    }
    assert.deepEqual(NAV_GROUPS.find((g) => g.id === 'premium')?.items.map((i) => i.id), ['pricing']);
  });
  it('every entry of a drop-down menu says in a line what the page is (the entries that are links of the bar need none)', () => {
    for (const group of NAV_GROUPS.filter((g) => g.id !== 'premium')) {
      for (const entry of group.items) assert.ok(entry.blurb && entry.blurb.length > 10 && entry.blurb.length < 70, entry.id);
    }
  });
});

describe('which entry is marked as the current page', () => {
  it('the page itself', () => {
    assert.equal(isActive(item('streak'), '/streak'), true);
    assert.equal(isActive(item('streak'), '/survival'), false);
  });
  it('a lesson keeps its collection marked', () => {
    assert.equal(isActive(item('theory'), '/endgames/lucena-position'), true);
    assert.equal(isActive(item('openings'), '/openings/italian-game'), true);
    assert.equal(isActive(item('tactics'), '/tactics/fork'), true);
    assert.equal(isActive(item('tactics'), '/openings/fork'), false);
  });
});
