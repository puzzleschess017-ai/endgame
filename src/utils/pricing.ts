// The comparison table of the Pricing page: what a guest, a free account and Premium get. Every row is worked out from
// the same rules the browser and the server use (src/utils/access.ts), so the table cannot say something else than the
// site does when a limit changes.
import { ACCESS, getsEbooksFree, TIERS, type Tier } from './access';
import { levelDescription } from './blindfold';
import { drillLabel, drillLimitLabel, DRILL_KINDS } from './drills';

/** One cell: text, a tick (true) or "not included" (false). */
export type Cell = string | boolean;

export interface PricingRow {
  label: string;
  guest: Cell;
  free: Cell;
  premium: Cell;
}

export interface PricingGroup {
  id: 'account' | 'woodpecker' | 'blindfold';
  title: string;
  rows: PricingRow[];
}

function row(label: string, cell: (tier: Tier) => Cell): PricingRow {
  const [guest, free, premium] = TIERS.map(cell);
  return { label, guest, free, premium };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Up to 9" for a list that starts low and grows; false for an empty list (closed). */
function upTo(values: number[], unit = ''): Cell {
  if (values.length === 0) return false;
  const max = Math.max(...values);
  return values.length === 1 ? `${max}${unit}` : `Up to ${max}${unit}`;
}

function names(values: string[]): Cell {
  return values.length === 0 ? false : values.map(capitalize).join(', ');
}

export function pricingGroups(): PricingGroup[] {
  return [
    {
      id: 'account',
      title: 'Your account',
      rows: [
        row('Results saved to your account on every device', (tier) => tier !== 'guest'),
        row('Every e-book to download', getsEbooksFree),
      ],
    },
    {
      id: 'woodpecker',
      title: 'Woodpecker Method',
      rows: [
        row('Cycles per set', (tier) => upTo(ACCESS[tier].woodpecker.cycles)),
        row('Puzzles in a set', (tier) => upTo(ACCESS[tier].woodpecker.counts)),
        row('Difficulty', (tier) => names(ACCESS[tier].woodpecker.difficulties)),
        row('Puzzle types', (tier) => names(ACCESS[tier].woodpecker.types)),
      ],
    },
    {
      id: 'blindfold',
      title: 'Blindfold Training',
      rows: [
        row('Mate positions', (tier) => {
          const levels = ACCESS[tier].blindfold.levels;
          return levels.length === 0 ? false : capitalize(levelDescription(levels[levels.length - 1]));
        }),
        row('Time to memorize', (tier) => {
          const seconds = ACCESS[tier].blindfold.memorize;
          return seconds.length === 0 ? false : `${seconds.join(', ')} seconds`;
        }),
        row('Mate in', (tier) => {
          const moves = ACCESS[tier].blindfold.mateIn;
          return moves.length === 0 ? false : moves.length === 1 ? `${moves[0]} move` : `Up to ${Math.max(...moves)} moves`;
        }),
        row('Drills', (tier) => {
          const drills = ACCESS[tier].blindfold.drills;
          if (drills.length === 0) return false;
          return drills.length === DRILL_KINDS.length ? `All ${drills.length} drills` : drills.map(drillLabel).join(', ');
        }),
        row('Timed drills', (tier) => {
          const limits = ACCESS[tier].blindfold.drillLimits;
          return limits.length === 0 ? false : limits.map(drillLimitLabel).join(' or ');
        }),
      ],
    },
  ];
}
