// The endgame theory lessons. The first six lessons were checked against the Lichess endgame tablebase; the
// positions of the later ones (rule of the square, queen against a pawn, the two bishop mates) were checked
// with chess.js and Stockfish. Edit the text here; the pages, the index and the "practise this" buttons are
// built from it. A lesson also needs an entry in server/seo.ts (a test checks that).

import type { Lesson, TheoryCollection } from './types.ts';

export type { Diagram, Lesson, Section } from './types.ts';

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
  {
    slug: 'rule-of-the-square',
    title: 'The Rule of the Square in Pawn Endings',
    summary: 'See at a glance whether a king can catch a passed pawn: draw the square and remember who is to move.',
    kind: 'Technique',
    intro: [
      'A passed pawn racing to the eighth rank while the enemy king is far away decides many endgames. You do not have to count move by move: the rule of the square gives you the answer in one look.',
    ],
    sections: [
      {
        heading: 'Draw the square',
        paragraphs: [
          'Count how many moves the pawn needs to reach its queening square. That number is the length of the side of the square. Draw the square from the pawn towards the side where the defending king stands. A white pawn on a4 needs four moves to reach a8, so the square is a4, a8, e8 and e4.',
          'If the defending king can step into the square, he catches the pawn. If he cannot, the pawn queens.',
        ],
      },
      {
        heading: 'The king is inside the square: a draw',
        paragraphs: [
          'The black king on e6 is on the edge of the square. After 1.a5 Kd7 2.a6 Kc7 3.a7 Kb7 the king reaches the pawn in time: the pawn can only queen by being captured on the next move. The white king is too far away to help.',
        ],
        diagram: {
          fen: '8/8/4k3/8/P7/8/8/7K w - - 0 1',
          caption: 'White to move. The king on e6 is inside the square, so the pawn is caught. The game is a draw.',
          arrows: [['a4', 'a8'], ['e6', 'b7']],
        },
      },
      {
        heading: 'The king is outside the square: the pawn queens',
        paragraphs: [
          'Move the king one file away, to f6, and it is outside the square. Now 1.a5 cannot be stopped: the king never gets close enough and the pawn promotes.',
        ],
        diagram: {
          fen: '8/8/5k2/8/P7/8/8/7K w - - 0 1',
          caption: 'White to move. The king on f6 is one file too far from the pawn, and White wins.',
          arrows: [['a4', 'a8']],
        },
      },
      {
        heading: 'Who is to move?',
        paragraphs: [
          'The square is drawn for the side that is to move. When the defender is on move he gains one step. The same position with Black to move is a draw, because 1...Ke6 puts the king inside the square.',
        ],
        diagram: {
          fen: '8/8/5k2/8/P7/8/8/7K b - - 0 1',
          caption: 'Black to move. 1...Ke6 steps into the square, and the pawn is caught. A draw.',
          arrows: [['f6', 'e6']],
        },
      },
      {
        heading: 'Two things to remember',
        bullets: [
          'A pawn on its starting rank can move two squares, so count it as if it stood on the third rank.',
          'The rule ignores the attacker\'s king. If your own king is close enough to help the pawn, the square does not matter any more.',
          'Use it before you start a king walk or a pawn push: a few seconds of counting saves you from running into a lost race.',
        ],
      },
    ],
    practice: { fen: '8/8/5k2/8/P7/8/8/7K w - - 0 1', label: 'Check the pawn race in Board Analysis' },
    related: ['king-and-pawn-opposition', 'queen-vs-pawn-on-the-seventh'],
  },
  {
    slug: 'queen-vs-pawn-on-the-seventh',
    title: 'Queen vs Pawn on the Seventh Rank',
    summary: 'A queen usually beats a pawn, but a bishop pawn or a rook pawn on the seventh rank can draw by stalemate.',
    kind: 'Draw',
    intro: [
      'A queen against a pawn looks like an easy win, and it is, until the pawn reaches the seventh rank with its king beside it. Then the stalemate tricks begin. This is one of the most useful endgames to know, because the result depends on which pawn it is.',
    ],
    sections: [
      {
        heading: 'The stalemate trick',
        paragraphs: [
          'Here Black has a pawn on c2 and a king on a1. If White takes the pawn with 1.Qxc2, the black king has no move and is not in check: stalemate. Nothing else wins for White either, because the king and the pawn protect each other.',
        ],
        diagram: {
          fen: '8/8/7K/8/8/1Q6/2p5/k7 w - - 0 1',
          caption: 'White to move. 1.Qxc2 is stalemate, and the queen cannot make progress. A draw.',
          arrows: [['b3', 'c2']],
        },
      },
      {
        heading: 'Bishop pawn and rook pawn: a draw',
        paragraphs: [
          'With a pawn on the c-file or the f-file (the bishop pawns), or on the a-file or the h-file (the rook pawns), the defender always has these stalemate tricks. Each time the queen checks, the king steps into the corner and the queen has to be careful not to stalemate him. If the attacking king is far away, the game is drawn.',
        ],
        diagram: {
          fen: '8/8/7K/3Q4/8/8/2p5/1k6 w - - 0 1',
          caption: 'White to move. The bishop pawn on c2 is supported by its king, and the white king is too far away. The game is a draw.',
        },
      },
      {
        heading: 'Knight pawn and central pawns: the queen wins',
        paragraphs: [
          'With a pawn on the b-, d-, e- or g-file the stalemate tricks do not work, and the queen wins. The queen forces the king in front of the pawn with a few checks, which costs the defender time and blocks his own pawn. The white king then walks up and the queen delivers mate.',
          'In the diagram White plays 1.Qc4+ Kb2 2.Qd3 Kc1 3.Qc3+ Kd1, and the king now stands in front of its pawn. White brings the king closer and wins.',
        ],
        diagram: {
          fen: '8/8/7K/3Q4/8/8/2kp4/8 w - - 0 1',
          caption: 'White to move and win. The d-pawn gives the defender no stalemate trick.',
          arrows: [['d5', 'c4']],
        },
      },
      {
        heading: 'If the attacking king is close',
        bullets: [
          'When the white king is near the pawn, the queen wins even against a bishop pawn or a rook pawn: the king takes away the squares the defender needs.',
          'If you have the pawn, keep your king next to it and avoid trading into this ending when the enemy king is nearby.',
          'If you have the queen, bring your king closer before you go for the win.',
        ],
      },
    ],
    practice: { fen: '8/8/7K/3Q4/8/8/2p5/1k6 w - - 0 1', label: 'Check the queen against the c-pawn in Board Analysis' },
    related: ['king-and-queen-vs-king', 'rule-of-the-square'],
  },
  {
    slug: 'bishop-and-knight-mate',
    title: 'Checkmate With Bishop and Knight',
    summary: "The hardest basic mate: drive the king to a corner of your bishop's color and use the knight to close the net.",
    kind: 'Technique',
    intro: [
      'A king, a bishop and a knight against a lone king is a forced win, but it needs a precise method and can take up to 33 moves. Most players learn it once, so it is worth knowing the plan before you need it.',
    ],
    sections: [
      {
        heading: 'Know the right corner',
        paragraphs: [
          "A bishop and a knight can only give mate in a corner that has the color of the bishop. With a light-squared bishop that is a8 or h1, with a dark-squared bishop it is a1 or h8. In the other two corners the king is safe, so you have to drive it across the board.",
        ],
        diagram: {
          fen: '7k/5K2/8/8/8/8/4B3/6N1 b - - 0 1',
          caption: 'Black to move. The bishop is light-squared, so h8 is the wrong corner. White must push the king towards a8 or h1.',
        },
      },
      {
        heading: 'The plan',
        bullets: [
          'Drive the king to the edge, with your king and both pieces working together as a net.',
          'Steer it along the edge to the corner of the bishop\'s color. If it runs into the wrong corner, push it out again.',
          'Bring the knight along a zig-zag route shaped like a W, so that each jump takes away a square the king needs. The details are easier to learn by playing the ending against the engine than from a diagram.',
          'Finish with a check from the bishop or the knight, while your king covers the squares next to the corner.',
        ],
      },
      {
        heading: 'The final mate',
        paragraphs: [
          'This is the pattern you are aiming for. The white king covers a7 and b7, the knight covers b8, and the bishop checks along the long diagonal.',
        ],
        diagram: {
          fen: 'k7/3N4/1K6/8/8/3B4/8/8 w - - 0 1',
          caption: 'White to move. 1.Be4 is checkmate.',
          arrows: [['d3', 'e4']],
        },
      },
      {
        heading: 'Watch out for',
        bullets: [
          'Stalemate. When the king is on the edge, always check that it still has a legal move before you play a quiet move.',
          'Keep the bishop and the knight protected by your king or by each other.',
          'Count the moves. The fifty-move rule applies, and with a good method you have plenty of time.',
        ],
      },
    ],
    practice: { fen: '7k/5K2/8/8/8/8/4B3/6N1 b - - 0 1', label: 'Check the bishop and knight mate in Board Analysis' },
    related: ['two-bishops-mate', 'king-and-rook-vs-king'],
  },
  {
    slug: 'two-bishops-mate',
    title: 'Checkmate With Two Bishops',
    summary: 'Two bishops of opposite colors can mate with the help of the king: build a wall and push the king to the edge.',
    kind: 'Technique',
    intro: [
      'A king and two bishops can force checkmate against a lone king, but only when the bishops are of opposite colors, one light-squared and one dark-squared. Two bishops of the same color cannot do it, because they never control squares of the other color. The mate takes at most 19 moves.',
    ],
    sections: [
      {
        heading: 'Build a wall',
        paragraphs: [
          'Place the bishops on neighbouring diagonals, side by side, so that together they form a barrier the king cannot cross. Then push the barrier forward one step at a time and bring your own king up behind it. The black king is forced back to the edge.',
        ],
      },
      {
        heading: 'Mate in the corner',
        paragraphs: [
          'At the end the black king stands in a corner, your king takes away the squares next to it and the bishops cover the rest. Unlike the bishop and knight mate, you can mate in any corner of the board.',
          'Here the bishop on e6 covers g8, the king on g6 covers g7 and h7, and the bishop on g5 gives the last check from f6.',
        ],
        diagram: {
          fen: '7k/8/4B1K1/6B1/8/8/8/8 w - - 0 1',
          caption: 'White to move. 1.Bf6 is checkmate.',
          arrows: [['g5', 'f6']],
        },
      },
      {
        heading: 'Watch out for',
        bullets: [
          'Stalemate. When the king is on the edge or in the corner, make sure it can still move before you play a quiet move.',
          'Keep your bishops protected, or at least out of the reach of the enemy king.',
          'Do not hurry. A move that keeps the wall closed is better than a check that lets the king break out.',
        ],
      },
    ],
    practice: { fen: '7k/8/4B1K1/6B1/8/8/8/8 w - - 0 1', label: 'Check the two bishops mate in Board Analysis' },
    related: ['bishop-and-knight-mate', 'king-and-queen-vs-king'],
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

/** Address of Board Analysis with the lesson's position (or line of moves) loaded. */
export function practiceHref(lesson: Pick<Lesson, 'practice'>): string {
  const { pgn, fen } = lesson.practice;
  return pgn ? `/analysis?pgn=${encodeURIComponent(pgn)}` : `/analysis?fen=${encodeURIComponent(fen)}`;
}

export const ENDGAMES: TheoryCollection = {
  base: THEORY_BASE,
  name: 'Endgame theory',
  allLabel: 'All endgame lessons',
  lessons: LESSONS,
  bySlug: lessonBySlug,
  forPath: lessonForPath,
  pathFor: lessonPath,
  index: {
    title: 'Chess Endgame Theory and Lessons',
    heading: 'Chess endgame theory',
    intro:
      'Short lessons on the endgames every player should know. Each one has diagrams, the key idea in plain words and a button that opens the position in Board Analysis, so you can play it out and check it with the engine.',
  },
  practiceText:
    'Theory sticks when you play it. Open the position in Board Analysis and check it with the engine, or train endgames from real games with the Woodpecker method.',
  woodpecker: true,
};
