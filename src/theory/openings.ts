// The opening theory lessons. Every line is written as moves, and the diagrams and practice positions are
// computed from them with chess.js, so a typo in a move fails at once instead of showing a wrong board.
// A lesson also needs an entry in server/seo.ts (a test checks that).

import { Chess } from 'chess.js';
import type { Diagram, Lesson, TheoryCollection } from './types.ts';

export const OPENINGS_BASE = '/openings';

/** The position after a line of moves, e.g. after('1. e4 e5 2. Nf3'). Throws if a move is illegal. */
export function after(pgn: string): string {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.fen();
}

/** A diagram of the position after a line of moves. */
function board(pgn: string, caption: string, arrows?: Array<[string, string]>): Diagram {
  return { fen: after(pgn), caption, arrows };
}

/** The "practise this" button: opens the line in Board Analysis, ready to step through. */
function practise(pgn: string, label: string): Lesson['practice'] {
  return { fen: after(pgn), pgn, label };
}

export const OPENING_LESSONS: Lesson[] = [
  {
    slug: 'opening-principles',
    title: 'Opening Principles Every Player Should Know',
    summary: 'Control the centre, develop your pieces, castle early and do not rush your queen: the ideas behind every opening.',
    kind: 'Principles',
    intro: [
      'You do not need to memorise long lines to play a good opening. A handful of principles tell you what to do in almost every position of the first ten moves, and they also explain why the famous openings look the way they do.',
    ],
    sections: [
      {
        heading: 'Fight for the centre',
        paragraphs: [
          'The four squares e4, d4, e5 and d5 are the centre. Pieces placed there reach both wings quickly, so a pawn on e4 or d4 on the first move is the most natural start. You can also control the centre from a distance with pieces, as many modern openings do.',
        ],
      },
      {
        heading: 'Develop your pieces',
        paragraphs: [
          'Bring out the knights and bishops, usually the knights first, and place them on squares where they point at the centre. Every move in the opening should add a piece to the game, or make room for one.',
        ],
        diagram: board(
          '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O',
          'Both sides have developed their knights and bishops, castled, and kept a pawn in the centre.',
        ),
      },
      {
        heading: 'Castle early',
        paragraphs: [
          'Castling puts your king behind a wall of pawns and brings a rook towards the centre in one move. A king left in the middle is an easy target as soon as the files open.',
        ],
      },
      {
        heading: 'Do not bring the queen out too early',
        paragraphs: [
          'The queen is your most valuable piece, so every piece that attacks her gains a move. After 1.e4 e5 2.Qh5 Nc6 3.Bc4 g6 4.Qf3 Nf6, Black has developed with tempo while White has only moved the queen around.',
        ],
        diagram: board(
          '1. e4 e5 2. Qh5 Nc6 3. Bc4 g6 4. Qf3 Nf6',
          'Black is ahead in development. The early queen move has cost White time.',
        ),
      },
      {
        heading: 'A short checklist',
        bullets: [
          'Do not move the same piece twice in the opening without a reason.',
          'Do not make many pawn moves on the wing while your pieces are still at home.',
          'Before every move, ask what your opponent\'s last move threatens.',
          'Connect your rooks: when the minor pieces are out and you have castled, the rooks see each other.',
        ],
      },
    ],
    practice: practise(
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O',
      'Step through a well-developed opening in Board Analysis',
    ),
    related: ['italian-game', 'queens-gambit'],
  },
  {
    slug: 'italian-game',
    title: 'The Italian Game: Quick Development and Attack',
    summary: 'Develop with 1.e4 e5 2.Nf3 Nc6 3.Bc4, aim at f7 and choose between a calm Giuoco Piano and sharper tries.',
    kind: 'Opening',
    intro: [
      'The Italian Game is one of the oldest openings and a good first one to learn. White puts the bishop on its most active square, eyes the weak f7 pawn and develops with the principles of the opening in mind.',
    ],
    sections: [
      {
        heading: 'The first moves',
        paragraphs: [
          'After 1.e4 e5 2.Nf3 Nc6 3.Bc4, the bishop on c4 attacks f7, the square only the king protects at the start. Black usually replies 3...Bc5 (the Giuoco Piano, the "quiet game") or 3...Nf6 (the Two Knights Defence).',
        ],
        diagram: board('1. e4 e5 2. Nf3 Nc6 3. Bc4', 'The Italian Game. The bishop on c4 eyes the f7 pawn.', [['c4', 'f7']]),
      },
      {
        heading: 'Giuoco Piano: a slow fight for the centre',
        paragraphs: [
          'The modern way is 4.c3 and 5.d3. White prepares d4 or a slow manoeuvre with Nbd2 and a knight jump to the kingside, and keeps a flexible position. Both sides castle and the game is decided in the middlegame.',
        ],
        diagram: board(
          '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O',
          'A typical Giuoco Piano. White has a solid centre and plenty of ways to continue.',
        ),
      },
      {
        heading: 'Two Knights: the sharp line',
        paragraphs: [
          'After 3...Nf6 4.Ng5 White attacks f7 a second time. Black\'s best answer is 4...d5 5.exd5 and now 5...Na5, which saves the pawn on f7 and drives the bishop away. The tempting 5...Nxd5 allows 6.Nxf7, the Fried Liver Attack, where Black is in real danger.',
        ],
        diagram: board(
          '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5',
          'The main line of the Two Knights Defence. Black is a pawn down for now, but the bishop will be driven away and Black gets active play.',
          [['a5', 'c4']],
        ),
      },
      {
        heading: 'Ideas to remember',
        bullets: [
          'White\'s plan: castle, build the centre with c3 and d4 or d3, and bring the pieces to the kingside.',
          'Black\'s plan: castle, play ...d6 and ...a6 or ...h6, and be ready for ...d5 when it is safe.',
          'Watch f7 (and f2 for White). Many beginner traps start on the f-file.',
        ],
      },
    ],
    practice: practise(
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a6 7. Bb3 Ba7 8. Nbd2 O-O',
      'Step through the Giuoco Piano in Board Analysis',
    ),
    related: ['ruy-lopez', 'opening-principles'],
  },
  {
    slug: 'ruy-lopez',
    title: 'The Ruy Lopez: The Classic Spanish Opening',
    summary: 'Pin the knight with 3.Bb5, keep long-term pressure on e5 and learn the Closed, Berlin and Exchange variations.',
    kind: 'Opening',
    intro: [
      'The Ruy Lopez, also called the Spanish Game, has been a top-level weapon for more than a century. White does not threaten anything at once; the pressure on the knight that defends e5 builds slowly and is felt for the whole game.',
    ],
    sections: [
      {
        heading: 'The first moves',
        paragraphs: [
          'After 1.e4 e5 2.Nf3 Nc6 3.Bb5, the bishop attacks the knight that protects the e5 pawn. It does not win the e5 pawn by force, but it takes away a defender and makes Black\'s life harder.',
        ],
        diagram: board('1. e4 e5 2. Nf3 Nc6 3. Bb5', 'The Ruy Lopez. The bishop pins the defender of the e5 pawn.', [['b5', 'c6']]),
      },
      {
        heading: 'The Closed Ruy Lopez',
        paragraphs: [
          'The main line goes 3...a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3. White builds a strong centre with c3 and d4, Black keeps a solid position and has counter-chances on the queenside.',
        ],
        diagram: board(
          '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3',
          'The Closed Ruy Lopez. White plans d4, Black plans ...Na5 and ...c5.',
        ),
      },
      {
        heading: 'The Berlin Defence: an early endgame',
        paragraphs: [
          'With 3...Nf6 Black develops at once. After 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 the queens come off. Black loses the right to castle but has the bishop pair and a very solid position, and this endgame is hard to beat.',
        ],
        diagram: board(
          '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8',
          'The Berlin endgame. White has the better pawn structure, Black has the two bishops.',
        ),
      },
      {
        heading: 'Ideas to remember',
        bullets: [
          'White often plays Re1, c3 and d4 to open the centre when the moment is right.',
          'Black\'s ...a6 and ...b5 gain space and drive the bishop to b3.',
          'Exchange Variation (4.Bxc6): White damages the pawn structure and plays for an endgame with a healthy kingside majority.',
        ],
      },
    ],
    practice: practise(
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3',
      'Step through the Closed Ruy Lopez in Board Analysis',
    ),
    related: ['italian-game', 'opening-principles'],
  },
  {
    slug: 'sicilian-defense',
    title: 'The Sicilian Defence: Fight for the Win as Black',
    summary: 'Answer 1.e4 with 1...c5, trade a wing pawn for a central one and learn the Najdorf and Dragon set-ups.',
    kind: 'Defence',
    intro: [
      'The Sicilian Defence is one of the most popular answers to 1.e4. Black does not copy White\'s central pawn but attacks the d4 square from the side, which leads to unbalanced positions where both sides have a real chance to win.',
    ],
    sections: [
      {
        heading: 'The idea behind 1...c5',
        paragraphs: [
          'Black\'s c-pawn fights for d4. If White opens the centre with d4 and trades it, Black has given a wing pawn for a central pawn and gets a half-open c-file. White usually has more space, Black gets counterplay on the queenside.',
        ],
        diagram: board('1. e4 c5', 'The Sicilian Defence. The pawn on c5 controls d4.', [['c5', 'd4']]),
      },
      {
        heading: 'The Open Sicilian and the Najdorf',
        paragraphs: [
          'After 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 we reach the Najdorf, a favourite of many world champions. The little move ...a6 stops a knight or a bishop jumping to b5 and prepares ...e5 or ...b5.',
        ],
        diagram: board(
          '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6',
          'The Najdorf Variation. Black controls b5 and keeps many ways to build a centre.',
        ),
      },
      {
        heading: 'The Dragon',
        paragraphs: [
          'With 5...g6 Black puts the bishop on g7 on the long diagonal, like the body of a dragon. White usually answers with the Yugoslav Attack: 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.Bc4. White attacks on the kingside, Black on the c-file, and the game is a race.',
        ],
        diagram: board(
          '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4',
          'The Dragon, Yugoslav Attack. Both kings are about to be attacked.',
        ),
      },
      {
        heading: 'If White avoids the open lines',
        bullets: [
          'The Alapin, 2.c3, prepares d4 with a pawn centre. Black can answer with 2...d5 or 2...Nf6.',
          'The Closed Sicilian, 2.Nc3, followed by g3 and Bg2, avoids early theory.',
          'In every Sicilian, remember that Black\'s plan is counterplay, so do not trade off your active pieces without a reason.',
        ],
      },
    ],
    practice: practise(
      '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6',
      'Step through the Najdorf in Board Analysis',
    ),
    related: ['french-defense', 'caro-kann-defense'],
  },
  {
    slug: 'french-defense',
    title: 'The French Defence: A Solid Wall With Counterplay',
    summary: 'Meet 1.e4 with 1...e6 and 2...d5: a sturdy pawn chain, a tricky light-squared bishop and a plan with ...c5.',
    kind: 'Defence',
    intro: [
      'The French Defence, 1.e4 e6, prepares ...d5 so that the centre is challenged at once. The price is a bishop on c8 that is shut in by its own pawns, and the reward is a solid position with a clear plan.',
    ],
    sections: [
      {
        heading: 'The basic structure',
        paragraphs: [
          'After 1.e4 e6 2.d4 d5, White can advance with 3.e5, defend with 3.Nc3 or 3.Nd2, or trade on d5. Black\'s main counter is the pawn break ...c5, which attacks the base of White\'s pawn chain on d4.',
        ],
        diagram: board('1. e4 e6 2. d4 d5', 'The French Defence. Black challenges the centre at once.', [['d5', 'e4']]),
      },
      {
        heading: 'The Winawer: a sharp fight',
        paragraphs: [
          'After 3.Nc3 Bb4 Black pins the knight. The typical line goes 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Ne7. White has the two bishops and a space advantage, but the doubled pawns on the c-file are weak, and Black attacks them.',
        ],
        diagram: board(
          '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7',
          'The Winawer. White has the bishop pair, Black targets the weak pawns on c3 and d4.',
        ),
      },
      {
        heading: 'The Advance: Black attacks the chain',
        paragraphs: [
          'In the Advance Variation, 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6, Black puts pressure on d4 with the c-pawn and the knight, while the queen eyes b2. White gets space, Black gets a target. Later Black often frees the position with ...f6.',
        ],
        diagram: board(
          '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6',
          'The Advance Variation. The d4 pawn is under pressure from the c-pawn and the knight, and the queen eyes b2.',
          [['c5', 'd4'], ['c6', 'd4'], ['b6', 'b2']],
        ),
      },
      {
        heading: 'Ideas to remember',
        bullets: [
          'Black\'s bad bishop on c8: try to trade it or free it with ...b6 and ...Ba6, or ...Bd7 and ...Bb5.',
          'The pawn breaks ...c5 and ...f6 are Black\'s two ways to fight the pawn chain.',
          'White\'s plan is usually a kingside attack, supported by the space that e5 gives.',
        ],
      },
    ],
    practice: practise(
      '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7',
      'Step through the Winawer in Board Analysis',
    ),
    related: ['caro-kann-defense', 'sicilian-defense'],
  },
  {
    slug: 'caro-kann-defense',
    title: 'The Caro-Kann Defence: Solid and Reliable',
    summary: 'Play 1.e4 c6 and 2...d5 to get a sound pawn structure and a bishop that is free to develop before ...e6.',
    kind: 'Defence',
    intro: [
      'The Caro-Kann looks like the French, but with one important difference: Black plays ...c6 instead of ...e6, so the bishop on c8 is not locked in. It is a favourite of players who want a healthy structure and are not afraid of a long game.',
    ],
    sections: [
      {
        heading: 'The first moves',
        paragraphs: [
          'After 1.e4 c6 2.d4 d5 the pawn on c6 supports d5. Black will trade or hold the centre and then develop the light-squared bishop outside the pawn chain, before closing it in with ...e6.',
        ],
        diagram: board('1. e4 c6 2. d4 d5', 'The Caro-Kann. The c6 pawn supports the centre and leaves the c8 bishop free.', [['c6', 'd5']]),
      },
      {
        heading: 'The Classical Variation',
        paragraphs: [
          'The main line is 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3. Black\'s bishop has been developed and then traded for White\'s, and Black is left with a solid, compact pawn structure.',
        ],
        diagram: board(
          '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3',
          'The Classical Caro-Kann. Black will play ...e6 and ...Ngf6 and has a very healthy structure.',
        ),
      },
      {
        heading: 'The Advance Variation',
        paragraphs: [
          'After 3.e5 Bf5 Black develops the bishop before playing ...e6. Then 4.Nf3 e6 5.Be2 c5 hits the base of the pawn chain. White has more space, but Black\'s pieces are active and the structure is sound.',
        ],
        diagram: board(
          '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5',
          'The Advance Variation. The light-squared bishop is outside the chain, and ...c5 attacks d4.',
          [['c5', 'd4']],
        ),
      },
      {
        heading: 'Ideas to remember',
        bullets: [
          'Develop the c8 bishop first, then close the pawn chain with ...e6.',
          'Black has a good endgame structure, so trading queens is rarely a problem.',
          'Be ready for Black\'s typical break ...c5, and watch for ...Qb6 in the Advance Variation.',
        ],
      },
    ],
    practice: practise(
      '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3',
      'Step through the Classical Caro-Kann in Board Analysis',
    ),
    related: ['french-defense', 'sicilian-defense'],
  },
  {
    slug: 'queens-gambit',
    title: "The Queen's Gambit: Classic Play With 1.d4",
    summary: 'Offer a pawn with 1.d4 d5 2.c4 to win control of the centre, and learn how Black accepts or declines.',
    kind: 'Opening',
    intro: [
      "The Queen's Gambit is the most famous opening that starts with 1.d4. It is not a true gambit: if Black takes the pawn, White can win it back, and in return gets a strong pawn centre and fast development.",
    ],
    sections: [
      {
        heading: 'The first moves',
        paragraphs: [
          'After 1.d4 d5 2.c4 White attacks the d5 pawn with a wing pawn. Black can accept it, decline it with ...e6 or ...c6, or counter in a different way.',
        ],
        diagram: board('1. d4 d5 2. c4', "The Queen's Gambit. The c4 pawn attacks d5.", [['c4', 'd5']]),
      },
      {
        heading: "Queen's Gambit Declined",
        paragraphs: [
          'The classical reply is 2...e6. After 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7, Black has a solid pawn chain and White has more space. The weak point is the c8 bishop, which needs a plan, and Black usually frees the position with ...c5 or ...dxc4 and ...b6.',
        ],
        diagram: board(
          '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7',
          "The Queen's Gambit Declined. Black has a sturdy position and waits for the chance to free it.",
        ),
      },
      {
        heading: "Queen's Gambit Accepted",
        paragraphs: [
          "If Black takes the pawn, 2...dxc4, White should not try to hold it by force. After 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.O-O a6 White has won the pawn back and has a lead in development, while Black has a free game and challenges the centre with ...c5.",
        ],
        diagram: board(
          '1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6',
          "The Queen's Gambit Accepted. White's bishop is active, Black has counterplay with ...c5.",
        ),
      },
      {
        heading: 'Ideas to remember',
        bullets: [
          'If Black takes on c4, White regains the pawn with a quick e3 and Bxc4. Do not rush to defend it.',
          'The Slav, 2...c6, is another solid answer. It keeps the c8 bishop free, like the Caro-Kann does against 1.e4.',
          'White\'s plan is a central break with e4 once the pieces are developed.',
        ],
      },
    ],
    practice: practise(
      '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7',
      "Step through the Queen's Gambit Declined in Board Analysis",
    ),
    related: ['opening-principles', 'italian-game'],
  },
];

export function openingBySlug(slug: string): Lesson | undefined {
  return OPENING_LESSONS.find((lesson) => lesson.slug === slug);
}

export function openingPath(slug: string): string {
  return `${OPENINGS_BASE}/${slug}`;
}

/** The lesson shown at an address such as "/openings/italian-game" (undefined for the index and unknown paths). */
export function openingForPath(pathname: string): Lesson | undefined {
  const clean = pathname.replace(/\/+$/, '');
  if (!clean.startsWith(`${OPENINGS_BASE}/`)) return undefined;
  return openingBySlug(clean.slice(OPENINGS_BASE.length + 1));
}

export const OPENINGS: TheoryCollection = {
  base: OPENINGS_BASE,
  name: 'Opening theory',
  allLabel: 'All opening lessons',
  lessons: OPENING_LESSONS,
  bySlug: openingBySlug,
  forPath: openingForPath,
  pathFor: openingPath,
  index: {
    title: 'Chess Opening Theory and Lessons',
    heading: 'Chess opening theory',
    intro:
      'Short lessons on the openings and ideas every player should know. Each one has diagrams, the plan in plain words and a button that opens the line in Board Analysis, so you can step through the moves and check them with the engine.',
  },
  practiceText: 'Openings stick when you play them. Open the line in Board Analysis, step through the moves and ask the engine what it thinks.',
  woodpecker: false,
};
