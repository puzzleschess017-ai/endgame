import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { LESSONS, lessonBySlug, lessonForPath, practiceHref } from './endgames.ts';

const diagrams = LESSONS.flatMap((l) => l.sections.flatMap((s) => (s.diagram ? [{ lesson: l.slug, ...s.diagram }] : [])));

test('slugs are unique and every related lesson exists', () => {
  const slugs = LESSONS.map((l) => l.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const lesson of LESSONS) {
    assert.ok(lesson.related.length > 0, lesson.slug);
    for (const slug of lesson.related) assert.ok(slugs.includes(slug), `${lesson.slug} -> ${slug}`);
    assert.ok(!lesson.related.includes(lesson.slug));
  }
});

test('every diagram and practice position is a legal position of at most 7 pieces', () => {
  const fens = [...diagrams.map((d) => d.fen), ...LESSONS.map((l) => l.practice.fen)];
  for (const fen of fens) {
    const chess = new Chess(fen); // throws for an illegal position
    const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
    assert.ok(pieces <= 7, fen);
    assert.ok(chess.moves().length > 0 || chess.isCheckmate() || chess.isStalemate(), fen);
  }
});

test('every lesson has diagrams with captions, and arrows point at real squares', () => {
  for (const lesson of LESSONS) assert.ok(lesson.sections.some((s) => s.diagram), lesson.slug);
  for (const d of diagrams) {
    assert.ok(d.caption.length > 10);
    for (const square of (d.arrows ?? []).flat()) assert.match(square, /^[a-h][1-8]$/);
  }
});

test('the stalemate diagram really is a stalemate and the mate diagrams really mate', () => {
  assert.ok(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').isStalemate());
  const queen = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
  queen.move('Qg7');
  assert.ok(queen.isCheckmate());
  const rook = new Chess('7k/8/6K1/8/8/8/8/R7 w - - 0 1');
  rook.move('Ra8');
  assert.ok(rook.isCheckmate());
});

test('the Lucena line in the text is playable move by move', () => {
  const chess = new Chess('3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 1');
  for (const move of ['Rf1+', 'Kg7', 'Rf4', 'Ra1', 'Kc7', 'Rc1+', 'Kb6', 'Rb1+', 'Kc6', 'Rc1+', 'Kb5', 'Rb1+', 'Rb4']) chess.move(move);
  assert.equal(chess.fen().split(' ')[0], '8/3P2k1/8/1K6/1R6/8/8/1r6');
  const philidor = new Chess('4k3/8/r7/3KP3/8/8/7R/8 w - - 0 1');
  philidor.move('e6');
  philidor.move('Ra1');
  assert.equal(philidor.fen().split(' ')[0], '4k3/8/4P3/3K4/8/8/7R/r7');
});

test('lookups by address', () => {
  assert.equal(lessonForPath('/endgames/lucena-position/')?.slug, 'lucena-position');
  assert.equal(lessonForPath('/endgames'), undefined);
  assert.equal(lessonForPath('/endgames/nope'), undefined);
  assert.equal(lessonBySlug('nope'), undefined);
});

test('the practise link carries the position in the address', () => {
  const lesson = LESSONS[0];
  const href = practiceHref(lesson);
  assert.ok(href.startsWith('/analysis?fen='));
  assert.equal(new URLSearchParams(href.split('?')[1]).get('fen'), lesson.practice.fen);
});
