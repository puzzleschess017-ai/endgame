// A small read-only chessboard for the theory pages: a picture of a position with optional arrows.
// Plain SVG (no chessground), so it costs nothing to load and prints well.

const LIGHT = '#f0d9b5';
const DARK = '#b58863';
const PIECE_SET = 'cburnett';
const SQUARE = 10;
const MARGIN = 4; // room for the coordinates

const PIECE_NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

export interface PlacedPiece {
  /** "wK", "bP"... the name of the image. */
  code: string;
  square: string;
}

/** The pieces of the first field of a FEN. Unreadable input gives an empty list. */
export function piecesFromFen(fen: string): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  const rows = fen.trim().split(/\s+/)[0]?.split('/') ?? [];
  rows.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        file += Number(ch);
      } else if (/[pnbrqkPNBRQK]/.test(ch) && file < 8 && r < 8) {
        pieces.push({
          code: (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase(),
          square: `${'abcdefgh'[file]}${8 - r}`,
        });
        file += 1;
      }
    }
  });
  return pieces;
}

/** "White: king d8, pawn d7, rook e1. Black: king f7, rook a2." for screen readers. */
export function describeFen(fen: string): string {
  const turn = fen.trim().split(/\s+/)[1] === 'b' ? 'Black' : 'White';
  const side = (color: 'w' | 'b') =>
    piecesFromFen(fen)
      .filter((p) => p.code[0] === color)
      .map((p) => `${PIECE_NAMES[p.code[1].toLowerCase()]} ${p.square}`)
      .join(', ');
  return `White: ${side('w')}. Black: ${side('b')}. ${turn} to move.`;
}

function center(square: string, flipped: boolean): { x: number; y: number } | null {
  const file = 'abcdefgh'.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  if (file < 0 || !(rank >= 0 && rank <= 7)) return null;
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  return { x: MARGIN + col * SQUARE + SQUARE / 2, y: row * SQUARE + SQUARE / 2 };
}

interface DiagramBoardProps {
  fen: string;
  arrows?: Array<[string, string]>;
  /** The side at the bottom. Default: white, or black when only Black is to move. */
  orientation?: 'white' | 'black';
  /** Text for screen readers. Built from the position when left out. */
  label?: string;
}

export default function DiagramBoard({ fen, arrows = [], orientation = 'white', label }: DiagramBoardProps) {
  const flipped = orientation === 'black';
  const size = MARGIN + SQUARE * 8;
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  return (
    <svg
      viewBox={`0 0 ${size} ${size - MARGIN + 4}`}
      className="w-full max-w-[360px] h-auto rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
      role="img"
      aria-label={label ?? describeFen(fen)}
      data-testid="diagram"
    >
      <defs>
        <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 z" fill="#15781b" />
        </marker>
      </defs>
      {Array.from({ length: 64 }, (_, i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        return (
          <rect
            key={i}
            x={MARGIN + col * SQUARE}
            y={row * SQUARE}
            width={SQUARE}
            height={SQUARE}
            fill={(row + col) % 2 === 0 ? LIGHT : DARK}
          />
        );
      })}
      {ranks.split('').map((rank, row) => (
        <text key={rank} x={MARGIN - 1.2} y={row * SQUARE + SQUARE / 2 + 1} fontSize="2.8" textAnchor="end" fill="#9aa5b8">
          {rank}
        </text>
      ))}
      {files.split('').map((file, col) => (
        <text key={file} x={MARGIN + col * SQUARE + SQUARE / 2} y={SQUARE * 8 + 3.4} fontSize="2.8" textAnchor="middle" fill="#9aa5b8">
          {file}
        </text>
      ))}
      {piecesFromFen(fen).map((piece) => {
        const c = center(piece.square, flipped);
        if (!c) return null;
        return (
          <image
            key={piece.square}
            href={`/pieces/${PIECE_SET}/${piece.code}.svg`}
            x={c.x - SQUARE / 2}
            y={c.y - SQUARE / 2}
            width={SQUARE}
            height={SQUARE}
          />
        );
      })}
      {arrows.map(([from, to]) => {
        const a = center(from, flipped);
        const b = center(to, flipped);
        if (!a || !b) return null;
        // Stop short of the centre, so the head sits inside the square.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const end = { x: b.x - (dx / len) * 3.4, y: b.y - (dy / len) * 3.4 };
        return (
          <line
            key={from + to}
            x1={a.x}
            y1={a.y}
            x2={end.x}
            y2={end.y}
            stroke="#15781b"
            strokeOpacity="0.85"
            strokeWidth="1.6"
            strokeLinecap="round"
            markerEnd="url(#arrowhead)"
            data-testid="arrow"
          />
        );
      })}
    </svg>
  );
}
