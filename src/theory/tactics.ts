// The tactics lessons. Every position was checked with chess.js (legal, the moves of the lesson are legal, the
// mates are mates) and with Stockfish (the move of the lesson is the best or a clearly winning move; the
// zugzwang pair is a draw with White to move and a win with Black to move). Lines from real games are written
// as moves, so a typo fails the test instead of showing a wrong board. Edit the text here; the pages, the index
// and the "practise this" buttons are built from it. A lesson also needs an entry in server/seo.ts (a test checks that).

import type { Diagram, Lesson, TheoryCollection } from './types.ts';
import { after } from './openings.ts';

export const TACTICS_BASE = '/tactics';

/** A diagram of a position given as a FEN, with the squares of the idea marked by arrows. */
function position(fen: string, caption: string, arrows?: Array<[string, string]>): Diagram {
  return { fen, caption, arrows };
}

const GROUP_MATERIAL = 'Winning material';
const GROUP_FORCING = 'Forcing the opponent';
const GROUP_MATES = 'Mating patterns';

// Positions that are used twice (a diagram and the practice button).
const FORK_KNIGHT = '2q3k1/pp3ppp/8/3N4/8/8/PP3PPP/4K3 w - - 0 1';
const PIN_WIN = '4k3/4n3/5B2/8/8/8/5PPP/4R1K1 w - - 0 1';
const SKEWER_BISHOP = '4r3/pp1k1ppp/8/8/8/8/PPP2PPP/5BK1 w - - 0 1';
const DISCOVERED_KNIGHT = '3qk3/pppp1ppp/8/4N3/8/8/PPP2PPP/4R1K1 w - - 0 1';
const DOUBLE_MATE = '3qkb2/pppp1ppp/8/8/4N3/8/PPP2PPP/4R1K1 w - - 0 1';
const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
const DEFLECT_BACK_RANK = '1r4k1/5ppp/8/3n4/Q7/8/5PPP/4R1K1 w - - 0 1';
const SMOTHERED = '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1';
const ZUGZWANG_BLACK = '8/4k3/8/4K3/4P3/8/8/8 b - - 0 1';
const ATTRACTION_ROOK = '2bq2k1/pp4p1/2p1p3/3p2N1/8/2P4R/PP3PP1/4R1K1 w - - 0 1';

const LEGAL_TRAP = '1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1';
const PETROV_TRAP = '1. e4 e5 2. Nf3 Nf6 3. Nxe5 Nxe4 4. Qe2 Nf6';
const OPERA_GAME =
  '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7';
const SHILLING_GAMBIT = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2';

export const TACTICS_LESSONS: Lesson[] = [
  {
    slug: 'fork',
    title: 'The Chess Fork: Attack Two Pieces at Once',
    summary: 'One move, two targets: how knights, queens and pawns fork, why a fork with check wins material and how to spot one.',
    group: GROUP_MATERIAL,
    kind: 'Tactic',
    intro: [
      'A fork is a single move that attacks two or more enemy pieces at the same time. Your opponent has only one move, so he can save one piece and you win the other. It is the simplest and most common way to win material, and it is the first tactic every player should learn.',
    ],
    sections: [
      {
        heading: 'The knight fork',
        paragraphs: [
          'The knight is the best forking piece. It attacks in an L-shape and jumps over other pieces, so its attack cannot be blocked. When a knight forks the king and the queen, it is called a royal fork.',
          'Here White plays Ne7+. The knight gives check to the king on g8 and attacks the queen on c8 at the same time. The queen cannot take the knight, so Black has to move the king and White plays Nxc8.',
        ],
        diagram: position(FORK_KNIGHT, 'White to move: Ne7+ forks the king and the queen and wins the queen.', [
          ['d5', 'e7'],
          ['e7', 'g8'],
          ['e7', 'c8'],
        ]),
      },
      {
        heading: 'The queen fork',
        paragraphs: [
          'The queen attacks along files, ranks and diagonals, so it forks whatever stands on two of those lines. A fork with check is the strongest, because the opponent must answer the check and has no time to protect the other piece.',
          'In this position the white queen jumps to d5 with check. The same move attacks the rook on a8. Black moves the king and White takes the rook with check (after ...Kh8 it is even checkmate).',
        ],
        diagram: position('r5k1/p5pp/8/8/8/8/PPP2PPP/3Q2K1 w - - 0 1', 'White to move: Qd5+ attacks the king and the rook on a8.', [
          ['d1', 'd5'],
          ['d5', 'g8'],
          ['d5', 'a8'],
        ]),
      },
      {
        heading: 'Pawn forks and family forks',
        paragraphs: [
          'Pawns fork too, and they are the cheapest forking pieces there is. A pawn that steps forward and attacks two pieces wins one of them, because the opponent will not take a pawn with a piece that is worth more, and cannot save both. A bishop can fork along two diagonals and a rook along a file and a rank.',
          'A knight that attacks the king, the queen and a rook at once is called a family fork. It is the most painful of all, so keep an eye on the squares in the enemy camp (c7 and f7 in the black camp, c2 and f2 in the white camp) that a knight could reach.',
        ],
      },
      {
        heading: 'How to find forks',
        bullets: [
          'Look for loose pieces: a piece that nothing protects is the best target, and so is a king and a queen or rook a knight move apart.',
          'Look at the squares a knight can reach, not only at the squares it stands next to. Ask yourself what a knight on each of them would attack.',
          'Try checks first. A check forces the answer, so the second target cannot run.',
          'Make sure the forking piece is safe or protected. A fork that loses the forking piece is no fork.',
        ],
      },
      {
        heading: 'How to avoid being forked',
        paragraphs: [
          'Before every move, look at the squares where an enemy knight could land with check, and at the squares where a queen or a pawn would attack two of your pieces. Keep your pieces protected and do not leave the king and the queen a knight move apart.',
        ],
      },
    ],
    practice: { fen: FORK_KNIGHT, label: 'Find the fork in Board Analysis' },
    related: ['double-check', 'skewer', 'attraction'],
  },
  {
    slug: 'pin',
    title: 'The Pin in Chess: Absolute and Relative Pins',
    summary: 'A pinned piece cannot move without exposing something more valuable. The two kinds of pin, famous examples and how to win a pinned piece.',
    group: GROUP_MATERIAL,
    kind: 'Tactic',
    intro: [
      'A pin freezes an enemy piece. A bishop, rook or queen attacks a piece, and behind it on the same line stands something more valuable. If the pinned piece moves, the piece behind it is captured. Only the long-range pieces (bishop, rook and queen) can pin.',
    ],
    sections: [
      {
        heading: 'The absolute pin',
        paragraphs: [
          'When the piece behind is the king, the pin is absolute: the pinned piece may not move off the line at all, because it would be an illegal move. It is the strongest kind of pin.',
          'After 1.e4 e5 2.Nf3 Nc6 3.Bb5 d6 the knight on c6 is pinned to the king on e8 by the bishop on b5. (With the pawn still on d7 there is no pin, because the pawn is in the way. Moving the pawn opened the line.) The knight cannot move, and White can now pile up on it.',
        ],
        diagram: position(
          after('1. e4 e5 2. Nf3 Nc6 3. Bb5 d6'),
          'The knight on c6 is pinned to the king and has no legal move.',
          [
            ['b5', 'c6'],
            ['c6', 'e8'],
          ],
        ),
      },
      {
        heading: 'The relative pin',
        paragraphs: [
          'When the piece behind is not the king but a queen, a rook or any piece worth more than the pinned one, the pin is relative. The pinned piece may move, but the player loses material if he does it.',
          'In this Nimzo-Indian position both kinds appear. The bishop on b4 pins the knight on c3 against the white king (absolute). The bishop on g5 pins the knight on f6 against the black queen (relative): the knight could move, but then the queen would be taken.',
        ],
        diagram: position(
          after('1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bg5'),
          'Two pins. The knight on c3 is pinned to the king, the knight on f6 to the queen.',
          [
            ['b4', 'c3'],
            ['c3', 'e1'],
            ['g5', 'f6'],
            ['f6', 'd8'],
          ],
        ),
      },
      {
        heading: 'Winning a pinned piece',
        paragraphs: [
          'A pinned piece cannot run away, so attack it again and again. Here the knight on e7 is pinned to the king by the rook on e1. White plays Bxe7. The black king cannot take the bishop, because the rook protects it. White has won a knight, and the king could not help.',
        ],
        diagram: position(PIN_WIN, 'White to move: Bxe7 wins the pinned knight. The rook on e1 protects the bishop.', [
          ['f6', 'e7'],
          ['e1', 'e7'],
        ]),
      },
      {
        heading: 'Pins decide openings',
        paragraphs: [
          'Many openings are fights about pins. A bishop that pins a knight (Bb5 against c6, Bb4 against c3, Bg5 against f6) puts pressure on the centre, because the pinned knight cannot be counted on to guard anything: if it captures or moves, the piece behind it is lost. That is why players often break such a pin with a quick ...h6 or a3, or by castling.',
          'The best attacker of a pinned piece is a pawn. A pawn is worth less than any piece, and it cannot be chased away by the piece it attacks, because that piece cannot move.',
        ],
      },
      {
        heading: 'Breaking a pin',
        bullets: [
          'Move the king or the more valuable piece off the line (a little luft, a castle, a queen move).',
          'Block the line with a piece or a pawn, or capture the pinning piece.',
          'Attack the pinning piece, for example with a pawn, so that it has to leave.',
          'Count the attackers and the defenders of the pinned piece before it is too late: it will not be able to move, so it is only protected by the others.',
        ],
      },
    ],
    practice: { fen: PIN_WIN, label: 'Win the pinned piece in Board Analysis' },
    related: ['skewer', 'discovered-attack', 'fork'],
  },
  {
    slug: 'skewer',
    title: 'The Skewer: Force the Big Piece to Move',
    summary: 'The skewer is a pin turned around: the valuable piece is in front and has to move, and you take what stands behind it.',
    group: GROUP_MATERIAL,
    kind: 'Tactic',
    intro: [
      'A skewer looks like a pin, but the pieces stand the other way round. The attacked piece in front is the more valuable one. It has to step aside, and the piece behind it, which was protected only by its position in the shadow, is captured. Like the pin, the skewer is made by a bishop, a rook or a queen.',
    ],
    sections: [
      {
        heading: 'A skewer with check',
        paragraphs: [
          'The best skewers have the king in front, because a king has to move. Here the black king stands on d7 with a rook behind it on the same diagonal. White plays Bb5+. The king must leave the diagonal, and then the bishop takes the rook on e8. At best Black can take the bishop back with the king (after ...Ke7 or ...Kd8), so White wins at least the exchange (a rook for a bishop).',
        ],
        diagram: position(SKEWER_BISHOP, 'White to move: Bb5+ skewers the king and the rook behind it.', [
          ['f1', 'b5'],
          ['b5', 'd7'],
          ['d7', 'e8'],
        ]),
      },
      {
        heading: 'A skewer against the queen',
        paragraphs: [
          'A rook can skewer along a file or a rank. Black has a queen and White only a rook, but after Rd1+ the king has to leave the d-file and the rook takes the queen. White gives up a rook for a queen and the ending with three extra pawns is easy to win.',
        ],
        diagram: position('3q4/3k4/8/8/8/8/5PPP/R5K1 w - - 0 1', 'White to move: Rd1+ skewers the king and the queen.', [
          ['a1', 'd1'],
          ['d1', 'd7'],
          ['d7', 'd8'],
        ]),
      },
      {
        heading: 'Skewers in the endgame',
        paragraphs: [
          'In rook endings the skewer is a basic weapon. A rook checks the king from the side, the king has to step away, and the rook takes the enemy rook that stood on the same line behind it. Many drawn-looking endings are decided by a skewer that one of the players overlooked.',
          'The front piece does not have to be the king. A rook that attacks a queen with another rook behind it forces the queen to move, and the second rook falls if nothing protects it. The idea is the same: the valuable piece has to give way.',
        ],
      },
      {
        heading: 'Pin or skewer?',
        bullets: [
          'Pin: the less valuable piece is in front. It cannot move without losing the piece behind it.',
          'Skewer: the more valuable piece is in front. It has to move, and the piece behind it is lost.',
          'Both need a straight line, so look at files, ranks and diagonals where two enemy pieces stand one behind the other.',
        ],
      },
      {
        heading: 'Where skewers come from',
        bullets: [
          'The enemy king and queen (or rook) lined up on a file, a rank or a diagonal, for example after a check that drove the king onto the line.',
          'Open files and the back rank, where a rook gives check and the rook behind the king is the target.',
          'Endgames: a rook check from the side of the king often skewers a piece standing behind it.',
          'Before you play it, check that the piece giving the skewer cannot be captured.',
        ],
      },
    ],
    practice: { fen: SKEWER_BISHOP, label: 'Find the skewer in Board Analysis' },
    related: ['pin', 'fork', 'back-rank-mate'],
  },
  {
    slug: 'discovered-attack',
    title: 'Discovered Attack: Two Threats in One Move',
    summary: 'Move a piece out of the way and let the piece behind it attack. A discovered check wins a queen, because the opponent has to answer the check.',
    group: GROUP_MATERIAL,
    kind: 'Tactic',
    intro: [
      'In a discovered attack you move one piece and by doing it you open the line of another piece behind it. Now two things are attacked at the same time: what the piece behind attacks, and what the piece that moved attacks. When the line you opened leads to the king, it is a discovered check, and that is the most powerful version.',
    ],
    sections: [
      {
        heading: 'A knight moves, a rook gives check',
        paragraphs: [
          'The white rook on e1 stands behind its own knight on e5, and the black king is on the same file. Any knight move discovers a check. White plays Nc6+, and the knight lands on a square where it attacks the queen on d8.',
          'Black has to deal with the check from the rook. Whatever he does (the queen can block on e7, but the knight takes it there), White takes the queen on the next move. The knight could do anything it liked while the king was in check.',
        ],
        diagram: position(DISCOVERED_KNIGHT, 'White to move: Nc6+ is a discovered check from the rook, and the knight attacks the queen.', [
          ['e5', 'c6'],
          ['c6', 'd8'],
          ['e1', 'e8'],
        ]),
      },
      {
        heading: 'A trap in the Petrov Defence',
        paragraphs: [
          'Sometimes the piece behind is the queen. After 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4 4.Qe2 the white queen aims at the king along the e-file. If Black plays 4...Nf6?? the knight on e5 jumps away with 5.Nc6+, a discovered check from the queen, and the knight attacks the queen on d8. Black loses the queen. The right move is 4...Qe7 (or another move that gets out of the e-file in time).',
        ],
        diagram: position(after(PETROV_TRAP), 'After 4...Nf6? White plays 5.Nc6+, a discovered check from the queen on e2, and wins the queen.', [
          ['e5', 'c6'],
          ['c6', 'd8'],
          ['e2', 'e8'],
        ]),
      },
      {
        heading: 'Discovered attack without a check',
        paragraphs: [
          'A discovered attack does not have to be a check. If the piece behind attacks the queen or a loose piece, and the piece that moves makes a second threat or captures something, the opponent can meet only one of the two threats. Of course a check is more forcing, because the opponent has no choice at all.',
          'A series of discovered checks, where the same piece captures something with every move, is called a windmill. It is rare, but it shows how much a discovered check can win.',
        ],
      },
      {
        heading: 'How to find and avoid it',
        bullets: [
          'Look at your own long-range pieces (rook, bishop, queen) and ask what stands in front of them. If it is a knight or a pawn, moving it may uncover an attack.',
          'The moving piece is free to make a threat of its own, or to capture something, because the opponent must first answer the discovered attack.',
          'Check the enemy king and queen too: if one of your pieces is the only thing between an enemy slider and your king or queen, you are open to the same trick.',
          'Do not leave the king and the queen on the same file, rank or diagonal as an enemy rook or bishop with only one piece in between.',
        ],
      },
    ],
    practice: { fen: DISCOVERED_KNIGHT, label: 'Find the discovered check in Board Analysis' },
    related: ['double-check', 'pin', 'fork'],
  },
  {
    slug: 'double-check',
    title: 'Double Check: When Only the King Can Move',
    summary: 'Two pieces give check at the same time, so the king has to move. How a double check leads to mate and wins the queen.',
    group: GROUP_MATERIAL,
    kind: 'Tactic',
    intro: [
      'A double check is a check from two pieces at once. It is made by a discovered check in which the piece that moves also gives check. You cannot block two checks or capture two pieces with one move, so there is only one way out: the king itself must move (or capture one of the checking pieces if it is not protected). That is why a double check so often ends in mate.',
    ],
    sections: [
      {
        heading: 'Double check and mate',
        paragraphs: [
          'The black king on e8 is shut in by its own queen on d8, bishop on f8 and pawns on d7 and f7. The white rook on e1 stands behind the knight on e4. White plays Nd6#. The knight gives check and the rook gives check by the open file. The bishop on f8 can take the knight, but that would stop only one check. The king has no square, and it is checkmate. (Nf6# works too.)',
        ],
        diagram: position(DOUBLE_MATE, 'White to move: Nd6 is a double check, and a checkmate.', [
          ['e4', 'd6'],
          ['d6', 'e8'],
          ['e1', 'e8'],
        ]),
      },
      {
        heading: 'Double check that wins the queen',
        paragraphs: [
          'Even if the king has a square, the double check wins material, because nothing but a king move is allowed. Here the black queen stands on f6. White takes it with check: Nxf6+, a double check, because the rook on e1 also attacks the king. Black cannot recapture, the king has to move to d8 or f8, and White finishes with Re8#, because the knight on f6 protects the rook.',
        ],
        diagram: position('4k3/pppp1ppp/5q2/8/4N3/8/PPP2PPP/4R1K1 w - - 0 1', 'White to move: Nxf6+ is a double check. After the king moves, Re8 is mate.', [
          ['e4', 'f6'],
          ['e1', 'e8'],
        ]),
      },
      {
        heading: 'Why nothing else helps',
        paragraphs: [
          'To answer an ordinary check you can capture the checking piece, block the line, or move the king. In a double check the first two do not work, because you can only deal with one of the two pieces. The only exception is the king itself: it may capture one of the checking pieces, if nothing protects it. So a double check is a threat that no piece of the defender can parry, and a king with few free squares is mated at once.',
        ],
      },
      {
        heading: 'How to look for it',
        bullets: [
          'The enemy king is usually still in the middle, or boxed in by its own pieces.',
          'You need a long-range piece (often a rook on an open file or a bishop on a long diagonal) with your own piece in front of it. Knights are ideal moving pieces, because they give check from a square that is not on the line.',
          'Count the squares of the king first. If the king has no square, a double check is mate.',
          'Remember it when you defend: a king on an open file in the middle of the board is always in danger of a discovered or double check.',
        ],
      },
    ],
    practice: { fen: DOUBLE_MATE, label: 'Find the double check in Board Analysis' },
    related: ['discovered-attack', 'back-rank-mate', 'smothered-mate'],
  },
  {
    slug: 'deflection',
    title: 'Deflection: Lure a Defender Away',
    summary: 'Force an enemy piece away from the square or the job it protects, often with a sacrifice, and take what it guarded.',
    group: GROUP_FORCING,
    kind: 'Tactic',
    intro: [
      'Every piece in a chess position has a job: it guards a piece, a square or the back rank. Deflection forces such a piece to leave its post, usually with a sacrifice that cannot be refused, and the thing it guarded falls. (Overloading is a close relative: one piece with too many jobs.)',
    ],
    sections: [
      {
        heading: 'A back-rank deflection',
        paragraphs: [
          'The black rook on b8 is the only piece that guards the back rank. White plays Re8+!. It has to be taken, because it is check and the king has no square. After 1...Rxe8 the rook is no longer on the back rank, and 2.Qxe8# is mate: the queen comes along the diagonal a4–e8, and the knight on d5 cannot reach f8.',
        ],
        diagram: position(DEFLECT_BACK_RANK, 'White to move: Re8+! Rxe8 Qxe8#. The rook was the only defender of the back rank.', [
          ['e1', 'e8'],
          ['a4', 'e8'],
        ]),
      },
      {
        heading: 'The Opera Game',
        paragraphs: [
          'The most famous deflection is in the game Paul Morphy played in Paris in 1858. Black has just recaptured with 15...Nxd7. White plays 16.Qb8+!!, a queen sacrifice. The knight on d7 is the only piece that can take it, and it has to, because it is check. That pulls the knight off d7, where it blocked the d-file, and 17.Rd8# is checkmate: the rook is protected by the bishop on g5 and the king has no square.',
        ],
        diagram: position(after(OPERA_GAME), 'White to move: 16.Qb8+! Nxb8 17.Rd8#. The knight was deflected from d7.', [
          ['b3', 'b8'],
          ['d1', 'd8'],
        ]),
      },
      {
        heading: 'Typical targets of a deflection',
        paragraphs: [
          'Deflection and removing the defender are close relatives. If you can simply capture the defender, do it. A deflection is for the case where you cannot, and the defender has to be forced to leave by a threat or by a sacrifice that cannot be refused. These are the usual targets:',
        ],
        bullets: [
          'The defender of the back rank (the rook on b8 and the knight on d7 above).',
          'The defender of a piece or a pawn: lure it away and take what it guarded.',
          'A piece that blocks the line of your rook, bishop or queen. Forcing it to capture opens the line.',
          'A piece that covers the square where your mate or your fork would happen.',
        ],
      },
      {
        heading: 'How to find a deflection',
        bullets: [
          'Ask of every enemy piece: what does it protect? Look for a piece that has two jobs.',
          'Look at what you give up. In the first example White trades a rook for a rook and the queen mates; in the Opera Game White gives the queen, the most valuable piece, because the mate that follows is forced.',
          'Look for the piece that stops your mate or your capture, and ask if you can force it away with a check or a capture it must take.',
          'The best deflections are forcing. A sacrifice that the opponent can refuse is only a gift.',
          'Calculate the whole line. After the piece is lured away you must have a mate or win more than you gave.',
        ],
      },
    ],
    practice: { fen: DEFLECT_BACK_RANK, label: 'Find the deflection in Board Analysis' },
    related: ['attraction', 'back-rank-mate', 'smothered-mate'],
  },
  {
    slug: 'attraction',
    title: 'Attraction (Decoy): Drag a Piece to a Bad Square',
    summary: 'A sacrifice that forces the king or the queen onto a square where a fork or a mate is waiting. Légal\'s mate and a rook sacrifice that wins a queen.',
    group: GROUP_FORCING,
    kind: 'Tactic',
    intro: [
      'Attraction, also called a decoy, is the opposite of a deflection. Deflection drives a piece away from a square. Attraction forces a piece (most often the king, sometimes the queen) onto a square, and there it is hit by a fork, a mate or a skewer. The bait is usually a sacrifice that cannot be declined.',
    ],
    sections: [
      {
        heading: 'Légal\'s mate',
        paragraphs: [
          'This old trap starts with a greedy capture. Black has just taken the white queen with 5...Bxd1. White plays 6.Bxf7+!. The bishop is protected by the knight on e5, so the king cannot take it, and the knight on e5 also covers d7. The king has one move: Ke7. That is the square White wanted. 7.Nd5# is checkmate: the knight gives the check and the bishop on f7 covers the squares the king would run to.',
        ],
        diagram: position(after(LEGAL_TRAP), 'White to move: 6.Bxf7+! Ke7 7.Nd5#. The check drags the king to e7.', [
          ['c4', 'f7'],
          ['c3', 'd5'],
        ]),
      },
      {
        heading: 'A rook sacrifice that wins the queen',
        paragraphs: [
          'The bait does not have to be a queen. White plays Rh8+!. The black king has only one answer, Kxh8, because the knight on g5 covers f7 and h7. Now 2.Nf7+ is a fork of the king on h8 and the queen on d8. The king moves and White takes the queen. A rook (five points) bought a queen (nine) and a winning position.',
        ],
        diagram: position(ATTRACTION_ROOK, 'White to move: Rh8+! Kxh8 Nf7+ forks the king and the queen.', [
          ['h3', 'h8'],
          ['g5', 'f7'],
          ['f7', 'd8'],
        ]),
      },
      {
        heading: 'Attraction or deflection?',
        paragraphs: [
          'The two ideas look alike, because both are sacrifices that force a piece to capture. The difference is the purpose. In a deflection the capturing piece leaves a square or a job, and you profit from the empty place it leaves behind. In an attraction the capturing piece arrives on a square, and you profit from what is waiting for it there. In the Opera Game the knight leaves d7 (deflection). In Légal\'s mate the king arrives on e7 (attraction).',
          'The target is usually the king, because a king has to take or move, but a queen can be attracted too: a queen that takes a poisoned piece can land on a square where a knight forks it.',
        ],
      },
      {
        heading: 'How to find an attraction',
        bullets: [
          'Look for a square where an enemy king would be in trouble: a knight-fork square, the end of an open line, a square next to your pieces.',
          'Ask if you can force the king to go there with a check or a capture that it has to take.',
          'Count the price. The sacrifice has to win more than it loses, or lead to mate.',
          'Check that the opponent has no other reply. If the sacrificed piece can be ignored, the idea fails.',
          'Have the follow-up ready: after the king or the queen has taken, you need a forcing move (a fork, a check or a mate) to cash in.',
        ],
      },
    ],
    practice: { fen: ATTRACTION_ROOK, label: 'Find the decoy in Board Analysis' },
    related: ['deflection', 'fork', 'smothered-mate'],
  },
  {
    slug: 'zugzwang',
    title: 'Zugzwang: When Every Move Makes It Worse',
    summary: 'The side to move would like to pass but cannot. How zugzwang decides pawn endings, and why the same position can be a draw or a win.',
    group: GROUP_FORCING,
    kind: 'Tactic',
    intro: [
      'Zugzwang is a German word, "compulsion to move". It is a position in which the player to move would be better off if he could pass, because every move he has makes his position worse. Chess does not allow a pass, so he must move and give something away. It is the quiet tactic: nothing is captured and nothing is attacked, and still the position is lost.',
    ],
    sections: [
      {
        heading: 'The same position, two results',
        paragraphs: [
          'The kings face each other with one square between them, and White has a pawn on e4. If it is White to move, he has to step aside with the king (the pawn is blocked by his own king on e5), Black answers by taking the opposition again, and the game is a draw.',
        ],
        diagram: position('8/4k3/8/4K3/4P3/8/8/8 w - - 0 1', 'White to move: a draw. Any king move gives up the opposition.'),
      },
      {
        heading: 'Black to move',
        paragraphs: [
          'Put the same pieces on the same squares and give the move to Black, and the result is the opposite. Now Black is in zugzwang: any king move lets the white king advance. After 1...Kd7 White plays 2.Kf6, and the king has reached a key square in front of the pawn. White wins.',
        ],
        diagram: position(ZUGZWANG_BLACK, 'Black to move: every move loses. Kd7 is met by Kf6.'),
      },
      {
        heading: 'The white king gets in',
        paragraphs: [
          'After 1...Kd7 2.Kf6 the white king stands on f6, one of the key squares of the pawn on e4. Black cannot stop the pawn any more: the king walks in front of it, the pawn follows and promotes. The position at the start was decided by who had to move.',
        ],
        diagram: position('8/3k4/5K2/8/4P3/8/8/8 b - - 0 2', 'Black to move after 1...Kd7 2.Kf6. The white king is on a key square and White wins.'),
      },
      {
        heading: 'How to use it',
        paragraphs: [
          'To force a zugzwang, first take away the squares of the enemy pieces, so that there are few safe moves left. Then make sure that you still have a spare move of your own (a free king move or a pawn move that does not weaken you), so that you are not the one who runs out. In pawn endings, counting the spare moves of both sides tells you who will be in zugzwang first.',
        ],
      },
      {
        heading: 'Where it appears',
        bullets: [
          'King and pawn endings above all, where the opposition and the key squares are a question of who must move.',
          'Mutual zugzwang: a position in which whoever has to move loses. Both players try to lose a tempo and force the other one to move.',
          'Triangulation: the king walks around three squares to reach the same position with the other player to move.',
          'Middlegames and endings with pieces: when all your pieces are tied to the defence, any move can be a concession.',
          'Zugzwang is not stalemate. In stalemate the player has no legal move at all, and the game is a draw. In zugzwang he has legal moves, but all are bad.',
        ],
      },
    ],
    practice: { fen: ZUGZWANG_BLACK, label: 'Play both sides in Board Analysis' },
    related: ['deflection', 'attraction', 'back-rank-mate'],
  },
  {
    slug: 'back-rank-mate',
    title: 'Back-Rank Mate: Patterns and How to Avoid It',
    summary: 'The king is trapped behind its own pawns and a rook or queen checks on the last rank. How to give it, how to see it coming and how to make luft.',
    group: GROUP_MATES,
    kind: 'Tactic',
    intro: [
      'A back-rank mate is a checkmate on the first or the eighth rank, where the king cannot escape because its own pawns stand in front of it. It happens at every level of play, from beginners to masters, and it is the first checkmate pattern to learn, both to give it and to avoid it.',
    ],
    sections: [
      {
        heading: 'The pattern',
        paragraphs: [
          'The black king is on g8 with pawns on f7, g7 and h7. The squares in front of it are taken by its own pawns. The white rook on e1 has the open e-file, and Re8# is checkmate: no piece can capture the rook or block, and the king has no square.',
          'The same mate works against a white king on g1 with pawns on f2, g2 and h2. In games it most often happens after an exchange of pieces, when a rook arrives on the last rank from the side.',
        ],
        diagram: position(BACK_RANK, 'White to move: Re8 is checkmate. The pawns shut the king in.', [
          ['e1', 'e8'],
          ['g8', 'g7'],
        ]),
      },
      {
        heading: 'Luft: the escape square',
        paragraphs: [
          'Luft (German for "air") is a square for the king to breathe: a pawn move such as h3 or h6 gives the king a way out. Here Black has played ...h6. Re8+ is only a check now, because the king goes to h7. A small pawn move like that is worth making when an enemy rook has the open file.',
        ],
        diagram: position('6k1/5pp1/7p/8/8/8/5PPP/4R1K1 w - - 0 1', 'With a pawn on h6 the king has luft. Re8+ Kh7 is no mate.', [['g8', 'h7']]),
      },
      {
        heading: 'Rooks and queens',
        paragraphs: [
          'A rook or a queen can give the mate. Two rooks on an open file are the most dangerous: one rook checks on the back rank, and if a piece takes it, the other rook takes back with mate. A queen on the back rank has the same idea, with a rook behind it.',
          'Back-rank weaknesses appear after exchanges. Every time a rook or a minor piece leaves the back rank, look at what the enemy rook can do with the open file, and at where your own king would go.',
        ],
      },
      {
        heading: 'How to give it, how to avoid it',
        bullets: [
          'Take the open file with a rook, and bring a second piece (the queen or the other rook) to support it.',
          'Remove or lure away the defender of the back rank with a sacrifice. See the lesson on deflection: Re8+ Rxe8 and the queen mates.',
          'Before you move a rook off your back rank, check if your king would have a square, and if the enemy can use the open file.',
          'Make luft in time, but not too early. Every pawn move also weakens the king.',
          'When you capture or exchange, ask what the enemy rook can do with the open file next move.',
          'If you are the one in danger, keep a rook or the queen on the back rank, and do not grab a pawn with the only piece that guards it.',
        ],
      },
    ],
    practice: { fen: BACK_RANK, label: 'Find the mate in Board Analysis' },
    related: ['deflection', 'double-check', 'smothered-mate'],
  },
  {
    slug: 'smothered-mate',
    title: 'Smothered Mate: The Knight\'s Finishing Blow',
    summary: 'A knight mates a king that is hemmed in by its own pieces. The pattern, a trap from the Blackburne Shilling Gambit and how to avoid it.',
    group: GROUP_MATES,
    kind: 'Tactic',
    intro: [
      'A smothered mate is a checkmate in which the king is surrounded by its own pieces and cannot move. It is nearly always delivered by a knight, because a knight\'s check cannot be blocked. It turns up again and again in opening traps.',
    ],
    sections: [
      {
        heading: 'The pattern',
        paragraphs: [
          'The black king is on h8. Its own rook is on g8 and its own pawns are on g7 and h7, so it has no square to go to. The white knight jumps from e5 to f7 with check, and nobody can capture it. 1.Nf7# is checkmate.',
          'This corner version is the best known. The knight can come to f7 from e5, g5, d6 or h6, and the same picture can be turned around for any other corner.',
        ],
        diagram: position(SMOTHERED, 'White to move: Nf7 is mate. The king is smothered by its own rook and pawns.', [
          ['e5', 'f7'],
          ['f7', 'h8'],
        ]),
      },
      {
        heading: 'A trap from the Blackburne Shilling Gambit',
        paragraphs: [
          'After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 4.Nxe5?! Qg5 5.Nxf7? Qxg2 6.Rf1 Qxe4+ 7.Be2, White has grabbed two pawns, and his king on e1 is surrounded by its own queen, rook, bishop and pawns. Black plays 7...Nf3#. The knight cannot be taken and the king has no square. The knight capture 5.Nxf7? is the mistake that walks into the trap. A king does not have to be in the corner: here it stands in the middle of the board, but its own pieces take away all its squares.',
        ],
        diagram: position(after(SHILLING_GAMBIT), 'Black to move: 7...Nf3# is checkmate. The white king is smothered by its own pieces.', [
          ['d4', 'f3'],
          ['f3', 'e1'],
        ]),
      },
      {
        heading: 'Why a knight, why the corner',
        paragraphs: [
          'A smothered mate needs a king that is boxed in, so it is most often seen in the corner, where the king\'s own rook and pawns take away its squares. The knight is the right piece for the job because it gives check from a distance and its check cannot be blocked.',
          'Often a sacrifice comes first. It lures the king into the corner, or forces one of the king\'s own pieces onto a square next to it. The lessons on attraction and deflection show that idea at work.',
        ],
      },
      {
        heading: 'How to give it, how to avoid it',
        bullets: [
          'Look for a king that is boxed in by its own pieces, especially in the corner or on the back rank, with a knight that can reach a checking square.',
          'Often a sacrifice is needed to lure a defender (or a piece next to the king) onto its place first: this is where attraction and deflection come in.',
          'When you defend, give your king room. A pawn move that frees a square, or a piece moved away from the king, can end the danger.',
          'Always check the squares a knight can reach with check before you shut your king in.',
          'Do not leave your king in the corner with a rook beside it and no luft: that is the classic recipe for this mate.',
        ],
      },
    ],
    practice: { fen: SMOTHERED, label: 'Find the smothered mate in Board Analysis' },
    related: ['back-rank-mate', 'attraction', 'double-check'],
  },
];

export function tacticBySlug(slug: string): Lesson | undefined {
  return TACTICS_LESSONS.find((lesson) => lesson.slug === slug);
}

export function tacticPath(slug: string): string {
  return `${TACTICS_BASE}/${slug}`;
}

/** The lesson shown at an address such as "/tactics/fork" (undefined for the index and unknown paths). */
export function tacticForPath(pathname: string): Lesson | undefined {
  const clean = pathname.replace(/\/+$/, '');
  if (!clean.startsWith(`${TACTICS_BASE}/`)) return undefined;
  return tacticBySlug(clean.slice(TACTICS_BASE.length + 1));
}

export const TACTICS: TheoryCollection = {
  base: TACTICS_BASE,
  name: 'Tactics',
  allLabel: 'All tactics lessons',
  lessons: TACTICS_LESSONS,
  groups: [GROUP_MATERIAL, GROUP_FORCING, GROUP_MATES],
  bySlug: tacticBySlug,
  forPath: tacticForPath,
  pathFor: tacticPath,
  index: {
    title: 'Chess Tactics: Lessons with Diagrams',
    heading: 'Chess tactics',
    intro:
      'Ten short lessons on the tactics every player should know: the fork, pin, skewer, discovered attack and double check, deflection, attraction and zugzwang, and the two most common mating patterns. Each one has diagrams, the idea in plain words and a button that opens the position in Board Analysis, then train what you learned with puzzles.',
  },
  practiceText:
    'A tactic is learned by finding it. Open the position in Board Analysis and look for the move yourself, then check it with the engine. After that, train the pattern on real puzzles.',
  woodpecker: false,
  training: [
    { href: '/streak', label: 'Puzzle Streak' },
    { href: '/survival', label: 'Puzzle Survival' },
  ],
};
