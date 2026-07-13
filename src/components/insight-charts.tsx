import { formatSGD } from "@/lib/money";
import type { HeatmapDay, RelationshipPoint } from "@/lib/insights";

export function HabitHeatmap({ days }: { days: HeatmapDay[] }) {
  return (
    <div role="img" aria-label="Daily habit completion over the last 12 weeks">
      <div className="w-fit max-w-full">
        <div
          className="grid grid-flow-col gap-1 overflow-x-auto pb-1"
          style={{ gridTemplateRows: "repeat(7, 18px)", gridAutoColumns: "18px" }}
        >
          {days.map((day) => {
            const color =
              day.rate === null
                ? "bg-black/[.03] dark:bg-white/[.04]"
                : day.rate === 0
                  ? "bg-black/10 dark:bg-white/10"
                  : day.rate < 0.5
                    ? "bg-emerald-300 dark:bg-emerald-900"
                    : day.rate < 1
                      ? "bg-emerald-500 dark:bg-emerald-600"
                      : "bg-emerald-700 dark:bg-emerald-400";
            return (
              <span
                key={day.day}
                title={`${day.day}: ${day.total ? `${day.checked}/${day.total} habits` : "no active habits"}`}
                className={`size-[18px] rounded-[3px] ${color}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-black/40 dark:text-white/40">
          <span>12 weeks ago</span>
          <span>today</span>
        </div>
      </div>
    </div>
  );
}

export function WeeklySpendChart({
  weeks,
}: {
  weeks: { label: string; amount: number }[];
}) {
  const width = 560;
  const height = 190;
  const left = 12;
  const top = 16;
  const bottom = 42;
  const plotHeight = height - top - bottom;
  const slot = (width - left * 2) / weeks.length;
  const barWidth = slot * 0.58;
  const max = Math.max(...weeks.map((week) => week.amount), 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Weekly spending for eight weeks: ${weeks
        .map((week) => `${week.label} ${formatSGD(week.amount)}`)
        .join(", ")}`}
    >
      <line
        x1={left}
        y1={top + plotHeight}
        x2={width - left}
        y2={top + plotHeight}
        className="stroke-black/10 dark:stroke-white/10"
      />
      {weeks.map((week, index) => {
        const barHeight = week.amount ? Math.max(3, (week.amount / max) * plotHeight) : 2;
        const x = left + index * slot + (slot - barWidth) / 2;
        const y = top + plotHeight - barHeight;
        return (
          <g key={week.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="4"
              className={
                index === weeks.length - 1
                  ? "fill-emerald-500"
                  : "fill-black/60 dark:fill-white/60"
              }
            />
            {week.amount > 0 && (
              <text
                x={x + barWidth / 2}
                y={Math.max(11, y - 5)}
                textAnchor="middle"
                className="fill-black/55 text-[9px] dark:fill-white/55"
              >
                {week.amount >= 1000
                  ? `${(week.amount / 1000).toFixed(1)}k`
                  : Math.round(week.amount)}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height - 18}
              textAnchor="middle"
              className="fill-black/45 text-[9px] dark:fill-white/45"
            >
              {week.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function regression(points: RelationshipPoint[]) {
  if (points.length < 2) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }
  if (denominator === 0) return null;
  const slope = numerator / denominator;
  return { slope, intercept: meanY - slope * meanX };
}

export function RelationshipChart({
  points,
  xMin,
  xMax,
  xStartLabel,
  xEndLabel,
  xLabel,
}: {
  points: RelationshipPoint[];
  xMin: number;
  xMax: number;
  xStartLabel: string;
  xEndLabel: string;
  xLabel: string;
}) {
  const width = 560;
  const height = 220;
  const left = 38;
  const right = 18;
  const top = 15;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const safeRange = xMax - xMin || 1;
  const x = (value: number) => left + ((value - xMin) / safeRange) * plotWidth;
  const y = (value: number) => top + ((5 - value) / 4) * plotHeight;
  const trend = regression(points);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${points.length} observations comparing ${xLabel} with mood from one to five`}
    >
      {[1, 2, 3, 4, 5].map((mood) => (
        <g key={mood}>
          <line
            x1={left}
            y1={y(mood)}
            x2={width - right}
            y2={y(mood)}
            className="stroke-black/[.07] dark:stroke-white/[.07]"
          />
          <text
            x={left - 9}
            y={y(mood) + 3}
            textAnchor="end"
            className="fill-black/40 text-[9px] dark:fill-white/40"
          >
            {mood}
          </text>
        </g>
      ))}
      {trend && (
        <line
          x1={x(xMin)}
          y1={y(Math.max(1, Math.min(5, trend.intercept + trend.slope * xMin)))}
          x2={x(xMax)}
          y2={y(Math.max(1, Math.min(5, trend.intercept + trend.slope * xMax)))}
          className="stroke-emerald-500"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      )}
      {points.map((point, index) => (
        <circle
          key={`${point.day}-${index}`}
          cx={x(Math.max(xMin, Math.min(xMax, point.x)))}
          cy={y(point.y)}
          r="5"
          className="fill-black/65 dark:fill-white/70"
        >
          <title>{`${point.day}: ${xLabel} ${point.x.toFixed(1)}, mood ${point.y}`}</title>
        </circle>
      ))}
      <text
        x={left}
        y={height - 20}
        textAnchor="start"
        className="fill-black/40 text-[9px] dark:fill-white/40"
      >
        {xStartLabel}
      </text>
      <text
        x={width - right}
        y={height - 20}
        textAnchor="end"
        className="fill-black/40 text-[9px] dark:fill-white/40"
      >
        {xEndLabel}
      </text>
      <text
        x={left + plotWidth / 2}
        y={height - 5}
        textAnchor="middle"
        className="fill-black/50 text-[10px] dark:fill-white/50"
      >
        {xLabel}
      </text>
    </svg>
  );
}
