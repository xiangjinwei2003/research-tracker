import { useMemo } from "react";
import { fmtMinutes } from "@/lib/date";
import { buildHomeOutlook, FREE_KEY } from "@/lib/homeOutlook";
import type { OutlookDay, OutlookMark } from "@/lib/homeOutlook";
import type { FocusSession, Project } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  projects: Project[];
  sessions: FocusSession[];
  todayIso: string;
  nowMs: number;
  onOpenDay: (iso: string) => void;
  onShowOverdue: () => void;
  onOpenProject: (id: string) => void;
  onReview: () => void;
}

export function HomeOutlook({
  projects,
  sessions,
  todayIso,
  nowMs,
  onOpenDay,
  onOpenProject,
  onReview,
}: Props) {
  const outlook = useMemo(
    () => buildHomeOutlook(projects, sessions, todayIso, nowMs),
    [projects, sessions, todayIso, nowMs],
  );
  const maxMinutes = Math.max(...outlook.days.map((day) => day.minutes), 0);

  return (
    <div className="outlook-band" data-outlook-band>
      <button
        type="button"
        data-outlook-panel="focus"
        onClick={onReview}
        aria-label={`专注 ${fmtMinutes(outlook.totalMinutes)}，打开回顾`}
        className="outlook-panel"
      >
        <div className="outlook-plot" data-focus-plot>
          {outlook.days.map((day) => (
            <DayBar key={day.iso} day={day} maxMinutes={maxMinutes} />
          ))}
        </div>
      </button>

      <section
        className="outlook-panel"
        data-outlook-panel="share"
        aria-label="占比"
      >
        {outlook.share.length === 0 ? (
          <div className="outlook-share" />
        ) : (
          <div className="outlook-share">
            {outlook.share.map((row) => (
              <button
                key={row.key}
                type="button"
                aria-label={`${row.name} ${fmtMinutes(row.minutes)}`}
                onClick={() =>
                  row.key === FREE_KEY ? onReview() : onOpenProject(row.key)
                }
                style={{
                  flexGrow: row.minutes,
                  flexBasis: 0,
                  background: row.color,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section
        className="outlook-panel"
        data-outlook-panel="calendar"
        aria-label="临近"
      >
        <div className="outlook-cal">
          {outlook.calendar.map((item) => (
            <button
              key={item.iso}
              type="button"
              aria-label={item.detail}
              onClick={() => onOpenDay(item.iso)}
              className={cn(
                "outlook-day",
                item.isToday && "is-today",
                item.isPast && "is-past",
              )}
            >
              {item.marks.slice(0, 4).map((mark) => (
                <Tick key={`${mark.kind}-${mark.key}`} mark={mark} />
              ))}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DayBar({ day, maxMinutes }: { day: OutlookDay; maxMinutes: number }) {
  return (
    <div className="outlook-col" aria-hidden="true">
      {day.minutes > 0 ? (
        <div
          className="outlook-stack"
          style={{
            height: `${Math.max((day.minutes / maxMinutes) * 100, 8)}%`,
          }}
        >
          {day.parts.map((part) => (
            <div
              key={part.key}
              style={{
                flexGrow: part.minutes,
                flexBasis: 0,
                minHeight: 2,
                background: part.color,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="outlook-baseline" />
      )}
    </div>
  );
}

function Tick({ mark }: { mark: OutlookMark }) {
  return (
    <span
      className="outlook-tick"
      style={{
        height: mark.kind === "deadline" ? 6 : 3,
        background: mark.color,
      }}
    />
  );
}
