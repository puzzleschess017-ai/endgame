import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { TACTICS, TACTICS_LESSONS, tacticBySlug, tacticForPath, tacticPath } from './tactics.ts';
import { practiceHref } from './endgames.ts';

const diagrams = TACTICS_LESSONS.flatMap((l) => l.sections.flatMap((s) => (s.diagram ? [{ lesson: l.slug, ...s.diagram }] : [])));

function words(lesson: (typeof TACTICS_LESSONS)[number]): number {
  const texts = [...lesson.intro, ...lesson.sections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])])];
  return texts.join(' ').split(/\s+/).length;
}

test('there are ten lessons, slugs are unique and every related lesson exists', () => {
  assert.equal(TACTICS_LESSONS.length, 10);
  const slugs = TACTICS_LESSONS.map((l) => l.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of ['fork', 'pin', 'skewer', 'discovered-attack', 'double-check', 'back-rank-mate', 'deflection', 'smothered-mate', 'zugzwang', 'attraction']) {
    assert.ok(slugs.includes(slug), slug);
  }
  for (const lesson of TACTICS_LESSONS) {
    assert.ok(lesson.related.length > 0, lesson.slug);
    for (const slug of lesson.related) assert.ok(slugs.includes(slug), `${lesson.slug} -> ${slug}`);
    assert.ok(!lesson.related.includes(lesson.slug));
    assert.equal(lesson.kind, 'Tactic');
  }
});

test('every lesson has two or three diagrams, all legal, with captions and real arrows', () => {
  for (const lesson of TACTICS_LESSONS) {
    const count = lesson.sections.filter((s) => s.diagram).length;
    assert.ok(count >= 2 && count <= 3, `${lesson.slug} has ${count} diagrams`);
  }
  for (const d of diagrams) {
    new Chess(d.fen); // throws for an illegal position
    assert.ok(d.caption.length > 10);
    for (const square of (d.arrows ?? []).flat()) assert.match(square, /^[a-h][1-8]$/);
  }
});

test('every lesson is about 400 to 650 words long', () => {
  for (const lesson of TACTICS_LESSONS) {
    const n = words(lesson);
    assert.ok(n >= 400 && n <= 650, `${lesson.slug} has ${n} words`);
  }
});

test('the practice position is legal and opens in Board Analysis', () => {
  for (const lesson of TACTICS_LESSONS) {
    new Chess(lesson.practice.fen);
    assert.ok(lesson.practice.label.length > 5);
    assert.ok(practiceHref(lesson).startsWith('/analysis?fen='), lesson.slug);
  }
});

test('lesson paths round trip', () => {
  for (const lesson of TACTICS_LESSONS) {
    assert.equal(tacticForPath(tacticPath(lesson.slug)), lesson);
    assert.equal(tacticBySlug(lesson.slug), lesson);
  }
  assert.equal(tacticForPath('/tactics'), undefined);
  assert.equal(tacticForPath('/tactics/nope'), undefined);
  assert.equal(tacticForPath('/openings/italian-game'), undefined);
});

test('every lesson is in one of the groups of the index, no group is empty, and the puzzle modes are linked', () => {
  for (const lesson of TACTICS_LESSONS) assert.ok(TACTICS.groups.includes(lesson.group), `${lesson.slug}: ${lesson.group}`);
  for (const group of TACTICS.groups) assert.ok(TACTICS_LESSONS.some((l) => l.group === group), group);
  assert.deepEqual(TACTICS.training?.map((t) => t.href), ['/streak', '/survival']);
});

// The tactics of the lessons, played out. The positions were also checked with Stockfish (see the top of tactics.ts).

function lessonHasDiagram(slug: string, fen: string): boolean {
  return !!tacticBySlug(slug)?.sections.some((s) => s.diagram?.fen === fen);
}
function game(fen: string, ...moves: string[]): Chess {
  const chess = new Chess(fen);
  for (const move of moves) chess.move(move);
  return chess;
}
/** Every legal reply of the side to move; `check` is run on the position after each of them. */
function everyReply(chess: Chess, check: (after: Chess, reply: string) => void): void {
  const replies = chess.moves();
  assert.ok(replies.length > 0);
  for (const reply of replies) check(game(chess.fen(), reply), reply);
}
function withTurn(fen: string, turn: 'w' | 'b'): string {
  const parts = fen.split(' ');
  parts[1] = turn;
  return parts.join(' ');
}
const winsAQueen = (c: Chess) => c.moves({ verbose: true }).some((m) => m.captured === 'q');

test('fork: Ne7+ and Qd5+ are checks, and the next move wins the queen and the rook', () => {
  const knight = '2q3k1/pp3ppp/8/3N4/8/8/PP3PPP/4K3 w - - 0 1';
  assert.ok(lessonHasDiagram('fork', knight));
  const afterKnight = game(knight, 'Ne7+');
  assert.ok(afterKnight.inCheck());
  everyReply(afterKnight, (c) => assert.ok(c.moves().includes('Nxc8'), 'the queen is lost'));
  const queen = 'r5k1/p5pp/8/8/8/8/PPP2PPP/3Q2K1 w - - 0 1';
  assert.ok(lessonHasDiagram('fork', queen));
  const afterQueen = game(queen, 'Qd5+');
  everyReply(afterQueen, (c) => assert.ok(c.moves().some((m) => m.startsWith('Qxa8')), 'the rook is lost'));
});

test('pin: the knight on c6 and the knight on c3 cannot move, the knight on f6 can, and Bxe7 wins the pinned knight', () => {
  const ruy = new Chess('r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4');
  assert.ok(lessonHasDiagram('pin', ruy.fen()));
  assert.deepEqual(new Chess(withTurn(ruy.fen(), 'b')).moves({ square: 'c6' }), []);
  const nimzo = 'rnbqk2r/pppp1ppp/4pn2/6B1/1bPP4/2N5/PP2PPPP/R2QKBNR b KQkq - 3 4';
  assert.ok(lessonHasDiagram('pin', nimzo));
  assert.deepEqual(new Chess(withTurn(nimzo, 'w')).moves({ square: 'c3' }), [], 'absolute pin');
  assert.ok(new Chess(nimzo).moves({ square: 'f6' }).length > 0, 'relative pin: the knight may move');
  const win = '4k3/4n3/5B2/8/8/8/5PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('pin', win));
  assert.deepEqual(new Chess(withTurn(win, 'b')).moves({ square: 'e7' }), [], 'the knight on e7 is pinned');
  assert.ok(!game(win, 'Bxe7').moves().includes('Kxe7'), 'the rook protects the bishop');
});

test('skewer: the king has to move and the piece behind it is taken', () => {
  const bishop = '4r3/pp1k1ppp/8/8/8/8/PPP2PPP/5BK1 w - - 0 1';
  assert.ok(lessonHasDiagram('skewer', bishop));
  const afterBishop = game(bishop, 'Bb5+');
  assert.ok(afterBishop.inCheck());
  everyReply(afterBishop, (c) => assert.ok(c.moves().includes('Bxe8'), 'the rook is lost'));
  const rook = '3q4/3k4/8/8/8/8/5PPP/R5K1 w - - 0 1';
  assert.ok(lessonHasDiagram('skewer', rook));
  const afterRook = game(rook, 'Rd1+');
  assert.ok(afterRook.inCheck());
  everyReply(afterRook, (c) => assert.ok(c.moves().some((m) => m.startsWith('Rxd8')), 'the queen is lost'));
});

test('discovered attack: Nc6+ is a check from the rook and from the queen, and the queen is lost', () => {
  const rook = '3qk3/pppp1ppp/8/4N3/8/8/PPP2PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('discovered-attack', rook));
  const afterRook = game(rook, 'Nc6+');
  assert.ok(afterRook.inCheck());
  everyReply(afterRook, (c) => assert.ok(winsAQueen(c)));
  const petrov = new Chess();
  petrov.loadPgn('1. e4 e5 2. Nf3 Nf6 3. Nxe5 Nxe4 4. Qe2 Nf6');
  assert.ok(lessonHasDiagram('discovered-attack', petrov.fen()));
  const afterQueen = game(petrov.fen(), 'Nc6+');
  assert.ok(afterQueen.inCheck());
  everyReply(afterQueen, (c) => assert.ok(winsAQueen(c)));
});

test('double check: Nd6# and Nf6# are mate, and Nxf6+ is followed by Re8# after every king move', () => {
  const mate = '3qkb2/pppp1ppp/8/8/4N3/8/PPP2PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('double-check', mate));
  assert.ok(game(mate, 'Nd6#').isCheckmate());
  assert.ok(game(mate, 'Nf6#').isCheckmate());
  const queen = '4k3/pppp1ppp/5q2/8/4N3/8/PPP2PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('double-check', queen));
  const after = game(queen, 'Nxf6+');
  assert.deepEqual(after.moves().sort(), ['Kd8', 'Kf8'], 'only the king can move');
  everyReply(after, (c) => assert.ok(game(c.fen(), 'Re8#').isCheckmate()));
});

test('deflection: Re8+ Rxe8 Qxe8# and the Opera Game 16.Qb8+ Nxb8 17.Rd8#', () => {
  const back = '1r4k1/5ppp/8/3n4/Q7/8/5PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('deflection', back));
  assert.ok(game(back, 'Re8+', 'Rxe8', 'Qxe8#').isCheckmate());
  assert.deepEqual(game(back, 'Re8+').moves(), ['Rxe8'], 'the rook has to take');
  const opera = new Chess();
  opera.loadPgn(
    '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7',
  );
  assert.ok(lessonHasDiagram('deflection', opera.fen()));
  assert.deepEqual(game(opera.fen(), 'Qb8+').moves(), ['Nxb8'], 'the knight has to take');
  assert.ok(game(opera.fen(), 'Qb8+', 'Nxb8', 'Rd8#').isCheckmate());
});

test('attraction: Légal\'s mate, and the rook sacrifice that wins the queen', () => {
  const legal = new Chess();
  legal.loadPgn('1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1');
  assert.ok(lessonHasDiagram('attraction', legal.fen()));
  assert.deepEqual(game(legal.fen(), 'Bxf7+').moves(), ['Ke7'], 'the king is dragged to e7');
  assert.ok(game(legal.fen(), 'Bxf7+', 'Ke7', 'Nd5#').isCheckmate());
  const rook = '2bq2k1/pp4p1/2p1p3/3p2N1/8/2P4R/PP3PP1/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('attraction', rook));
  assert.deepEqual(game(rook, 'Rh8+').moves(), ['Kxh8'], 'the king has to take');
  const fork = game(rook, 'Rh8+', 'Kxh8', 'Nf7+');
  assert.ok(fork.inCheck());
  everyReply(fork, (c) => assert.ok(winsAQueen(c)));
});

test('zugzwang: the same pieces with White to move and with Black to move', () => {
  const zugzwang = tacticBySlug('zugzwang')!.sections.flatMap((s) => (s.diagram ? [s.diagram] : []));
  assert.equal(zugzwang.length, 3);
  const [draw, loss, king] = zugzwang.map((d) => new Chess(d.fen));
  assert.equal(draw.turn(), 'w');
  assert.equal(loss.turn(), 'b');
  assert.equal(draw.fen().split(' ')[0], loss.fen().split(' ')[0], 'the same position');
  // 1...Kd7 2.Kf6 is the line of the third diagram
  const line = game(loss.fen(), 'Kd7', 'Kf6');
  assert.equal(line.fen().split(' ')[0], king.fen().split(' ')[0]);
  assert.equal(king.turn(), 'b');
});

test('back-rank mate: Re8# is mate, and with luft Re8+ is not', () => {
  const mate = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('back-rank-mate', mate));
  assert.ok(game(mate, 'Re8#').isCheckmate());
  const luft = '6k1/5pp1/7p/8/8/8/5PPP/4R1K1 w - - 0 1';
  assert.ok(lessonHasDiagram('back-rank-mate', luft));
  const check = game(luft, 'Re8+');
  assert.ok(check.inCheck() && !check.isCheckmate());
  assert.deepEqual(check.moves(), ['Kh7']);
});

test('smothered mate: Nf7# and the Blackburne Shilling Gambit trap 7...Nf3#', () => {
  const pattern = '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1';
  assert.ok(lessonHasDiagram('smothered-mate', pattern));
  assert.ok(game(pattern, 'Nf7#').isCheckmate());
  const trap = new Chess();
  trap.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2');
  assert.ok(lessonHasDiagram('smothered-mate', trap.fen()));
  assert.ok(game(trap.fen(), 'Nf3#').isCheckmate());
});
