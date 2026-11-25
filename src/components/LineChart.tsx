import { useState } from 'react';
import { niceMax } from './BarChart';

export interface LinePoint {
  /** Unique, e.g. "cycle-2". */
  key: string;
  /** Short label for the x axis ("1", "2"). */
  label: string;
  /** Long label for the tooltip and the table ("Cycle 2"). */
  fullLabel: string;
  value: number;
}

interface LineChartProps {
  id: string;
  title: string;
  subtitle: string;
  points: LinePoint[];
  /** Colour of the line and the dots (one series per chart). */
  color: string;
  /** "s per puzzle", "%"... for the tooltip and the table. */
  unit: string;
  /** Column header of the x axis in the table for screen readers. */
  xTitle: string;
  /** Bounds of the y axis. The top is rounded up from the highest value when `max` is left out. */
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
  /** A short line top right, e.g. "Best: 12.4 s". */
  badge?: string;
}

const HEIGHT = 170;
const DOT = 10;

function defaultFormat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * A plain line chart: one series, a thin line with a dot on every value, a faint grid, a tooltip on hover
 * (or touch) and a table for screen readers. The x positions are evenly spaced, one per data point.
 */
export default function LineChart({
  id,
  title,
  subtitle,
  points,
  color,
  unit,
  xTitle,
  min = 0,
  max,
  formatValue = defaultFormat,
  badge,
}: LineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const top = max ?? niceMax(Math.max(0, ...points.map((p) => p.value)));
  const span = Math.max(top - min, 1e-9);
  // Position of a point in percent of the plot: x in the middle of its column, y measured from the baseline.
  const xOf = (i: number) => ((i + 0.5) / n) * 100;
  const yOf = (value: number) => Math.min(100, Math.max(0, ((value - min) / span) * 100));
  const line = points.map((p, i) => `${xOf(i)},${100 - yOf(p.value)}`).join(' ');

  return (
    <section
      className="bg-[#16233b] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_16px_44px_rgba(4,9,20,0.45)]"
      data-testid={`chart-${id}`}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
          <p className="text-sm font-medium text-white/60">{subtitle}</p>
        </div>
        {badge && (
          <span className="text-sm font-semibold text-white/60 whitespace-nowrap" data-testid={`badge-${id}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div
          className="w-10 shrink-0 flex flex-col justify-between text-right text-xs font-medium text-white/50 tabular-nums"
          style={{ height: HEIGHT }}
          aria-hidden="true"
        >
          <span>{formatValue(top)}</span>
          <span>{formatValue(min + span / 2)}</span>
          <span>{formatValue(min)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setActive(null)}>
            {[0, 50, 100].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-dashed border-white/10"
                style={{ bottom: `${pct}%` }}
                aria-hidden="true"
              />
            ))}

            {n > 1 && (
              <svg
                className="absolute inset-0 w-full h-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={line}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            <div className="absolute inset-0 flex" aria-hidden="true">
              {points.map((p, i) => {
                const y = yOf(p.value);
                return (
                  <div
                    key={p.key}
                    className="relative flex-1 h-full"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(i)}
                    data-testid={`column-${id}`}
                  >
                    <span
                      className="absolute left-1/2 rounded-full"
                      style={{
                        width: DOT,
                        height: DOT,
                        bottom: `calc(${y}% - ${DOT / 2}px)`,
                        transform: 'translateX(-50%)',
                        backgroundColor: color,
                        boxShadow: '0 0 0 2px #16233b',
                        opacity: active === null || active === i ? 1 : 0.6,
                      }}
                      data-testid={`dot-${id}`}
                    />
                    {active === i && (
                      <div
                        className={`absolute z-10 px-2.5 py-1.5 rounded-lg bg-[#0d1627] border border-white/15 text-xs font-semibold text-white whitespace-nowrap shadow-lg pointer-events-none ${
                          n > 2 && i === 0 ? 'left-0' : n > 2 && i === n - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        }`}
                        style={{ bottom: `calc(${Math.min(y, 78)}% + 12px)` }}
                        role="tooltip"
                        data-testid={`tooltip-${id}`}
                      >
                        {p.fullLabel}: {formatValue(p.value)} {unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex" aria-hidden="true">
            {points.map((p) => (
              <div key={p.key} className="flex-1 text-center text-xs font-medium text-white/60 whitespace-nowrap">
                {p.label}
              </div>
            ))}
          </div>
          <p className="mt-0.5 text-center text-xs font-medium text-white/40" aria-hidden="true">
            {xTitle}
          </p>
        </div>
      </div>

      <table className="sr-only" data-testid={`table-${id}`}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{xTitle}</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.fullLabel}</th>
              <td>{formatValue(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
