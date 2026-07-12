export function ProgressRing({
  done,
  total,
  size = 72,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.min(done / total, 1) : 0;

  return (
    <svg width={size} height={size} role="img" aria-label={`${done} of ${total} done`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-black/10 dark:stroke-white/15"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={`transition-[stroke-dashoffset] duration-700 ease-out ${
          fraction >= 1
            ? "stroke-emerald-500"
            : "stroke-black dark:stroke-white"
        }`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-current text-sm font-bold"
      >
        {fraction >= 1 ? "✓" : `${done}/${total}`}
      </text>
    </svg>
  );
}
