import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { OPENINGS, OPENING_LESSONS, after, openingBySlug, openingForPath, openingPath } from './openings.ts';
import { practiceHref } from './endgames.ts';

const diagrams = OPENING_LESSONS.flatMap((l) => l.sections.flatMap((s) => (s.diagram ? [{ lesson: l.slug, ...s.diagram }] : [])));

test('slugs are unique and every related lesson exists', () => {
  const slugs = OPENING_LESSONS.map((l) => l.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const lesson of OPENING_LESSONS) {
    assert.ok(lesson.related.length > 0, lesson.slug);
    for (const slug of lesson.related) assert.ok(slugs.includes(slug), `${lesson.slug} -> ${slug}`);
    assert.ok(!lesson.related.includes(lesson.slug));
  }
});

test('every diagram is a legal position and every lesson has diagrams with captions and real arrows', () => {
  for (const lesson of OPENING_LESSONS) assert.ok(lesson.sections.some((s) => s.diagram), lesson.slug);
  for (const d of diagrams) {
    new Chess(d.fen); // throws for an illegal position
    assert.ok(d.caption.length > 10);
    for (const square of (d.arrows ?? []).flat()) assert.match(square, /^[a-h][1-8]$/);
  }
});

test('every practice line is playable and ends in the position of its FEN', () => {
  for (const lesson of OPENING_LESSONS) {
    assert.ok(lesson.practice.pgn, lesson.slug);
    const chess = new Chess();
    chess.loadPgn(lesson.practice.pgn);
    assert.ok(chess.history().length >= 6, lesson.slug);
    assert.equal(chess.fen(), lesson.practice.fen, lesson.slug);
  }
});

test('the practice button opens the line, the first diagram follows the first moves', () => {
  for (const lesson of OPENING_LESSONS) assert.ok(practiceHref(lesson).startsWith('/analysis?pgn='));
  assert.equal(after('1. e4 e5').split(' ')[0], 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  assert.throws(() => after('1. e4 e4'));
});

test('lesson paths round trip', () => {
  for (const lesson of OPENING_LESSONS) {
    assert.equal(openingForPath(openingPath(lesson.slug)), lesson);
    assert.equal(openingBySlug(lesson.slug), lesson);
  }
  assert.equal(openingForPath('/openings'), undefined);
  assert.equal(openingForPath('/openings/nope'), undefined);
  assert.equal(openingForPath('/endgames/lucena-position'), undefined);
});

test('every lesson is in one of the groups of the index, and no group is empty', () => {
  const groups = OPENINGS.groups;
  for (const lesson of OPENING_LESSONS) assert.ok(groups.includes(lesson.group), `${lesson.slug}: ${lesson.group}`);
  for (const group of groups) assert.ok(OPENING_LESSONS.some((l) => l.group === group), group);
});
