import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { makeQuestion, QUESTION_KINDS, isDrillKind, drillLabel, drillDescription, DRILL_KINDS } from './drills.ts';
import {
  attackedSquares,
  attacks,
  between,
  kingCatchesPawn,
  followPieces,
  makeFollowGame,
  movesNeeded,
  movesText,
  oppositionHolder,
  squaresAttackedOnEmptyBoard,
  type Colour,
  type PieceName,
  type Walker,
} from './drillsMore.ts';

const SQUARES: string[] = [];
for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) SQUARES.push(`${f}${r}`);

const LETTER = { knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k', pawn: 'p' } as const;
const WORD: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Reference: chess.js says whether the piece (with the blockers) attacks the square. */
function referenceAttacks(piece: PieceName, side: Colour, from: string, target: string, blockers: string[]): boolean {
  const game = new Chess();
  game.clear();
  const colour = side === 'white' ? 'w' : 'b';
  game.put({ type: LETTER[piece], color: colour }, from as never);
  for (const b of blockers) game.put({ type: 'n', color: colour === 'w' ? 'b' : 'w' }, b as never);
  return game.attackers(target as never, colour).includes(from as never);
}

function mirror(square: string): string {
  return `${square[0]}${9 - Number(square[1])}`;
}

// ---- registration ----

test('the new drills are drill kinds with names and descriptions', () => {
  const added = ['attack', 'distance', 'count', 'endgame', 'follow'] as const;
  for (const kind of added) {
    assert.ok(isDrillKind(kind));
    assert.ok(DRILL_KINDS.includes(kind));
    assert.ok((QUESTION_KINDS as string[]).includes(kind));
    assert.ok(drillLabel(kind).length > 0);
    assert.ok(drillDescription(kind).length > 20);
  }
  assert.equal(new Set(DRILL_KINDS.map(drillLabel)).size, DRILL_KINDS.length, 'every drill has its own name');
  assert.ok(!isDrillKind('nope'));
  assert.ok(!isDrillKind(undefined));
  assert.ok(!(QUESTION_KINDS as string[]).includes('reconstruct'));
  assert.equal(DRILL_KINDS[DRILL_KINDS.length - 1], 'reconstruct');
});

// ---- attacks ----

test('attacks agrees with chess.js for every piece, colour and square pair', () => {
  let checked = 0;
  for (const piece of Object.keys(LETTER) as PieceName[]) {
    for (const side of ['white', 'black'] as const) {
      for (const from of SQUARES) {
        if (piece === 'pawn' && (from[1] === '1' || from[1] === '8')) continue;
        for (const target of SQUARES) {
          if (target === from) continue;
          assert.equal(attacks(piece, side, from, target), referenceAttacks(piece, side, from, target, []), `${side} ${piece} ${from} -> ${target}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 25000);
});

test('attacks: a piece in the way stops sliders, and is itself attacked', () => {
  for (let i = 0; i < 4000; i++) {
    const piece = (['bishop', 'rook', 'queen'] as const)[i % 3];
    const from = SQUARES[(i * 7) % 64];
    const target = SQUARES[(i * 13 + 5) % 64];
    const block = SQUARES[(i * 29 + 3) % 64];
    if (new Set([from, target, block]).size < 3) continue;
    assert.equal(attacks(piece, 'white', from, target, [block]), referenceAttacks(piece, 'white', from, target, [block]), `${piece} ${from} -> ${target} with ${block}`);
  }
  assert.equal(attacks('rook', 'white', 'a1', 'a8', ['a4']), false);
  assert.equal(attacks('rook', 'white', 'a1', 'a4', ['a4']), true);
  assert.equal(attacks('knight', 'white', 'b1', 'c3', ['c3']), true);
  assert.equal(attacks('king', 'white', 'e1', 'e2'), true);
  assert.equal(attacks('king', 'white', 'e1', 'e3'), false);
  assert.equal(attackedSquares('knight', 'white', 'a1').join(), 'b3,c2');
});

test('between', () => {
  assert.deepEqual(between('a1', 'h8'), ['b2', 'c3', 'd4', 'e5', 'f6', 'g7']);
  assert.deepEqual(between('h1', 'a1'), ['g1', 'f1', 'e1', 'd1', 'c1', 'b1']);
  assert.deepEqual(between('a1', 'b2'), []);
  assert.deepEqual(between('a1', 'b3'), []);
  assert.deepEqual(between('e4', 'e4'), []);
});

test('Attacked or not: answers are right, about half are yes, forks and blockers appear', () => {
  let yes = 0, forks = 0, blocked = 0, withBlocker = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const q = makeQuestion('attack');
    assert.equal(q.kind, 'attack');
    assert.deepEqual(q.options.map((o) => o.value), ['yes', 'no']);
    assert.equal(q.entry, undefined);
    const fork = /^(White|Black) (\w+) on ([a-h][1-8])\. Does the \2 attack both ([a-h][1-8]) and ([a-h][1-8])\?$/.exec(q.prompt);
    if (fork) {
      const [, side, piece, from, a, b] = fork;
      assert.equal(new Set([from, a, b]).size, 3, q.prompt);
      const expected = attacks(piece as PieceName, side.toLowerCase() as Colour, from, a) && attacks(piece as PieceName, side.toLowerCase() as Colour, from, b);
      assert.equal(referenceAttacks(piece as PieceName, side.toLowerCase() as Colour, from, a, []) && referenceAttacks(piece as PieceName, side.toLowerCase() as Colour, from, b, []), expected);
      assert.equal(q.answer, expected ? 'yes' : 'no', q.prompt);
      assert.ok(q.explanation.startsWith(expected ? 'Yes' : 'No'), q.explanation);
      assert.deepEqual(q.squares, [from, a, b]);
      if (piece === 'pawn') assert.ok(from[1] !== '1' && from[1] !== '8');
      forks++;
      if (expected) yes++;
      continue;
    }
    const m = /^(White|Black) (\w+) on ([a-h][1-8])((?:, (?:white|black) (?:pawn|knight|bishop|rook|queen) on [a-h][1-8])*)\. Does the \2 attack ([a-h][1-8])\?$/.exec(q.prompt);
    assert.ok(m, q.prompt);
    const [, side, piece, from, rest, target] = m;
    const blockers = [...rest.matchAll(/on ([a-h][1-8])/g)].map((x) => x[1]);
    assert.deepEqual(q.squares, [from, target, ...blockers]);
    assert.equal(new Set(q.squares).size, q.squares.length, `distinct squares: ${q.prompt}`);
    const expected = referenceAttacks(piece as PieceName, side.toLowerCase() as Colour, from, target, blockers);
    assert.equal(q.answer, expected ? 'yes' : 'no', q.prompt);
    assert.ok(q.explanation.startsWith(expected ? 'Yes' : 'No'), q.explanation);
    if (piece === 'pawn') assert.ok(from[1] !== '1' && from[1] !== '8');
    for (const b of rest.matchAll(/pawn on ([a-h][1-8])/g)) assert.ok(b[1][1] !== '1' && b[1][1] !== '8', q.prompt);
    if (expected) yes++;
    if (blockers.length > 0) withBlocker++;
    if (blockers.length > 0 && !expected && q.explanation.includes('in the way')) blocked++;
  }
  assert.ok(yes > N * 0.38 && yes < N * 0.62, `yes = ${yes}`);
  assert.ok(forks > N * 0.3 && forks < N * 0.5, `forks = ${forks}`);
  assert.ok(withBlocker > N * 0.05, `blockers ${withBlocker}`);
  assert.ok(blocked > N * 0.03, `blocked ${blocked}`);
});

// ---- moves needed ----

/** Reference: breadth-first search with the real moves of the piece on an empty board. */
function bfs(piece: Walker, from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let moves = 1; frontier.length > 0; moves++) {
    const next: string[] = [];
    for (const square of frontier) {
      for (const target of SQUARES) {
        if (seen.has(target) || !attacks(piece, 'white', square, target)) continue;
        if (target === to) return moves;
        seen.add(target);
        next.push(target);
      }
    }
    frontier = next;
  }
  return -1;
}

test('movesNeeded agrees with a search for king, rook and bishop (and is -1 for the wrong colour)', () => {
  for (const piece of ['king', 'rook', 'bishop'] as const) {
    let max = 0;
    for (const from of SQUARES) {
      for (const to of SQUARES) {
        assert.equal(movesNeeded(piece, from, to), bfs(piece, from, to), `${piece} ${from} -> ${to}`);
        max = Math.max(max, movesNeeded(piece, from, to));
      }
    }
    assert.equal(max, piece === 'king' ? 7 : 2);
  }
  assert.equal(movesNeeded('bishop', 'c1', 'h6'), 1);
  assert.equal(movesNeeded('bishop', 'c1', 'f6'), 2);
  assert.equal(movesNeeded('bishop', 'c1', 'f5'), -1);
  assert.equal(movesNeeded('rook', 'a1', 'h8'), 2);
  assert.equal(movesNeeded('king', 'a1', 'h8'), 7);
});

test('Moves needed: answers, buttons and explanations fit the piece', () => {
  const seen = { king: 0, rook: 0, bishop: 0, never: 0 };
  for (let i = 0; i < 2000; i++) {
    const q = makeQuestion('distance');
    const m = /^How many moves does a (king|rook|bishop) need from ([a-h][1-8]) to ([a-h][1-8])\?$/.exec(q.prompt);
    assert.ok(m, q.prompt);
    const [, piece, from, to] = m;
    assert.notEqual(from, to);
    assert.deepEqual(q.squares, [from, to]);
    const moves = movesNeeded(piece as Walker, from, to);
    assert.equal(q.answer, moves === -1 ? 'never' : String(moves));
    assert.ok(q.options.some((o) => o.value === q.answer), q.prompt);
    assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length);
    assert.ok(q.explanation.length > 5);
    if (piece !== 'bishop') assert.ok(!q.options.some((o) => o.value === 'never'));
    if (piece === 'king') assert.equal(q.options.length, 7);
    if (piece === 'rook') assert.equal(q.options.length, 2);
    if (piece === 'bishop') assert.equal(q.options.length, 3);
    if (q.answer === 'never') {
      seen.never++;
      assert.ok(q.explanation.includes('colour'), q.explanation);
    }
    seen[piece as Walker]++;
  }
  assert.ok(seen.king > 300 && seen.rook > 300 && seen.bishop > 500, JSON.stringify(seen));
  // about 1 bishop trip in 5 is impossible
  assert.ok(seen.never > seen.bishop * 0.1 && seen.never < seen.bishop * 0.3, JSON.stringify(seen));
});

// ---- count the squares ----

test('squares attacked on an empty board', () => {
  assert.equal(squaresAttackedOnEmptyBoard('knight', 'e4').length, 8);
  assert.equal(squaresAttackedOnEmptyBoard('knight', 'a1').length, 2);
  assert.equal(squaresAttackedOnEmptyBoard('knight', 'b1').length, 3);
  assert.equal(squaresAttackedOnEmptyBoard('knight', 'a4').length, 4);
  assert.equal(squaresAttackedOnEmptyBoard('knight', 'b2').length, 4);
  assert.equal(squaresAttackedOnEmptyBoard('knight', 'c3').length, 8);
  assert.equal(squaresAttackedOnEmptyBoard('bishop', 'a1').length, 7);
  assert.equal(squaresAttackedOnEmptyBoard('bishop', 'd4').length, 13);
  assert.equal(squaresAttackedOnEmptyBoard('bishop', 'e4').length, 13);
  assert.equal(squaresAttackedOnEmptyBoard('bishop', 'b2').length, 9);
  assert.equal(squaresAttackedOnEmptyBoard('king', 'a1').length, 3);
  assert.equal(squaresAttackedOnEmptyBoard('king', 'a4').length, 5);
  assert.equal(squaresAttackedOnEmptyBoard('king', 'e4').length, 8);
  assert.equal(squaresAttackedOnEmptyBoard('queen', 'a1').length, 21);
  assert.equal(squaresAttackedOnEmptyBoard('queen', 'd4').length, 27);
  for (const from of SQUARES) {
    assert.equal(squaresAttackedOnEmptyBoard('queen', from).length, 14 + squaresAttackedOnEmptyBoard('bishop', from).length);
  }
});

test('Count the squares: typed numbers, right answers', () => {
  let between_ = 0, pieces = 0;
  for (let i = 0; i < 2000; i++) {
    const q = makeQuestion('count');
    assert.equal(q.entry, 'number');
    assert.deepEqual(q.options, []);
    assert.match(q.answer, /^[1-9]\d?$/);
    assert.ok(q.explanation.length > 5);
    const line = /^How many squares lie between ([a-h][1-8]) and ([a-h][1-8])\?$/.exec(q.prompt);
    if (line) {
      const [, a, b] = line;
      assert.equal(q.answer, String(between(a, b).length));
      assert.ok(between(a, b).length >= 1, 'the two squares are not neighbours');
      assert.deepEqual(q.squares, [a, b]);
      between_++;
      continue;
    }
    const m = /^On an empty board, how many squares does a (knight|bishop|queen|king) on ([a-h][1-8]) attack\?$/.exec(q.prompt);
    assert.ok(m, q.prompt);
    const [, piece, from] = m;
    const game = new Chess();
    game.clear();
    game.put({ type: LETTER[piece as PieceName], color: 'w' }, from as never);
    const reference = game.moves({ verbose: true, square: from as never }).length;
    if (piece !== 'king') assert.equal(q.answer, String(reference), q.prompt); // legal moves of a lone piece = squares attacked
    else assert.equal(q.answer, String(squaresAttackedOnEmptyBoard('king', from).length));
    pieces++;
  }
  assert.ok(between_ > 400 && between_ < 800, `between ${between_}`);
  assert.ok(pieces > 1200, `pieces ${pieces}`);
});

// ---- rule of the square ----

/**
 * Reference by search (white pawn against a lone black king, nothing else on the board): can the king capture the
 * pawn, even on the queening square, whatever the pawn does? The king may not step next to the pawn's attack, and a
 * blocked pawn simply waits.
 */
function search(pf: number, pr: number, kf: number, kr: number, pawnToMove: boolean): boolean {
  const memo = new Map<string, boolean>();
  const near = (a: number, b: number, c: number, d: number) => Math.max(Math.abs(a - c), Math.abs(b - d)) <= 1;
  const go = (pf: number, pr: number, kf: number, kr: number, pawnTurn: boolean, depth: number): boolean => {
    if (depth <= 0) return false;
    const key = `${pf}${pr}${kf}${kr}${pawnTurn ? 1 : 0}:${depth}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    let result: boolean;
    if (!pawnTurn || pr === 7) {
      // black to move (a pawn on the last rank is a new queen: the king may take it, otherwise it is gone)
      if (near(pf, pr, kf, kr)) result = true;
      else if (pr === 7) result = false;
      else {
        result = false;
        for (const [df, dr] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) {
          const nf = kf + df, nr = kr + dr;
          if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
          if (Math.abs(nf - pf) === 1 && nr === pr + 1) continue; // stepping into the pawn's attack
          if (go(pf, pr, nf, nr, true, depth - 1)) {
            result = true;
            break;
          }
        }
      }
    } else {
      const options: number[] = [];
      if (!(kf === pf && kr === pr + 1)) options.push(pr + 1);
      if (pr === 1 && !(kf === pf && (kr === 2 || kr === 3))) options.push(3);
      result = options.length === 0 ? go(pf, pr, kf, kr, false, depth - 1) : options.every((nr) => go(pf, nr, kf, kr, false, depth - 1));
    }
    memo.set(key, result);
    return result;
  };
  return go(pf, pr, kf, kr, pawnToMove, 30);
}

test('the rule of the square agrees with a search over every pawn and king square', () => {
  let checked = 0, caught = 0;
  for (let pf = 0; pf < 8; pf++) {
    for (let pr = 1; pr <= 6; pr++) {
      for (let kf = 0; kf < 8; kf++) {
        for (let kr = 0; kr < 8; kr++) {
          if (Math.max(Math.abs(kf - pf), Math.abs(kr - pr)) < 2) continue;
          for (const pawnToMove of [true, false]) {
            const pawn = `${'abcdefgh'[pf]}${pr + 1}`;
            const king = `${'abcdefgh'[kf]}${kr + 1}`;
            const expected = search(pf, pr, kf, kr, pawnToMove);
            assert.equal(kingCatchesPawn(pawn, 'white', king, pawnToMove), expected, `pawn ${pawn}, king ${king}, ${pawnToMove ? 'pawn' : 'king'} to move`);
            // the same position with the colours swapped (board turned upside down)
            assert.equal(kingCatchesPawn(mirror(pawn), 'black', mirror(king), pawnToMove), expected);
            checked++;
            if (expected) caught++;
          }
        }
      }
    }
  }
  assert.ok(checked > 4000);
  assert.ok(caught > checked * 0.2 && caught < checked * 0.8, `caught ${caught} of ${checked}`);
  // the textbook cases
  assert.equal(kingCatchesPawn('b5', 'white', 'f6', true), false);
  assert.equal(kingCatchesPawn('b5', 'white', 'f6', false), true);
  assert.equal(kingCatchesPawn('a2', 'white', 'e6', true), true); // the pawn may jump two squares at the start
  assert.equal(kingCatchesPawn('h5', 'white', 'e8', true), true);
  assert.equal(kingCatchesPawn('h5', 'white', 'c8', true), false);
});

// ---- opposition ----

test('opposition: the side that is not to move has it (one file or rank, odd number of squares between)', () => {
  assert.equal(oppositionHolder('e4', 'e6', true), 'black');
  assert.equal(oppositionHolder('e4', 'e6', false), 'white');
  assert.equal(oppositionHolder('c3', 'g3', true), 'black'); // distant, along a rank
  assert.equal(oppositionHolder('e1', 'e7', false), 'white');
  assert.equal(oppositionHolder('e4', 'e7', true), 'none'); // two squares between
  assert.equal(oppositionHolder('e4', 'e5', true), 'none'); // neighbours
  assert.equal(oppositionHolder('e4', 'f6', true), 'none');
  assert.equal(oppositionHolder('c2', 'e4', true), 'none'); // diagonal: not counted here
  assert.equal(oppositionHolder('a1', 'a8', false), 'none');
  // the answer flips with the move
  for (const a of SQUARES) {
    for (const b of SQUARES) {
      const w = oppositionHolder(a, b, true), x = oppositionHolder(a, b, false);
      assert.equal(w === 'none', x === 'none');
      if (w !== 'none') assert.notEqual(w, x);
    }
  }
});

test('Square and opposition: both kinds of question, answers right, readable', () => {
  let squareQs = 0, oppQs = 0, yes = 0, white = 0, black = 0, none = 0;
  for (let i = 0; i < 3000; i++) {
    const q = makeQuestion('endgame');
    assert.equal(q.kind, 'endgame');
    assert.equal(q.entry, undefined);
    assert.ok(q.options.some((o) => o.value === q.answer), q.prompt);
    assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length);
    const sq = /^(White|Black) pawn on ([a-h][1-8]), (white|black) king on ([a-h][1-8]), (white|black) to move\. Does the king catch the pawn\?$/.exec(q.prompt);
    if (sq) {
      const [, side, pawn, kingSide, king, mover] = sq;
      assert.notEqual(side.toLowerCase(), kingSide, q.prompt);
      assert.ok(pawn[1] !== '1' && pawn[1] !== '8');
      assert.deepEqual(q.squares, [pawn, king]);
      const own = side === 'White' ? Number(pawn[1]) : 9 - Number(pawn[1]);
      assert.ok(own >= 2 && own <= 6, q.prompt);
      assert.ok(Math.max(Math.abs('abcdefgh'.indexOf(pawn[0]) - 'abcdefgh'.indexOf(king[0])), Math.abs(Number(pawn[1]) - Number(king[1]))) >= 2, 'the king does not start next to the pawn');
      const pawnToMove = mover === side.toLowerCase();
      const expected = kingCatchesPawn(pawn, side.toLowerCase() as Colour, king, pawnToMove);
      assert.equal(q.answer, expected ? 'yes' : 'no');
      assert.ok(q.explanation.startsWith(expected ? 'Yes' : 'No'), q.explanation);
      assert.ok(q.explanation.includes(pawnToMove ? 'the pawn moves first' : 'the king moves first'));
      squareQs++;
      if (expected) yes++;
      continue;
    }
    const op = /^White king on ([a-h][1-8]), black king on ([a-h][1-8]), (white|black) to move\. Who has the opposition\?$/.exec(q.prompt);
    assert.ok(op, q.prompt);
    const [, w, b, mover] = op;
    assert.deepEqual(q.options.map((o) => o.value), ['white', 'black', 'none']);
    assert.ok(Math.max(Math.abs('abcdefgh'.indexOf(w[0]) - 'abcdefgh'.indexOf(b[0])), Math.abs(Number(w[1]) - Number(b[1]))) >= 2, 'the kings are not neighbours');
    assert.equal(q.answer, oppositionHolder(w, b, mover === 'white'));
    assert.ok(q.explanation.length > 10);
    oppQs++;
    if (q.answer === 'white') white++;
    else if (q.answer === 'black') black++;
    else none++;
  }
  assert.ok(squareQs > 1300 && oppQs > 1300, `${squareQs} / ${oppQs}`);
  assert.ok(yes > squareQs * 0.35 && yes < squareQs * 0.65, `yes ${yes} of ${squareQs}`);
  assert.ok(white > oppQs * 0.2 && black > oppQs * 0.2 && none > oppQs * 0.15, `${white} ${black} ${none}`);
});

// ---- follow the moves ----

test('movesText', () => {
  assert.equal(movesText(['e4']), '1.e4');
  assert.equal(movesText(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']), '1.e4 e5 2.Nf3 Nc6 3.Bb5');
  assert.equal(movesText(['d4', 'd5']), '1.d4 d5');
});

test('a made-up game is legal, has the length asked, never ends in mate, and tracks every piece', () => {
  for (let i = 0; i < 400; i++) {
    const plies = 3 + (i % 6);
    const { sans, game, where, touched } = makeFollowGame(Math.random, plies);
    assert.equal(sans.length, plies);
    const replay = new Chess();
    for (const san of sans) replay.move(san); // throws when a move is illegal
    assert.equal(replay.fen(), game.fen());
    assert.ok(!game.isGameOver());
    assert.ok(touched.length > 0);
    // every piece still alive stands on its square, as the same kind of piece as at the start
    const start = new Chess();
    const alive = Object.keys(where).filter((o) => where[o] !== null);
    assert.equal(alive.length, game.board().flat().filter(Boolean).length, `${sans.join(' ')}`);
    for (const origin of alive) {
      const was = start.get(origin as never)!;
      const now = game.get(where[origin] as never)!;
      assert.ok(now, `${sans.join(' ')}: ${origin} -> ${where[origin]}`);
      assert.equal(now.color, was.color);
      assert.equal(now.type, was.type);
    }
  }
});

test('castling and captures keep the tracking right', () => {
  // build a game by hand and compare with the tracking through the public function's rules
  const rng = (() => {
    let seed = 12345;
    return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  })();
  let castled = 0, captured = 0;
  for (let i = 0; i < 500; i++) {
    const { sans, game, where } = makeFollowGame(rng, 8);
    if (sans.some((s) => s.startsWith('O-O'))) castled++;
    if (sans.some((s) => s.includes('x'))) captured++;
    const alive = Object.keys(where).filter((o) => where[o] !== null);
    assert.equal(alive.length, game.board().flat().filter(Boolean).length);
    for (const origin of alive) {
      assert.equal(game.get(where[origin] as never)?.type, new Chess().get(origin as never)!.type, sans.join(' '));
    }
  }
  assert.ok(captured > 50, 'captures happen');
  assert.ok(castled >= 0);
});

test('followPieces: castling moves the rook too, en passant takes the pawn that is not on the target square', () => {
  const play = (sans: string[]) => {
    const game = new Chess();
    return sans.map((san) => game.move(san));
  };
  const castled = followPieces(play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6', 'd3', 'O-O']));
  assert.equal(castled.where.e1, 'g1');
  assert.equal(castled.where.h1, 'f1');
  assert.equal(castled.where.e8, 'g8');
  assert.equal(castled.where.h8, 'f8');
  assert.equal(castled.where.a1, 'a1');
  assert.equal(castled.where.g1, 'f3');
  assert.ok(castled.touched.includes('f1') && castled.touched.includes('f8'));
  const queenside = followPieces(play(['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'O-O-O']));
  assert.equal(queenside.where.e1, 'c1');
  assert.equal(queenside.where.a1, 'd1');
  const enPassant = followPieces(play(['e4', 'a6', 'e5', 'd5', 'exd6']));
  assert.equal(enPassant.where.d7, null, 'the pawn taken en passant is gone');
  assert.equal(enPassant.where.e2, 'd6');
  const capture = followPieces(play(['e4', 'd5', 'exd5', 'Qxd5']));
  assert.equal(capture.where.e2, null);
  assert.equal(capture.where.d7, null);
  assert.equal(capture.where.d8, 'd5');
});

test('the last move gives check (or not) when asked', () => {
  const matched = { true: 0, false: 0 };
  const N = 150;
  for (let i = 0; i < N; i++) {
    for (const want of [true, false]) {
      const { game, sans } = makeFollowGame(Math.random, 3 + (i % 6), want);
      assert.ok(!sans[sans.length - 1].endsWith('#'));
      if (game.inCheck() === want) matched[String(want) as 'true' | 'false']++;
    }
  }
  assert.ok(matched.true > N * 0.7, `asked for check, got it ${matched.true} of ${N}`);
  assert.ok(matched.false > N * 0.98, `asked for no check, got it ${matched.false} of ${N}`);
});

test('Follow the moves: three kinds of question, all answered by the real position', () => {
  const kinds = { check: 0, what: 0, where: 0 };
  let checkYes = 0, empty = 0, lengths = new Set<number>();
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const q = makeQuestion('follow');
    assert.equal(q.kind, 'follow');
    assert.ok(q.lead && /^1\.\S+( \S+| \d+\.\S+)*$/.test(q.lead), q.lead);
    const sans = q.lead.split(' ').filter((t) => !/^\d+\./.test(t) || t.includes('.')).map((t) => t.replace(/^\d+\./, ''));
    lengths.add(sans.length);
    assert.ok(sans.length >= 3 && sans.length <= 8, q.lead);
    const game = new Chess();
    for (const san of sans) game.move(san);
    assert.ok(q.explanation.length > 3);
    if (q.prompt === 'Is it check?') {
      kinds.check++;
      assert.deepEqual(q.options.map((o) => o.value), ['yes', 'no']);
      assert.equal(q.answer, game.inCheck() ? 'yes' : 'no');
      if (q.answer === 'yes') checkYes++;
      continue;
    }
    const what = /^What is on ([a-h][1-8])\?$/.exec(q.prompt);
    if (what) {
      kinds.what++;
      assert.equal(q.entry, undefined);
      assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length);
      assert.equal(q.options.length, 7);
      const piece = game.get(what[1] as never);
      assert.equal(q.answer, piece ? WORD[piece.type] : 'empty');
      assert.ok(q.options.some((o) => o.value === q.answer));
      assert.deepEqual(q.squares, [what[1]]);
      if (!piece) empty++;
      continue;
    }
    const where = /^Where is the (white|black) (pawn|knight|bishop|rook|queen|king) that started on ([a-h][1-8])\?$/.exec(q.prompt);
    assert.ok(where, q.prompt);
    kinds.where++;
    assert.equal(q.entry, 'square');
    assert.deepEqual(q.options, []);
    assert.match(q.answer, /^[a-h][1-8]$/);
    const [, colour, name, origin] = where;
    const there = game.get(q.answer as never);
    assert.ok(there, `${q.lead}: ${q.prompt} -> ${q.answer}`);
    assert.equal(WORD[there.type], name);
    assert.equal(there.color === 'w' ? 'white' : 'black', colour);
    assert.notEqual(q.answer, origin, 'the piece has moved');
  }
  assert.ok(kinds.check > N * 0.14 && kinds.check < N * 0.26, JSON.stringify(kinds));
  assert.ok(kinds.what > N * 0.28 && kinds.where > N * 0.35, JSON.stringify(kinds));
  assert.ok(checkYes > kinds.check * 0.25 && checkYes < kinds.check * 0.65, `check yes ${checkYes} of ${kinds.check}`);
  assert.ok(empty > kinds.what * 0.15 && empty < kinds.what * 0.7, `empty ${empty} of ${kinds.what}`);
  assert.deepEqual([...lengths].sort(), [3, 4, 5, 6, 7, 8]);
});

test('every question kind: the same question never comes twice in a row', () => {
  for (const kind of QUESTION_KINDS) {
    let previous = makeQuestion(kind);
    for (let i = 0; i < 200; i++) {
      const next = makeQuestion(kind, Math.random, previous);
      assert.notEqual(`${next.lead ?? ''}|${next.prompt}`, `${previous.lead ?? ''}|${previous.prompt}`, kind);
      previous = next;
    }
  }
});

test('every question kind: pick-an-answer questions have their answer among the buttons, typed ones do not', () => {
  for (const kind of QUESTION_KINDS) {
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion(kind);
      assert.equal(q.kind, kind);
      assert.ok(q.prompt.length > 0 && q.explanation.length > 0);
      if (q.entry) {
        assert.deepEqual(q.options, [], `${kind}: typed questions have no buttons`);
        assert.match(q.answer, q.entry === 'number' ? /^\d+$/ : /^[a-h][1-8]$/);
      } else {
        assert.ok(q.options.some((o) => o.value === q.answer), `${kind}: ${q.prompt} -> ${q.answer}`);
        assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length);
        assert.equal(new Set(q.options.map((o) => o.value)).size, q.options.length);
      }
    }
  }
});
