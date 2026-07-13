"use client";

/**
 * components/ui/basic-calendar.tsx
 *
 * Self-contained month-grid date picker — a drop-in replacement for
 * react-day-picker's <Calendar mode="single"> used across this app.
 *
 * Why this exists:
 *   react-day-picker calls React.createContext() at module top-level. During a
 *   static export (output: "export") Next prerenders every page on the server,
 *   where React's server build has no createContext —— causing
 *   "TypeError: k.createContext is not a function" at build time. This component
 *   has zero React context / zero external deps, so it is safe to render on the
 *   server and stays statically exportable.
 *
 * Supported props (matches the subset the app uses):
 *   selected:    Date | undefined
 *   onSelect:    (date: Date) => void
 *   disabled?:   boolean | ((date: Date) => boolean)
 *   initialFocus?: boolean   (no-op placeholder for API parity)
 *   className?:  string
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export interface BasicCalendarProps {
  /** Kept for API parity with react-day-picker; only "single" mode is supported. */
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date) => void;
  disabled?: boolean | ((date: Date) => boolean);
  initialFocus?: boolean;
  className?: string;
}

export function Calendar({
  selected,
  onSelect,
  disabled,
  className,
}: BasicCalendarProps) {
  const today = startOfDay(new Date());
  const [view, setView] = React.useState<Date>(() =>
    selected ? new Date(selected) : today
  );

  // Keep the visible month in sync if the selected date changes externally.
  React.useEffect(() => {
    if (selected) setView(new Date(selected));
  }, [selected]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startingWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startingWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const isDisabled = (date: Date): boolean => {
    if (disabled === undefined) return false;
    if (typeof disabled === "boolean") return disabled;
    return disabled(date);
  };

  const goPrevMonth = () => setView(new Date(year, month - 1, 1));
  const goNextMonth = () => setView(new Date(year, month + 1, 1));

  return (
    <div className={cn("w-[280px] p-3 select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={goPrevMonth}
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {MONTHS[month]} {year}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={goNextMonth}
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ›
        </button>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="h-8 flex items-center justify-center text-xs font-medium text-slate-400"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="h-9" />;

          const disabledDay = isDisabled(date);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabledDay}
              onClick={() => !disabledDay && onSelect?.(date)}
              className={cn(
                "h-9 w-9 mx-auto flex items-center justify-center rounded-md text-sm transition-colors",
                "hover:bg-indigo-50 dark:hover:bg-slate-800",
                isSelected
                  ? "bg-indigo-600 text-white hover:bg-indigo-600 font-semibold"
                  : "text-slate-700 dark:text-slate-200",
                !isSelected && isToday && "border border-indigo-400 text-indigo-600",
                disabledDay && "text-slate-300 dark:text-slate-600 cursor-not-allowed hover:bg-transparent"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;
