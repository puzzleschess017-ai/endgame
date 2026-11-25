// What a theory lesson is made of. Endgame lessons (src/theory/endgames.ts) and opening lessons
// (src/theory/openings.ts) share it, and one page component (src/pages/theory/TheoryPage.tsx) shows both.

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

export type LessonKind = 'Win' | 'Draw' | 'Technique' | 'Opening' | 'Defence' | 'Principles';

export interface Lesson {
  slug: string;
  /** Page heading and link text. */
  title: string;
  /** One or two sentences for the index card. */
  summary: string;
  /** The heading of the group of cards it is shown under on the index page (one of the collection's `groups`). */
  group: string;
  /** What the lesson is about: a result to know, a technique to carry out, or an opening to play. */
  kind: LessonKind;
  intro: string[];
  sections: Section[];
  /**
   * What the "practise this" button opens in Board Analysis: a position, or (with `pgn`) a line of moves that
   * can be stepped through. The position is where the line ends.
   */
  practice: { fen: string; label: string; pgn?: string };
  /** Slugs of lessons to read next (of the same collection). */
  related: string[];
}

/** A set of lessons with one index page: /endgames or /openings. */
export interface TheoryCollection {
  base: string;
  /** "Endgame theory": the first words of the breadcrumb and the link back to the index. */
  name: string;
  /** "All endgame lessons" */
  allLabel: string;
  lessons: Lesson[];
  /** The groups of the index page, in the order they are shown. */
  groups: string[];
  bySlug: (slug: string) => Lesson | undefined;
  forPath: (pathname: string) => Lesson | undefined;
  pathFor: (slug: string) => string;
  index: { title: string; heading: string; intro: string };
  /** The text above the "practise this" buttons. */
  practiceText: string;
  /** Endgame lessons also point to the Woodpecker endgame puzzles. */
  woodpecker: boolean;
}
