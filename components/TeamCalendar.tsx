"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";

export type CalendarEvent = {
  id: number;
  title: string; // ex: "Prénom Nom"
  type: string;  // libellé (utilisé pour la couleur)
  start: string; // ISO
  end: string;   // ISO
  // infos optionnelles (admin)
  meta?: {
    statut?: string;
    nature?: string;
    motif?: string;
    justificatif?: string;
    userId?: number;
  };
};

const TYPE_COLOR: Record<string, string> = {
  "Congés Payés": "bg-[#000091] text-white",
  "Congé spécifique": "bg-[#ff6400] text-white",
  "Arrêt Maladie": "bg-black text-white",
  "Heures Supplémentaire": "bg-[#ff6400] text-white",
};

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function dayLabel(d: Date) {
  return format(d, "d");
}

function normalize(d: Date) {
  // midday to avoid DST edge cases
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function fmtRange(startIso: string, endIso: string) {
  if (!startIso || !endIso) return "-";
  const s = new Date(startIso);
  const e = new Date(endIso);
  const ds = `${String(s.getDate()).padStart(2, "0")}/${String(s.getMonth() + 1).padStart(2, "0")}`;
  const de = `${String(e.getDate()).padStart(2, "0")}/${String(e.getMonth() + 1).padStart(2, "0")}`;
  const ts = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
  const te = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
  if (ds === de) return `${ds} • ${ts} → ${te}`;
  return `${ds} ${ts} → ${de} ${te}`;
}

export default function TeamCalendar({
  events,
  className,
  mode = "user",
  title = "Calendrier des absences (validées)",
}: {
  events: CalendarEvent[];
  className?: string;
  mode?: "admin" | "user";
  title?: string;
}) {
  const [cursorMonth, setCursorMonth] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<string>("");

  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = endOfMonth(cursorMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (
    let d = gridStart;
    d <= gridEnd;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)
  ) {
    days.push(d);
  }

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const start = normalize(new Date(ev.start));
      const end = normalize(new Date(ev.end));
      for (const d of days) {
        const nd = normalize(d);
        if (isWithinInterval(nd, { start, end })) {
          const key = dayKey(nd);
          map.set(key, [...(map.get(key) || []), ev]);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, cursorMonth]);

  const selectedEvents = useMemo(() => {
    if (!selected) return [];
    return byDay.get(selected) || [];
  }, [byDay, selected]);

  return (
    <div className={className}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-[Modak] text-[#000091] leading-none">
              {title}
            </h3>
            <p className="text-xs text-gray-400 font-medium mt-1">
              Cliquez sur un jour pour voir les absences validées.
            </p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCursorMonth((m) => subMonths(m, 1))}
              className="w-9 h-9 sm:w-10 text-[#000091] sm:h-10 rounded-2xl bg-gray-50 hover:bg-gray-100 transition flex items-center justify-center flex-none"
              aria-label="Mois précédent"
            >
              ‹
            </button>
            <div className="font-bold text-[#000091] text-center capitalize flex-1 sm:flex-none sm:min-w-[150px]">
              {format(cursorMonth, "MMMM yyyy", { locale: fr })}
            </div>
            <button
              type="button"
              onClick={() => setCursorMonth((m) => addMonths(m, 1))}
              className="w-9 h-9 sm:w-10 text-[#000091] sm:h-10 rounded-2xl bg-gray-50 hover:bg-gray-100 transition flex items-center justify-center flex-none"
              aria-label="Mois suivant"
            >
              ›
            </button>
          </div>
        </div>

        {/* ✅ Responsive : sur mobile, le calendrier reste lisible via scroll horizontal */}
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[520px] sm:min-w-[560px]">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] font-bold text-gray-400 uppercase mb-2">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="text-center py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((d) => {
            const key = dayKey(d);
            const outside = !isSameMonth(d, cursorMonth);
            const isToday = isSameDay(d, new Date());
            const evs = byDay.get(key) || [];
            const has = evs.length > 0;
            const isSel = selected === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={
                  "relative h-16 sm:h-20 rounded-2xl border transition text-left p-2 " +
                  (isSel
                    ? "border-[#000091] shadow-sm"
                    : "border-gray-100 hover:border-gray-200") +
                  (outside ? " opacity-40" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <div
                    className={
                      "text-sm font-bold " +
                      (isToday ? "text-[#ff6400]" : "text-gray-700")
                    }
                  >
                    {dayLabel(d)}
                  </div>
                  {has && (
                    <div className="text-[10px] font-bold text-gray-400">
                      {evs.length}
                    </div>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {evs.slice(0, 2).map((ev) => (
                    <div
                      key={`${key}-${ev.id}`}
                      className={
                        "truncate px-2 py-1 rounded-xl text-[10px] font-bold " +
                        (TYPE_COLOR[ev.type] || "bg-gray-200 text-gray-700")
                      }
                      title={`${ev.title} • ${ev.type}`}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {evs.length > 2 && (
                    <div className="text-[10px] font-bold text-gray-400">
                      +{evs.length - 2} autre(s)
                    </div>
                  )}
                </div>
              </button>
            );
          })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {Object.entries(TYPE_COLOR).map(([t, cls]) => (
            <div
              key={t}
              className={
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase " + cls
              }
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Modal jour */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Absences validées</div>
                <h4 className="text-2xl font-[Modak] text-[#000091] leading-none mt-1">{selected}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelected("")}
                className="px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-600 transition"
              >
                Fermer
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune absence validée.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-[#f8f9fc] rounded-2xl p-4 border border-gray-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-700 truncate">{ev.title}</div>
                          <div className="text-xs text-gray-400 font-bold mt-1">{fmtRange(ev.start, ev.end)}</div>
                        </div>
                        <span
                          className={
                            "shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase " +
                            (TYPE_COLOR[ev.type] || "bg-gray-200 text-gray-700")
                          }
                        >
                          {ev.type}
                        </span>
                      </div>

                      {mode === "admin" && (ev.meta?.nature || ev.meta?.motif) && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {ev.meta?.nature && (
                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                              <div className="text-[10px] font-bold text-gray-400 uppercase">Nature</div>
                              <div className="font-bold text-gray-700 mt-1">{ev.meta.nature}</div>
                            </div>
                          )}
                          {ev.meta?.motif && (
                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                              <div className="text-[10px] font-bold text-gray-400 uppercase">Motif</div>
                              <div className="font-bold text-gray-700 mt-1">{ev.meta.motif}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 text-[11px] text-gray-400 font-bold">
              Cliquez sur un autre jour pour changer • Échap / Fermer pour quitter
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
