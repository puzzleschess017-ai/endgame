import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { ENDGAMES, LESSONS, lessonBySlug, lessonForPath, practiceHref } from './endgames.ts';

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

test('the rule of the square, the queen against a pawn and the two new mates are what the text says', () => {
  // Rule of the square: the pawn on a4 is caught when the king stands on e6 or when Black is to move from f6.
  const caught = new Chess('8/8/4k3/8/P7/8/8/7K w - - 0 1');
  for (const move of ['a5', 'Kd7', 'a6', 'Kc7', 'a7', 'Kb7']) caught.move(move);
  assert.equal(caught.get('a7')?.type, 'p');
  assert.equal(caught.get('b7')?.type, 'k');
  const tooLate = new Chess('8/8/5k2/8/P7/8/8/7K b - - 0 1');
  tooLate.move('Ke6');
  assert.equal(tooLate.get('e6')?.type, 'k');
  // Queen against the c-pawn: taking it is stalemate; the d-pawn line from the text is playable.
  const stalemate = new Chess('8/8/7K/8/8/1Q6/2p5/k7 w - - 0 1');
  stalemate.move('Qxc2');
  assert.ok(stalemate.isStalemate());
  const dPawn = new Chess('8/8/7K/3Q4/8/8/2kp4/8 w - - 0 1');
  for (const move of ['Qc4+', 'Kb2', 'Qd3', 'Kc1', 'Qc3+', 'Kd1']) dPawn.move(move);
  assert.equal(dPawn.get('d1')?.type, 'k');
  // Bishop and knight: the wrong corner is a corner of the other color, and Be4 is mate.
  const wrongCorner = new Chess('7k/5K2/8/8/8/8/4B3/6N1 b - - 0 1');
  assert.equal(wrongCorner.moves().length, 1);
  const knightMate = new Chess('k7/3N4/1K6/8/8/3B4/8/8 w - - 0 1');
  knightMate.move('Be4');
  assert.ok(knightMate.isCheckmate());
  // Two bishops of opposite colors give mate with Bf6.
  const bishops = new Chess('7k/8/4B1K1/6B1/8/8/8/8 w - - 0 1');
  bishops.move('Bf6');
  assert.ok(bishops.isCheckmate());
});

test('the stalemate and two knights diagrams are what the text says', () => {
  const queen = (move: string) => {
    const chess = new Chess('7k/8/6K1/3Q4/8/8/8/8 w - - 0 1');
    chess.move(move);
    return chess;
  };
  assert.ok(queen('Qf7').isStalemate());
  assert.ok(queen('Qd8').isCheckmate());
  const rook = (move: string) => {
    const chess = new Chess('k7/7R/1K6/8/8/8/8/8 w - - 0 1');
    chess.move(move);
    return chess;
  };
  assert.ok(rook('Rb7').isStalemate());
  assert.ok(rook('Rh8').isCheckmate());
  assert.ok(new Chess('7k/5K2/6P1/8/8/8/8/8 b - - 0 1').isStalemate());
  const pawn = new Chess('7k/5K2/8/6P1/8/8/8/8 w - - 0 1');
  for (const move of ['Kg6', 'Kg8', 'Kh6', 'Kf7', 'g6+']) pawn.move(move);
  assert.equal(pawn.get('g6')?.type, 'p');
  const knights = new Chess('7k/4N3/6K1/6N1/8/8/8/8 w - - 0 1');
  knights.move('Nf7');
  assert.ok(knights.isCheckmate());
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

test('every lesson is in one of the groups of the index, and no group is empty', () => {
  const groups = ENDGAMES.groups;
  for (const lesson of LESSONS) assert.ok(groups.includes(lesson.group), `${lesson.slug}: ${lesson.group}`);
  for (const group of groups) assert.ok(LESSONS.some((l) => l.group === group), group);
});
