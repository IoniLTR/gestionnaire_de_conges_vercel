"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";

export type DateRangeValue = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
};

type Props = {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  label?: string;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  /** Additional disable rule (e.g. weekends / public holidays) */
  disableDay?: (d: Date) => boolean;
  className?: string;
};

function parseYmd(ymd: string): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  // Date in local time to avoid timezone shifting on display
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function DateRangePicker({
  value,
  onChange,
  label,
  min,
  max,
  disableDay,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const fromDate = useMemo(() => parseYmd(value.from), [value.from]);
  const toDate = useMemo(() => parseYmd(value.to), [value.to]);
  const minDate = useMemo(() => parseYmd(min || ""), [min]);
  const maxDate = useMemo(() => parseYmd(max || ""), [max]);

  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    return fromDate || new Date();
  });

  useEffect(() => {
    if (fromDate) setCursorMonth(fromDate);
  }, [value.from]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const displayValue = useMemo(() => {
    if (!fromDate && !toDate) return "Sélectionner une période";
    if (fromDate && !toDate) return `${format(fromDate, "dd/MM/yyyy", { locale: fr })} → …`;
    if (fromDate && toDate) {
      return `${format(fromDate, "dd/MM/yyyy", { locale: fr })} → ${format(toDate, "dd/MM/yyyy", { locale: fr })}`;
    }
    return "Sélectionner une période";
  }, [fromDate, toDate]);

  const isDisabled = (d: Date) => {
    if (minDate && isBefore(d, minDate)) return true;
    if (maxDate && isAfter(d, maxDate)) return true;
    if (disableDay && disableDay(d)) return true;
    return false;
  };

  const pickDay = (d: Date) => {
    if (isDisabled(d)) return;

    // start new range
    if (!fromDate || (fromDate && toDate)) {
      const ymd = toYmd(d);
      onChange({ from: ymd, to: "" });
      return;
    }

    // complete range
    if (fromDate && !toDate) {
      const chosen = d;
      if (isBefore(chosen, fromDate)) {
        onChange({ from: toYmd(chosen), to: toYmd(fromDate) });
      } else {
        onChange({ from: toYmd(fromDate), to: toYmd(chosen) });
      }
    }
  };

  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = endOfMonth(cursorMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)) {
    days.push(d);
  }

  const inRange = (d: Date) => {
    if (!fromDate || !toDate) return false;
    return isWithinInterval(d, { start: fromDate, end: toDate });
  };

  const isEdge = (d: Date) => {
    if (!fromDate || !toDate) return false;
    return isSameDay(d, fromDate) || isSameDay(d, toDate);
  };

  return (
    <div ref={rootRef} className={className}>
      {label && (
        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">{label}</label>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:border-[#000091] transition"
      >
        <span className="truncate">{displayValue}</span>
        <span className="text-xl">📅</span>
      </button>

      {open && (
        <div className="mt-3 bg-white border border-gray-100 rounded-3xl shadow-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCursorMonth((m) => subMonths(m, 1))}
              className="w-10 h-10 text-[#000091] rounded-2xl bg-gray-50 hover:bg-gray-100 transition flex items-center justify-center"
              aria-label="Mois précédent"
            >
              ‹
            </button>
            <div className="font-[Modak] text-[#000091] text-xl">
              {format(cursorMonth, "MMMM yyyy", { locale: fr })}
            </div>
            <button
              type="button"
              onClick={() => setCursorMonth((m) => addMonths(m, 1))}
              className="w-10 h-10 text-[#000091] rounded-2xl bg-gray-50 hover:bg-gray-100 transition flex items-center justify-center"
              aria-label="Mois suivant"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-[#000091] uppercase mb-2">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-center py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const disabled = isDisabled(d);
              const outside = !isSameMonth(d, cursorMonth);
              const selectedEdge = isEdge(d);
              const selected = inRange(d);

              const base =
                "h-10 rounded-xl text-sm font-bold flex items-center text-black justify-center transition";

              let cls = `${base} `;
              if (disabled) cls += "opacity-30 cursor-not-allowed bg-gray-50";
              else if (selectedEdge)
                cls += "bg-[#000091] text-white shadow-sm";
              else if (selected)
                cls += "bg-[#000091]/10 text-[#000091]";
              else cls += "bg-white hover:bg-gray-50";

              if (outside) cls += " text-gray-300";

              return (
                <button
                  key={toYmd(d)}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(d)}
                  className={cls}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange({ from: "", to: "" });
              }}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 transition"
            >
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-2xl bg-[#000091] text-white font-bold text-sm hover:opacity-90 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
