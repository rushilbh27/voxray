interface EvalBadgeProps {
  totalFlags: number;
  fpCount:    number;
}

export function EvalBadge({ totalFlags, fpCount }: EvalBadgeProps) {
  if (totalFlags === 0) return null;

  const precision = Math.round(((totalFlags - fpCount) / totalFlags) * 100);
  const fpRate    = Math.round((fpCount / totalFlags) * 100);

  const level =
    fpRate < 5  ? 'solid'  :
    fpRate < 20 ? 'watch'  :
    'review';

  const cfg = {
    solid:  { emoji: '🟢', cls: 'bg-ok-bg text-ok border-ok-border'       },
    watch:  { emoji: '🟡', cls: 'bg-warn-bg text-warn border-warn-border' },
    review: { emoji: '🔴', cls: 'bg-crit-bg text-crit border-crit-border' },
  }[level];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium border rounded-md ${cfg.cls}`}
      title={`${totalFlags} flags · ${fpCount} FP · ${precision}% precision`}
    >
      {cfg.emoji} {precision}%
    </span>
  );
}
