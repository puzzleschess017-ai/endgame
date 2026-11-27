import { useState } from 'react';

export interface BarDatum {
  /** Unique, e.g. the day "2026-11-24". */
  key: string;
  /** Short label for the x axis ("Fri", "24 Nov"). */
  label: string;
  /** Long label for the tooltip and the table ("Fri 24 Nov"). */
  fullLabel: string;
  /** null = no data that day (no bar, shown as a dash in the table). */
  value: number | null;
}

interface BarChartProps {
  id: string;
  title: string;
  subtitle: string;
  data: BarDatum[];
  /** Colour of the bars (one series per chart). */
  color: string;
  /** "sessions", "min", "%"... for the tooltip and the table. */
  unit: string;
  /** Fixed top of the y axis (100 for percentages). Otherwise rounded up from the highest bar. */
  fixedMax?: number;
  formatValue?: (value: number) => string;
  emptyText: string;
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Smallest "round" number that is at least `max` (29 -> 30, 6 -> 6, 7 -> 8). */
export function niceMax(max: number): number {
  if (max <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const n of NICE) {
    if (n * pow >= max) return n * pow;
  }
  return 10 * pow;
}

function defaultFormat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * A plain bar chart: one series, thin bars with rounded tops sitting on the baseline, a faint grid,
 * a tooltip on hover and a table for screen readers.
 */
export default function BarChart({
  id,
  title,
  subtitle,
  data,
  color,
  unit,
  fixedMax,
  formatValue = defaultFormat,
  emptyText,
}: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const values = data.map((d) => d.value ?? 0);
  const peak = Math.max(0, ...values);
  const top = fixedMax ?? niceMax(peak);
  const hasData = peak > 0;
  // About six labels on the x axis, always including the last (today).
  const every = data.length <= 7 ? 1 : Math.ceil(data.length / 6);
  const showLabel = (i: number) => (data.length - 1 - i) % every === 0;

  return (
    <section
      className="bg-card border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_16px_44px_rgba(131,24,67,0.14)]"
      data-testid={`chart-${id}`}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
          <p className="text-sm font-medium text-white/60">{subtitle}</p>
        </div>
        {hasData && (
          <span className="text-sm font-semibold text-white/60 whitespace-nowrap" data-testid={`peak-${id}`}>
            Peak: {formatValue(peak)}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div
          className="w-9 shrink-0 flex flex-col justify-between text-right text-xs font-medium text-white/50 tabular-nums h-[170px]"
          aria-hidden="true"
        >
          <span>{formatValue(top)}</span>
          <span>{formatValue(top / 2)}</span>
          <span>0</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative h-[170px]" onMouseLeave={() => setActive(null)}>
            {[0, 50, 100].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-dashed border-white/10"
                style={{ bottom: `${pct}%` }}
                aria-hidden="true"
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-[3px]" aria-hidden="true">
              {data.map((d, i) => {
                const value = d.value ?? 0;
                const height = value > 0 ? Math.max(2, (value / top) * 100) : 0;
                return (
                  <div
                    key={d.key}
                    className="relative flex-1 h-full flex items-end justify-center"
                    onMouseEnter={() => setActive(i)}
                  >
                    {value > 0 && (
                      <div
                        className="w-full max-w-[44px] rounded-t-[4px] transition-[height] duration-200"
                        style={{
                          height: `${height}%`,
                          backgroundColor: color,
                          opacity: active === null || active === i ? 1 : 0.55,
                        }}
                        data-testid={`bar-${id}`}
                      />
                    )}
                    {active === i && (
                      <div
                        className={`absolute z-10 px-2.5 py-1.5 rounded-lg bg-card border border-white/15 text-xs font-semibold text-white whitespace-nowrap shadow-lg pointer-events-none ${
                          i < 2 ? 'left-0' : i > data.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        }`}
                        style={{ bottom: `calc(${height}% + 8px)` }}
                        role="tooltip"
                        data-testid={`tooltip-${id}`}
                      >
                        {d.fullLabel}: {d.value === null ? 'no data' : `${formatValue(d.value)} ${unit}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/50 text-center px-4">
                {emptyText}
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-[3px]" aria-hidden="true">
            {data.map((d, i) => (
              <div key={d.key} className="relative flex-1 h-4">
                {showLabel(i) && (
                  <span className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-white/60 whitespace-nowrap">
                    {d.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only" data-testid={`table-${id}`}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.fullLabel}</th>
              <td>{d.value === null ? '–' : formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
