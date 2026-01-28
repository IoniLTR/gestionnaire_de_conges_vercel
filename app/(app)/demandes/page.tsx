"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DateRangePicker, { DateRangeValue } from "@/components/DateRangePicker";

const demandeTypes = [
  { value: "conge", label: "Congé Payé" },
  { value: "maladie", label: "Arrêt Maladie" },
  { value: "hsup", label: "Récupération" },
  { value: "specifique", label: "Congé Spécifique" },
];

interface User {
  id_user: number;
  poste?: string;
  solde_conge?: number;
  solde_hsup?: number;
  nom?: string;
  prenom?: string;
}

interface HistoryItem {
  id_historique: number;
  type_solde: string;
  valeur_modif: number;
  nouveau_solde: number;
  date_modif: string;
  actor_nom: string;
  actor_prenom: string;
  motif?: string;
  date_action?: string;
  duree_reelle?: number;
}

// Liste Heures (pour la sélection rapide)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function formatHeures(decimal: number | string): string {
  const val = typeof decimal === "string" ? parseFloat(decimal) : decimal;
  if (isNaN(val) || val === 0) return "0h";
  const heures = Math.floor(Math.abs(val));
  const minutes = Math.round((Math.abs(val) - heures) * 60);
  const signe = val < 0 ? "-" : "";
  if (minutes === 0) return `${signe}${heures}h`;
  return `${signe}${heures}h${String(minutes).padStart(2, "0")}`;
}

function formatJours(decimal: number | string): string {
  const val = typeof decimal === "string" ? parseFloat(decimal) : decimal;
  if (isNaN(val)) return "0";
  return Number(val).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getHistoryLabel(type: string) {
  switch (type) {
    case "conge":
      return "Ajustement Manuel";
    case "hsup":
      return "Heures Supp. (Calculé)";
    case "conge_accepte":
      return "Congés Accepté";
    case "hsup_accepte":
      return "Heures Accepté";
    default:
      return type;
  }
}

function clampTimeToWindow(totalMinutes: number) {
  const min = 8 * 60;
  const max = 19 * 60;
  return Math.max(min, Math.min(max, totalMinutes));
}

function parseTimeToMinutes(input: string) {
  const m = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return h * 60 + min;
}

function minutesToTimeStr(total: number) {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// --- Weekends + jours fériés FR (métropole) ---
function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toYmdLocal(d: Date) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function getHolidaySet(year: number) {
  const set = new Set<string>([
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
  const easter = easterSunday(year);
  const add = (days: number) => {
    const x = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + days, 12, 0, 0, 0);
    set.add(toYmdLocal(x));
  };
  add(1);   // Lundi de Pâques
  add(39);  // Ascension
  add(50);  // Lundi de Pentecôte
  return set;
}

function isHolidayOrWeekendYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (isWeekend(date)) return true;
  return getHolidaySet(y).has(ymd);
}

function firstBlockedInRange(from: string, to: string) {
  const [y1, m1, d1] = from.split("-").map((x) => parseInt(x, 10));
  const [y2, m2, d2] = to.split("-").map((x) => parseInt(x, 10));
  const start = new Date(y1, m1 - 1, d1, 12, 0, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0, 0);
  for (let cur = start; cur.getTime() <= end.getTime(); cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 12, 0, 0, 0)) {
    const ymd = toYmdLocal(cur);
    if (isHolidayOrWeekendYmd(ymd)) return ymd;
  }
  return null;
}

// ✅ Autoriser les plages qui contiennent des week-ends / jours fériés,
//    mais ne compter que les jours ouvrés (pour le débit de congés).
function countWorkingDaysInRange(from: string, to: string) {
  const [y1, m1, d1] = from.split("-").map((x) => parseInt(x, 10));
  const [y2, m2, d2] = to.split("-").map((x) => parseInt(x, 10));
  const start = new Date(y1, m1 - 1, d1, 12, 0, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0, 0);

  let count = 0;
  for (
    let cur = start;
    cur.getTime() <= end.getTime();
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 12, 0, 0, 0)
  ) {
    const ymd = toYmdLocal(cur);
    if (!isHolidayOrWeekendYmd(ymd)) count++;
  }
  return count;
}

/** Arrondi à 15min (au dessus OU dessous -> le plus proche) */
function roundToQuarter(input: string) {
  const mins = parseTimeToMinutes(input);
  if (mins === null) return input;
  const clamped = clampTimeToWindow(mins);
  const q = 15;
  const down = Math.floor(clamped / q) * q;
  const up = Math.ceil(clamped / q) * q;
  const nearest = (clamped - down) <= (up - clamped) ? down : up;
  return minutesToTimeStr(nearest);
}

export default function DemandesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState("");
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [periodStart, setPeriodStart] = useState("matin");
  const [periodEnd, setPeriodEnd] = useState("soir");
  const [justificatifFile, setJustificatifFile] = useState<File | null>(null);
  const [justificatifText, setJustificatifText] = useState("");
  const [nature, setNature] = useState("");

  // Récupération (Heures): 08:00 -> 19:00
  const [timeStart, setTimeStart] = useState("08:00");
  const [timeEnd, setTimeEnd] = useState("19:00");

  // Ajustement solde (comme dashboard)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetType, setTargetType] = useState<"conge" | "hsup">("conge");
  const [variation, setVariation] = useState<string>("");
  const [motif, setMotif] = useState<string>("");
  const [dateOnly, setDateOnly] = useState<string>("");
  const [hourOnly, setHourOnly] = useState<string>("09");

  // Historique
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetch("/api/profil")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      });
  }, []);

  const TIME_OPTIONS = useMemo(
    () =>
      Array.from({ length: (19 - 8) * 4 + 1 }, (_, i) => {
        const total = 8 * 60 + i * 15;
        return minutesToTimeStr(total);
      }),
    []
  );

  const openHistory = async () => {
    if (!user) return;
    setIsHistoryOpen(true);
    const res = await fetch(`/api/solde-history?userId=${user.id_user}`);
    const data = await res.json();
    setHistoryLogs(data.success ? data.history : []);
  };

  const handleUpdateSolde = async () => {
    const val = parseFloat(variation.replace(",", "."));
    if (!user || isNaN(val) || val === 0) return;

    let finalDateTime = undefined;

    // même règle que dashboards: pour + heures sup -> motif + date obligatoires
    if (targetType === "hsup" && val > 0) {
      if (!motif || motif.trim() === "") {
        alert("Motif obligatoire.");
        return;
      }
      if (!dateOnly) {
        alert("La date est obligatoire.");
        return;
      }
      finalDateTime = `${dateOnly}T${hourOnly}:00`;
    }

    try {
      const res = await fetch("/api/update-solde", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: user.id_user,
          type: targetType,
          variation: val,
          motif: targetType === "hsup" && val > 0 ? motif : undefined,
          dateAction: targetType === "hsup" && val > 0 ? finalDateTime : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(
          `Enregistré ! Crédit ajouté : ${
            data.added ? formatHeures(data.added) : "Ok"
          }`
        );
        setIsModalOpen(false);
        setVariation("");
        setMotif("");
        setDateOnly("");
        setHourOnly("09");

        const res2 = await fetch("/api/profil");
        const data2 = await res2.json();
        setUser(data2.user);
      } else {
        alert("Erreur : " + data.error);
      }
    } catch {
      alert("Erreur technique");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!type || !range.from || !range.to) return alert("Champs manquants");

    // ✅ On autorise une plage qui contient des week-ends / jours fériés.
    //    On bloque seulement si la période ne contient AUCUN jour ouvré.
    if (type === "conge" || type === "specifique") {
      const workingDays = countWorkingDaysInRange(range.from, range.to);
      if (workingDays === 0) {
        return alert("La période sélectionnée ne contient aucun jour ouvré.");
      }
    }

    // validations spécifiques
    if (type === "maladie" && !justificatifFile)
      return alert("Justificatif obligatoire.");
    if (type === "specifique" && !nature.trim())
      return alert("Nature obligatoire.");

    let finalStartDate = "";
    let finalEndDate = "";

    if (type === "conge" || type === "specifique") {
      const tStart = periodStart === "matin" ? "09:00" : "14:00";
      const tEnd = periodEnd === "midi" ? "12:00" : "18:00";
      finalStartDate = `${range.from}T${tStart}`;
      finalEndDate = `${range.to}T${tEnd}`;
    } else if (type === "hsup") {
      finalStartDate = `${range.from}T${timeStart}`;
      finalEndDate = `${range.to}T${timeEnd}`;
    } else {
      // Maladie : journée complète
      finalStartDate = `${range.from}T09:00`;
      finalEndDate = `${range.to}T18:00`;
    }

    if (new Date(finalEndDate) <= new Date(finalStartDate))
      return alert("Dates invalides.");

    const formData = new FormData();
    formData.append("type", type);
    formData.append("startDate", finalStartDate);
    formData.append("endDate", finalEndDate);
    if (user?.id_user) formData.append("userId", String(user.id_user));
    if (type === "hsup" && justificatifText)
      formData.append("justificatifText", justificatifText);
    if ((type === "maladie" || type === "specifique") && justificatifFile)
      formData.append("justificatifFile", justificatifFile);
    if (type === "specifique") formData.append("nature", nature);

    const res = await fetch("/api/demande", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      alert("Envoyé !");
      const poste = user?.poste?.toLowerCase();
      router.push(
        poste === "admin" || poste === "rh" ? "/dashboard-admin" : "/dashboard-user"
      );
    } else alert(data.error);
  };

  if (loading)
    return <div className="p-10 text-center font-[poppins]">Chargement...</div>;

  const isConge = type === "conge" || type === "specifique";
  const isHSup = type === "hsup";
  const isMaladie = type === "maladie";

  return (
    <div className="min-h-screen bg-[#f4f6fc] px-4 py-8 font-[poppins]">
      <h1 className="text-5xl font-[Modak] text-[#000091] text-center mb-10">
        Nouvelle Demande
      </h1>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulaire */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="text-xs font-bold text-[#000091] uppercase mb-2 block tracking-wider">
                Type de demande
              </label>
              <div className="grid grid-cols-2 gap-3">
                {demandeTypes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setType(t.value);
                      setRange({ from: "", to: "" });
                      setTimeStart("08:00");
                      setTimeEnd("19:00");
                      setJustificatifFile(null);
                      setJustificatifText("");
                      setNature("");
                    }}
                    className={`py-4 rounded-2xl text-sm font-bold transition-all duration-300 border-2 ${
                      type === t.value
                        ? "bg-[#000091] text-white border-[#000091] shadow-lg shadow-blue-200 scale-[1.02]"
                        : "bg-white text-gray-500 border-gray-100 hover:border-[#000091] hover:text-[#000091]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {type && (
              <div className="space-y-6 animate-fadeIn">
                <DateRangePicker
                  label="Période"
                  value={range}
                  onChange={(v) => setRange(v)}
                  disableDay={
                    type === "conge" || type === "hsup" || type === "specifique"
                      ? (d) => isHolidayOrWeekendYmd(toYmdLocal(d))
                      : undefined
                  }
                />

                {isConge && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#f8f9fc] p-5 rounded-3xl border border-gray-100">
                      <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">
                        Début
                      </label>
                      <div className="flex bg-gray-200 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPeriodStart("matin")}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                            periodStart === "matin"
                              ? "bg-white text-[#000091] shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          Matin
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodStart("apres-midi")}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                            periodStart === "apres-midi"
                              ? "bg-white text-[#000091] shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          Après-midi
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#f8f9fc] p-5 rounded-3xl border border-gray-100">
                      <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">
                        Fin
                      </label>
                      <div className="flex bg-gray-200 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPeriodEnd("midi")}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                            periodEnd === "midi"
                              ? "bg-white text-[#000091] shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          Midi (12h)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodEnd("soir")}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                            periodEnd === "soir"
                              ? "bg-white text-[#000091] shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          Soir (18h)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isHSup && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Heure début */}
                    <div className="bg-[#f8f9fc] p-5 rounded-3xl border border-gray-100">
                      <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">
                        Heure de début
                      </label>
                      <input
                        type="time"
                        step={60}
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        onBlur={() => setTimeStart((t) => roundToQuarter(t))}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none"
                      />
                    </div>

                    {/* Heure fin */}
                    <div className="bg-[#f8f9fc] p-5 rounded-3xl border border-gray-100">
                      <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">
                        Heure de fin
                      </label>
                      <input
                        type="time"
                        step={60}
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        onBlur={() => setTimeEnd((t) => roundToQuarter(t))}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 bg-orange-50 p-5 rounded-3xl border border-orange-100">
                      <label className="text-xs font-bold text-[#ff6400] uppercase mb-2 block">
                        Motif (optionnel)
                      </label>
                      <input
                        value={justificatifText}
                        onChange={(e) => setJustificatifText(e.target.value)}
                        placeholder="Ex : récupération d'une soirée..."
                        className="w-full p-4 bg-white text-gray-700 rounded-xl border border-orange-100 outline-none font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(type === "maladie" || type === "specifique") && (
              <div
                className={`p-5 rounded-3xl border ${
                  isMaladie ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                }`}
              >
                <label
                  className={`text-xs font-bold uppercase mb-2 block ${
                    isMaladie ? "text-red-600" : "text-[#000091]"
                  }`}
                >
                  Justificatif {isMaladie ? "*" : "(optionnel)"}
                </label>
                <input
                  type="file"
                  onChange={(e) => setJustificatifFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-[#000091] file:text-white hover:file:opacity-90 transition"
                />
              </div>
            )}

            {type === "specifique" && (
              <div className="bg-[#f8f9fc] p-5 rounded-3xl border border-gray-100">
                <label className="text-xs font-bold text-[#000091] uppercase mb-2 block">
                  Nature *
                </label>
                <input
                  placeholder="Ex: Déménagement"
                  value={nature}
                  onChange={(e) => setNature(e.target.value)}
                  className="w-full p-4 bg-white text-[#000091] rounded-xl border border-gray-200 outline-none font-medium focus:border-[#000091]"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-5 bg-[#000091] text-white font-[Modak] text-2xl tracking-wide rounded-3xl shadow-xl shadow-blue-200 hover:bg-[#ff6400] hover:shadow-orange-200 hover:scale-[1.02] transition-all duration-300"
            >
              Envoyer ma demande
            </button>
          </form>
        </div>

        {/* Solde + Ajustement + Historique */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-gray-100 sticky top-28">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Mon compteur perso
                </h2>
                <div className="text-4xl font-[Modak] text-[#000091] mt-2">
                  {formatJours(user?.solde_conge || 0)}j{" "}
                  <span className="opacity-40">+</span> {formatHeures(user?.solde_hsup || 0)}
                </div>
                <div className="flex gap-2 text-xs font-bold text-gray-500 mt-3">
                  <span className="bg-blue-50 text-[#000091] px-2 py-1 rounded">
                    Congés: {formatJours(user?.solde_conge || 0)}
                  </span>
                  <span className="bg-orange-50 text-[#ff6400] px-2 py-1 rounded">
                    Récup: {formatHeures(user?.solde_hsup || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setIsModalOpen(true);
                  setMotif("");
                  setDateOnly("");
                  setHourOnly("09");
                }}
                className="flex-1 bg-[#000091] text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition"
              >
                Ajuster
              </button>
              <button
                onClick={openHistory}
                className="bg-gray-100 text-[#000091] px-4 py-3 rounded-xl hover:bg-gray-200 transition font-bold text-sm"
              >
                Historique
              </button>
            </div>

            <div className="mt-6 bg-[#f8f9fc] rounded-2xl p-4 text-xs border border-gray-100">
              <div className="flex justify-between">
                <span className="opacity-70 uppercase font-bold text-[#000091]">Période</span>
                <span className="font-bold  text-[#000091]">
                  {range.from && range.to ? `${range.from} → ${range.to}` : "-"}
                </span>
              </div>
              {isConge && (
                <div className="flex justify-between mt-2">
                  <span className="opacity-70 uppercase font-bold text-[#000091]">Demi-journées</span>
                  <span className="font-bold  text-[#000091]">
                    {periodStart} → {periodEnd}
                  </span>
                </div>
              )}
              {isHSup && (
                <div className="flex justify-between mt-2">
                  <span className="opacity-70 uppercase font-bold  text-[#000091]">Heures</span>
                  <span className="font-bold text-[#000091]">
                    {timeStart} → {timeEnd}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Ajuster */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-xl p-8 border border-gray-100">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-[Modak] text-[#000091]">Ajuster mon compteur</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetType("conge")}
                  className={`py-3 rounded-2xl font-bold border-2 transition ${
                    targetType === "conge"
                      ? "bg-[#000091] text-white border-[#000091]"
                      : "bg-white text-gray-500 border-gray-100 hover:border-[#000091]"
                  }`}
                >
                  Congés
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("hsup")}
                  className={`py-3 rounded-2xl font-bold border-2 transition ${
                    targetType === "hsup"
                      ? "bg-[#ff6400] text-white border-[#ff6400]"
                      : "bg-white text-gray-500 border-gray-100 hover:border-[#ff6400]"
                  }`}
                >
                  Récup
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                  Variation (ex: 1 / -1 / 0,5)
                </label>
                <input
                  value={variation}
                  onChange={(e) => setVariation(e.target.value)}
                  placeholder={targetType === "conge" ? "ex: 1 (jour)" : "ex: 1 (heure)"}
                  className="w-full p-4 rounded-2xl border border-gray-200 font-bold text-gray-700 outline-none"
                />
                <div className="text-[10px] text-gray-400 font-bold mt-2">
                  Retrait = valeur négative. Ajout heures sup = +15% automatique (convention).
                </div>
              </div>

              {/* Pour + heures sup: motif + date */}
              {targetType === "hsup" && parseFloat(variation.replace(",", ".")) > 0 && (
                <div className="space-y-3">
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <label className="text-xs font-bold text-[#ff6400] uppercase mb-2 block">
                      Motif *
                    </label>
                    <input
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                      placeholder="Ex: soirée montage salon..."
                      className="w-full p-3 rounded-xl border border-orange-100 bg-white font-bold text-gray-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={dateOnly}
                        onChange={(e) => setDateOnly(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-200 font-bold text-gray-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                        Heure *
                      </label>
                      <select
                        value={hourOnly}
                        onChange={(e) => setHourOnly(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-200 font-bold text-gray-700 outline-none"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {h}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleUpdateSolde}
                  className="flex-1 py-4 rounded-2xl bg-[#000091] text-white font-bold hover:opacity-90 transition"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historique */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Historique
                </div>
                <h2 className="text-2xl font-[Modak] text-[#000091] mt-1">
                  Mouvements de solde
                </h2>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-600 transition"
              >
                Fermer
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              {historyLogs.length === 0 ? (
                <div className="text-sm text-gray-400">Aucun historique.</div>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((h) => (
                    <div
                      key={h.id_historique}
                      className="bg-[#f8f9fc] rounded-2xl p-4 border border-gray-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-700">
                            {getHistoryLabel(h.type_solde)}
                          </div>
                          <div className="text-xs text-gray-400 font-bold mt-1">
                            {new Date(h.date_modif).toLocaleString("fr-FR")}
                            {" • "}
                            {h.actor_prenom} {h.actor_nom}
                          </div>
                          {h.motif && (
                            <div className="text-sm text-gray-600 font-medium mt-2">
                              Motif : <span className="font-bold">{h.motif}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[#000091]">
                            {h.type_solde.includes("conge")
                              ? `${formatJours(h.valeur_modif)}j`
                              : formatHeures(h.valeur_modif)}
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                            Nouveau :{" "}
                            {h.type_solde.includes("conge")
                              ? `${formatJours(h.nouveau_solde)}j`
                              : formatHeures(h.nouveau_solde)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}