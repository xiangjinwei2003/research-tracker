import { fmtMinutes } from "@/lib/date";
import type { BoardInsightsData } from "@/lib/boardInsights";

interface Props {
  data: BoardInsightsData;
  weekMinutes: number;
  onShowOpen: () => void;
  onShowOverdue: () => void;
  onShowToday: () => void;
  onReview: () => void;
}

export function BoardInsights({
  data,
  weekMinutes,
  onShowOpen,
  onShowOverdue,
  onShowToday,
  onReview,
}: Props) {
  const todayCount = data.deadlines.days[0]?.count ?? 0;
  const items = [
    { label: "未完成", value: String(data.tasks.open), onClick: onShowOpen },
    { label: "逾期", value: String(data.tasks.overdue), onClick: onShowOverdue },
    { label: "今天到期", value: String(todayCount), onClick: onShowToday },
    {
      label: "本周专注",
      value: fmtMinutes(weekMinutes),
      onClick: onReview,
    },
  ];

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="工作区概况">
      <span className="text-xs text-muted-foreground">全部进行中</span>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-muted-foreground">{item.label}</span>
          <strong className="tabular-nums">{item.value}</strong>
        </button>
      ))}
    </div>
  );
}
