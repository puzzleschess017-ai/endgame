// The endgame theory lessons. Every position was checked against the Lichess endgame tablebase, so the
// result written next to a diagram is the true result. Edit the text here; the pages, the index and the
// "practise this" buttons are built from it. A lesson also needs an entry in server/seo.ts (a test checks that).

export interface Diagram {
  fen: string;
  caption: string;
  /** Arrows drawn on the board, as [from, to] squares. */
  arrows?: Array<[string, string]>;
}

export interface Section {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  diagram?: Diagram;
}

export interface Lesson {
  slug: string;
  /** Page heading and link text. */
  title: string;
  /** One or two sentences for the index card. */
  summary: string;
  /** What the lesson is about: a result to know, or a technique to carry out. */
  kind: 'Win' | 'Draw' | 'Technique';
  intro: string[];
  sections: Section[];
  /** The position the "practise this" button opens in Board Analysis. */
  practice: { fen: string; label: string };
  /** Slugs of lessons to read next. */
  related: string[];
}

export const THEORY_BASE = '/endgames';

export const LESSONS: Lesson[] = [
  {
    slug: 'king-and-pawn-opposition',
    title: 'Opposition and Key Squares in Pawn Endings',
    summary: 'Why one tempo decides pawn endgames: the opposition, key squares and the same position won or drawn.',
    kind: 'Technique',
    intro: [
      'Almost every pawn ending comes down to one question: can the pawn reach the eighth rank? The kings decide it, and their main tool is the opposition.',
    ],
    sections: [
      {
        heading: 'What is the opposition?',
        paragraphs: [
          'Two kings are in opposition when they stand on the same file (or rank) with exactly one empty square between them. The player who has to move must step aside and give up ground, so the side that does not have the move has the opposition.',
          'In these endings the right to move is often a disadvantage. That is why the same position can be a win with one side to move and a draw with the other.',
        ],
      },
      {
        heading: 'Key squares',
        paragraphs: [
          'A key square is a square that wins the game for the attacker as soon as the king stands on it, whatever the defender does. For a pawn on its second, third or fourth rank, the key squares are the three squares two ranks in front of it. With a white pawn on d4 they are c6, d6 and e6.',
          'So the attacker tries to reach a key square, and the defender tries to stop him. The rook pawn (the a- and h-file) is the exception: the defender can often hold a draw by reaching the corner.',
        ],
      },
      {
        heading: 'Black to move: White wins',
        paragraphs: [
          'White has the opposition, because it is Black who must move. Whatever he plays, White steps onto a key square: after 1...Ke7 comes 2.Kc6, after 1...Kc7 comes 2.Ke6. From there the pawn walks to the eighth rank.',
        ],
        diagram: {
          fen: '8/3k4/8/3K4/3P4/8/8/8 b - - 0 1',
          caption: 'Black to move. Every black move allows White to reach c6, d6 or e6, and White wins.',
        },
      },
      {
        heading: 'White to move: a draw',
        paragraphs: [
          'Now it is White who has to give way, and the result changes. After 1.Kc5 Black replies 1...Kc7, taking the opposition again, and the white king can never get past. The pawn alone cannot make progress, so the game is drawn.',
        ],
        diagram: {
          fen: '8/3k4/8/3K4/3P4/8/8/8 w - - 0 1',
          caption: 'The same position with White to move is only a draw.',
        },
      },
      {
        heading: 'Common mistakes',
        bullets: [
          'Pushing the pawn too early. The pawn can only block your own king; bring the king up first.',
          'Counting moves instead of looking at who is to move. Ask "who has the opposition?" before every king move.',
          'Forgetting stalemate when the pawn reaches the seventh rank with the king in front of it.',
        ],
      },
    ],
    practice: { fen: '8/3k4/8/3K4/3P4/8/8/8 b - - 0 1', label: 'Check the opposition position in Board Analysis' },
    related: ['wrong-colored-bishop', 'lucena-position'],
  },
  {
    slug: 'king-and-rook-vs-king',
    title: 'King and Rook vs King: The Box Method',
    summary: 'Checkmate with a rook in at most 16 moves: cut the king off, shrink the box and mate on the edge.',
    kind: 'Technique',
    intro: [
      'A king and rook can always checkmate a lone king, as long as you do not stalemate it and do not leave the rook where it can be captured. The standard method has four steps and needs at most 16 moves, even against the best defence.',
    ],
    sections: [
      {
        heading: 'The method, step by step',
        bullets: [
          'Cut the king off. Place the rook on a rank or file far from the enemy king, so it cannot cross that line. The king is now confined to a part of the board.',
          'Bring your own king up, close to the enemy king.',
          'When the kings stand in opposition, with one square between them, check with the rook from a distance. The black king must step back towards the edge.',
          'Repeat, so the box gets smaller each time, until the black king is on the edge of the board and the rook gives mate.',
        ],
      },
      {
        heading: 'Step one: cut the king off',
        paragraphs: [
          'With the black king in the middle of the board, 1.Ra4 stops it from crossing the fourth rank. It can no longer go down, and it will be driven to the top edge. Keep the rook far enough away that the king can never attack it.',
        ],
        diagram: {
          fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
          caption: 'White to move. 1.Ra4 confines the black king to the top half of the board.',
          arrows: [['a1', 'a4']],
        },
      },
      {
        heading: 'The last move: mate on the edge',
        paragraphs: [
          'At the end the black king stands on the edge, the white king covers the squares in front of it, and the rook gives check along the edge. Here the king on g6 takes away g7 and h7, so the rook mates on the back rank. The same pattern works on every edge of the board.',
        ],
        diagram: {
          fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1',
          caption: 'White to move. 1.Ra8 is checkmate.',
          arrows: [['a1', 'a8']],
        },
      },
      {
        heading: 'Watch out for',
        bullets: [
          'Never put the rook next to the enemy king unless your own king protects it. Check from far away.',
          'Before every move, make sure the black king still has a legal move. If it has none and it is not in check, the game is a stalemate.',
          'Do not hurry. A quiet move that keeps the box small is better than a check that lets the king out.',
        ],
      },
    ],
    practice: { fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', label: 'Check the rook mate in Board Analysis' },
    related: ['king-and-queen-vs-king', 'lucena-position'],
  },
  {
    slug: 'king-and-queen-vs-king',
    title: 'King and Queen vs King: Mate Without Stalemate',
    summary: 'Mate in at most 10 moves with a queen, and the stalemate trap that costs half a point.',
    kind: 'Technique',
    intro: [
      'A queen and king win faster than a rook and king, in at most 10 moves. The danger is the opposite one: the queen is so strong that it is easy to take away every square and give a stalemate by accident.',
    ],
    sections: [
      {
        heading: 'The method',
        bullets: [
          'Use the queen to confine the king. Place it a knight\'s move away from the enemy king, not next to it, so it cannot be captured and the king has very little room.',
          'Make the box smaller with each queen move, always leaving the black king at least one legal move.',
          'Bring your own king up. The queen alone cannot mate; she needs her king to protect her.',
          'Give mate on the edge, with the queen next to the king and protected by the white king.',
        ],
      },
      {
        heading: 'The last move',
        paragraphs: [
          'The black king is in the corner and the white king stands on g6. The queen goes to g7 with check. The king protects her, so she cannot be captured, and every flight square is covered.',
        ],
        diagram: {
          fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
          caption: 'White to move. 1.Qg7 is checkmate.',
          arrows: [['f7', 'g7']],
        },
      },
      {
        heading: 'The stalemate trap',
        paragraphs: [
          'Now look at the same position with Black to move. The black king is not in check and has no legal move: g8, g7 and h7 are all covered. That is a stalemate, and the game is a draw.',
          'Before every queen move, count the legal replies of the black king. If the answer would be zero and there is no check, choose another move.',
        ],
        diagram: {
          fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
          caption: 'The same pieces with Black to move: stalemate, a draw.',
        },
      },
    ],
    practice: { fen: '8/8/8/4k3/8/8/8/Q3K3 w - - 0 1', label: 'Check the queen mate in Board Analysis' },
    related: ['king-and-rook-vs-king', 'king-and-pawn-opposition'],
  },
  {
    slug: 'lucena-position',
    title: 'The Lucena Position: How to Win a Rook Endgame',
    summary: 'The key winning position in rook endgames, and the "bridge" that takes your king out of the checks.',
    kind: 'Win',
    intro: [
      'The Lucena position is the most important winning position in rook endgames. It is how one extra pawn becomes a win, and it is named after the Spanish writer Luis Ramírez de Lucena, who published it in 1497.',
    ],
    sections: [
      {
        heading: 'What it looks like',
        bullets: [
          'The pawn is on the seventh rank, and the attacker\'s king stands on the queening square in front of it.',
          'The defending king is cut off from the pawn by at least one file. Here the white rook on e1 keeps the black king on the f-file or beyond.',
          'Both sides have a rook, and the defender\'s rook is ready to give checks.',
          'It works with any pawn except a rook pawn (a or h), where the result is usually only a draw.',
        ],
      },
      {
        heading: 'The problem',
        paragraphs: [
          'White\'s king cannot leave d8 because Black\'s rook would check it again and again. White needs a shelter from those checks, and the rook will provide one. The idea is called building a bridge.',
        ],
        diagram: {
          fen: '3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 1',
          caption: 'White to move and win. First 1.Rf1+, to push the black king away.',
          arrows: [['e1', 'f1']],
        },
      },
      {
        heading: 'Building the bridge',
        paragraphs: [
          'After 1.Rf1+ Kg7 White plays 2.Rf4. The rook now stands on the fourth rank, ready to block a check from the side. If Black plays 1...Ke6 instead, 2.Ke8 also wins.',
        ],
        diagram: {
          fen: '3K4/3P2k1/8/8/5R2/8/r7/8 b - - 3 2',
          caption: 'The bridge: the rook on the fourth rank. Black to move cannot stop the plan.',
          arrows: [['f1', 'f4']],
        },
      },
      {
        heading: 'Walking out and blocking',
        paragraphs: [
          'Black checks from behind and from the side, and the white king steps away from each check: 2...Ra1 3.Kc7 Rc1+ 4.Kb6 Rb1+ 5.Kc6 Rc1+ 6.Kb5 Rb1+. Now the rook comes across with 7.Rb4, and the king is protected.',
          'If Black takes the rook with 7...Rxb4+, then 8.Kxb4 leaves White with a pawn on the seventh rank and Black\'s king too far away, so the pawn promotes.',
        ],
        diagram: {
          fen: '8/3P2k1/8/1K6/5R2/8/8/1r6 w - - 12 7',
          caption: 'After 6...Rb1+ White plays 7.Rb4, and the checks are over.',
          arrows: [['f4', 'b4']],
        },
      },
    ],
    practice: { fen: '3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 1', label: 'Check the Lucena position in Board Analysis' },
    related: ['philidor-position', 'king-and-rook-vs-king'],
  },
  {
    slug: 'philidor-position',
    title: 'The Philidor Position: Draw a Rook Endgame',
    summary: 'The standard defence with a rook against a pawn: keep the rook on the sixth rank, then check from behind.',
    kind: 'Draw',
    intro: [
      'The Philidor position is the Lucena\'s opposite: the standard way to hold a draw when you are a pawn down in a rook endgame. It is named after the 18th-century master François-André Danican Philidor.',
    ],
    sections: [
      {
        heading: 'The defender\'s setup',
        bullets: [
          'The defending king stays in front of the pawn, on the back rank.',
          'The defending rook stands on the sixth rank (counted from the attacker\'s side). It stops the attacking king from stepping up to that rank.',
          'The attacker cannot make progress with the king, and pushing the pawn changes nothing.',
        ],
        diagram: {
          fen: '4k3/8/r7/3KP3/8/8/7R/8 w - - 0 1',
          caption: 'White to move. The rook on a6 keeps the white king off the sixth rank, and the position is a draw.',
          arrows: [['a6', 'e6']],
        },
      },
      {
        heading: 'When the pawn advances',
        paragraphs: [
          'The moment the pawn moves to the sixth rank, the rook has done its job on that rank, so it drops to the back rank and checks from behind. The white king has no shelter from these checks, because the pawn and the black king are in the way of his own rook.',
        ],
        diagram: {
          fen: '4k3/8/4P3/3K4/8/8/7R/r7 w - - 0 2',
          caption: 'After 1.e6 Ra1 the rook checks from behind. White cannot make progress, and the game is a draw.',
          arrows: [['a6', 'a1']],
        },
      },
      {
        heading: 'Common mistakes',
        bullets: [
          'Moving the rook off the sixth rank too early. Then the white king walks up to the sixth rank and the position is lost.',
          'Forgetting to go behind the pawn once it reaches the sixth rank. The checks from behind are the whole defence.',
          'Letting the black king leave the pawn\'s file. The king must stay near the queening square.',
        ],
      },
    ],
    practice: { fen: '4k3/8/r7/3KP3/8/8/7R/8 w - - 0 1', label: 'Check the Philidor position in Board Analysis' },
    related: ['lucena-position', 'king-and-pawn-opposition'],
  },
  {
    slug: 'wrong-colored-bishop',
    title: 'Wrong-Colored Bishop: A Draw With an Extra Piece',
    summary: 'Bishop and rook pawn against a lone king: why the colour of the bishop decides between a win and a draw.',
    kind: 'Draw',
    intro: [
      'A bishop and a rook pawn (an a- or h-pawn) should win against a lone king, but not always. If the bishop is the wrong colour, the defending king hides in the corner, and the game is a draw.',
    ],
    sections: [
      {
        heading: 'Why the colour matters',
        paragraphs: [
          'A rook pawn on the h-file always promotes on h8, and h8 is a dark square. A bishop that moves on dark squares can control h8 and drive the king out of the corner. A light-squared bishop never can, so it is the "wrong" bishop for this pawn. For an a-pawn it is the other way round, because a8 is a light square.',
        ],
      },
      {
        heading: 'The draw',
        paragraphs: [
          'Here White has a light-squared bishop on f1. Black\'s king goes to h8 or g8 and stays there. White cannot force it out of the corner, because the bishop cannot attack h8, and if the pawn reaches h7 White has to take care not to give a stalemate. The result is a draw.',
        ],
        diagram: {
          fen: '7k/8/5K1P/8/8/8/8/5B2 w - - 0 1',
          caption: 'White to move. With the wrong bishop (light-squared) the game is a draw.',
        },
      },
      {
        heading: 'The win with the right bishop',
        paragraphs: [
          'Give White a dark-squared bishop instead, and the same position is a win. The bishop controls h8, so the black king has no safe corner, and the pawn promotes.',
        ],
        diagram: {
          fen: '7k/8/5K1P/8/8/8/8/4B3 w - - 0 1',
          caption: 'The same position with the right bishop (dark-squared): White wins.',
        },
      },
      {
        heading: 'What to remember',
        bullets: [
          'It only works when the defending king can reach the corner (or a square next to it) in time. If it is far away, even the wrong bishop wins.',
          'Look at the bishop and the promotion square before you trade into this ending. One light square or one dark square decides the result.',
          'If you are the defender, head for the corner and never let the king be cut off from it.',
        ],
      },
    ],
    practice: { fen: '7k/8/5K1P/8/8/8/8/5B2 w - - 0 1', label: 'Check the wrong-colored bishop in Board Analysis' },
    related: ['king-and-pawn-opposition', 'philidor-position'],
  },
];

export function lessonBySlug(slug: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug);
}

export function lessonPath(slug: string): string {
  return `${THEORY_BASE}/${slug}`;
}

/** The lesson shown at an address such as "/endgames/lucena-position" (undefined for the index and unknown paths). */
export function lessonForPath(pathname: string): Lesson | undefined {
  const clean = pathname.replace(/\/+$/, '');
  if (!clean.startsWith(`${THEORY_BASE}/`)) return undefined;
  return lessonBySlug(clean.slice(THEORY_BASE.length + 1));
}

/** Address of Board Analysis with the lesson's position loaded. */
export function practiceHref(lesson: Lesson): string {
  return `/analysis?fen=${encodeURIComponent(lesson.practice.fen)}`;
}
