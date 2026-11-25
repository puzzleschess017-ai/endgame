// The e-books of the eBooks tab (free to download with Premium). This list is only what the page shows: the PDF files and the
// rule of who may download them are on the server (server/ebooks.ts, src/utils/access.ts).
export interface EbookInfo {
  /** The part of the address after /api/ebooks/, also the name of the cover in public/covers/. */
  slug: string;
  title: string;
  subtitle: string;
  pages: number;
  /** What is inside, in a sentence or two. */
  blurb: string;
  /** File name the browser saves the PDF under. */
  downloadName: string;
}

export const EBOOKS: EbookInfo[] = [
  {
    slug: 'queens-gambit',
    title: 'The Queen’s Gambit: A Practical Guide',
    subtitle: 'Ideas, plans, traps and exercises for 1.d4 d5 2.c4',
    pages: 39,
    blurb:
      'Eight chapters on the Accepted, the Declined, the Slav and the counterpunches, seven exercises with solutions and a cheat sheet. Every line was replayed by computer and every evaluation comes from Stockfish.',
    downloadName: 'The-Queens-Gambit-Practical-Guide.pdf',
  },
  {
    slug: 'checkmate-patterns',
    title: '100 Chess Checkmate Patterns',
    subtitle: 'From the back-rank mate to the smothered mate: see it, name it, play it',
    pages: 69,
    blurb:
      'One hundred checkmate patterns, each with a diagram, the mating idea and the line that leads to it, grouped by the pieces that deliver the mate. Every move line was replayed by computer.',
    downloadName: '100-Chess-Checkmate-Patterns.pdf',
  },
  {
    slug: 'essential-endgames',
    title: '100 Essential Chess Endgames',
    subtitle: 'Kings and pawns, rooks, bishops, knights and queens: the positions every player must know',
    pages: 64,
    blurb:
      'Sixty-two theory positions with the result and the engine line (basic mates, king and pawn, Lucena and Philidor, the wrong bishop, queen against a pawn) and thirty-eight real endgames to solve. Every result was checked with Stockfish.',
    downloadName: '100-Essential-Chess-Endgames.pdf',
  },
  {
    slug: 'tactics-workbook',
    title: 'The Ultimate Chess Tactics Workbook',
    subtitle: '200 puzzles: forks, pins, skewers, discoveries, sacrifices and mating attacks',
    pages: 70,
    blurb:
      'Two hundred puzzles from the open Lichess database, from Easy to Expert, in six themed chapters with a forty-position final test and full solutions.',
    downloadName: 'The-Ultimate-Chess-Tactics-Workbook.pdf',
  },
  {
    slug: 'chess-openings-made-simple',
    title: 'Chess Openings Made Simple',
    subtitle: 'Principles, plans and the key lines for White and Black, with the traps to avoid',
    pages: 63,
    blurb:
      'The ten opening principles, the main systems for White and Black, two classic games, typical beginner traps, a starter repertoire and a set of find-the-move exercises. Every line was replayed by computer.',
    downloadName: 'Chess-Openings-Made-Simple.pdf',
  },
  {
    slug: 'think-like-a-chess-master',
    title: 'How to Think Like a Chess Master',
    subtitle: 'Candidate moves, plans, evaluation and the habits that avoid blunders',
    pages: 63,
    blurb:
      'A step-by-step thinking routine, trained with famous master games and real puzzle positions: candidate moves, evaluation, planning, calculation and a final test.',
    downloadName: 'How-to-Think-Like-a-Chess-Master.pdf',
  },
  {
    slug: 'caro-kann-repertoire',
    title: 'Caro-Kann Defence: A Complete Repertoire',
    subtitle: 'A complete repertoire against everything',
    pages: 63,
    blurb:
      'A repertoire for Black after 1.e4 c6: the Advance, the Classical, the Exchange, the Two Knights, the Fantasy, the Panov-Botvinnik Attack and every sideline, with traps, mistakes and four illustrative model lines.',
    downloadName: 'Caro-Kann-Defence-Complete-Repertoire.pdf',
  },
];
