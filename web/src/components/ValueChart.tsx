import { useTranslation } from 'react-i18next';

export interface ValueChartPoint {
  label: string;
  value: number;
}

interface ValueChartProps {
  points: ValueChartPoint[];
  type: 'line' | 'bar';
  locale: string;
}

const WIDTH = 400;
const HEIGHT = 180;
const MARGIN = { top: 10, right: 12, bottom: 24, left: 44 };

interface ChartItem {
  label: string;
  value: number;
  time: number;
}

export default function ValueChart({ points, type, locale }: ValueChartProps) {
  const { t } = useTranslation();
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const plotBottom = MARGIN.top + innerHeight;

  const items: ChartItem[] = points
    .map((point) => ({ label: point.label, value: point.value, time: new Date(point.label).getTime() }))
    .sort((a, b) => a.time - b.time);

  const timesValid = items.every((item) => !Number.isNaN(item.time));
  const timeMin = timesValid ? items[0].time : NaN;
  const timeMax = timesValid ? items[items.length - 1].time : NaN;
  const timeSpanned = timesValid && timeMax > timeMin;

  const rawMin = Math.min(...points.map((p) => p.value));
  const rawMax = Math.max(...points.map((p) => p.value));
  let lo = rawMin;
  let hi = rawMax;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  } else {
    const pad = (hi - lo) * 0.15;
    lo -= pad;
    hi += pad;
  }

  const xFor = (index: number, time: number) => {
    if (timeSpanned) {
      return MARGIN.left + ((time - timeMin) / (timeMax - timeMin)) * innerWidth;
    }
    return MARGIN.left + (items.length === 1 ? innerWidth / 2 : (index / (items.length - 1)) * innerWidth);
  };
  const yFor = (value: number) => MARGIN.top + ((hi - value) / (hi - lo)) * innerHeight;

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: MARGIN.top + fraction * innerHeight,
    value: hi - fraction * (hi - lo),
  }));

  const labelStep = items.length > 5 ? Math.ceil(items.length / 5) : 1;

  function axisLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return dateFormat.format(date);
  }

  const linePoints = items.map((item, i) => `${xFor(i, item.time)},${yFor(item.value)}`).join(' ');
  const barWidth = Math.max(2, (innerWidth / items.length) * 0.6);

  return (
    <svg
      className="value-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t('notes.chartAria', { count: items.length })}
    >
      {gridLines.map((line) => (
        <g key={line.value}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={line.y}
            y2={line.y}
            className="chart-grid-line"
          />
          <text x={MARGIN.left - 6} y={line.y + 4} textAnchor="end" className="chart-axis-label">
            {numberFormat.format(line.value)}
          </text>
        </g>
      ))}
      {items.map((item, i) => {
        if (i % labelStep !== 0 && i !== items.length - 1) return null;
        return (
          <text key={i} x={xFor(i, item.time)} y={HEIGHT - 8} textAnchor="middle" className="chart-axis-label">
            {axisLabel(item.label)}
          </text>
        );
      })}
      {type === 'line' ? (
        <g>
          <polyline points={linePoints} className="chart-line" />
          {items.map((item, i) => (
            <circle key={i} cx={xFor(i, item.time)} cy={yFor(item.value)} r={3} className="chart-dot" />
          ))}
        </g>
      ) : (
        items.map((item, i) => (
          <rect
            key={i}
            x={xFor(i, item.time) - barWidth / 2}
            y={yFor(item.value)}
            width={barWidth}
            height={plotBottom - yFor(item.value)}
            className="chart-bar"
          />
        ))
      )}
    </svg>
  );
}
