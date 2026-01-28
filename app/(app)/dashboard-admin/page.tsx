'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TeamCalendar, { CalendarEvent } from '@/components/TeamCalendar';

// --- TYPES & HELPERS ---
interface User { id_user: number; solde_conge: number; solde_hsup: number; nom: string; prenom: string; photo: string; }
interface Demande { id_demande: number; id_user: number; type: string; date_demande: string; date_debut: string; date_fin: string; statut_demande: string; nom: string; prenom: string; photo: string; justificatif?: string; nature?: string; motif?: string; }
interface HistoryItem { id_historique: number; type_solde: string; valeur_modif: number; nouveau_solde: number; date_modif: string; actor_nom: string; actor_prenom: string; motif?: string; date_action?: string; duree_reelle?: number; }
type FiltersPayload = { types?: { type: string }[]; typesAll?: string[]; statuts?: { statut_demande: string }[]; noms?: { nom: string }[]; dates?: { date_demande: string }[]; };

// Liste des heures pour le selecteur (00 à 23)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function formatDateTime(dateStr: string) { if (!dateStr) return "-"; const d = new Date(dateStr); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} à ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function formatDateSimple(dateStr: string) { const d = new Date(dateStr); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function formatHeures(decimal: number | string): string { const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal; if (isNaN(val) || val === 0) return "0h"; const heures = Math.floor(Math.abs(val)); const minutes = Math.round((Math.abs(val) - heures) * 60); const signe = val < 0 ? "-" : ""; const minStr = minutes > 0 ? minutes.toString().padStart(2, '0') : ""; if (minutes === 0) return `${signe}${heures}h`; return `${signe}${heures}h${minStr}`; }
function formatJours(decimal: number | string): string { const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal; if (isNaN(val)) return "0"; return Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function formatSoldeGlobal(jours: number, heures: number): string { const j = formatJours(jours); const h = formatHeures(heures); if ((jours === 0 || isNaN(jours)) && (heures === 0 || isNaN(heures))) return "0"; if (jours === 0) return h; if (heures === 0) return `${j} jours`; return `${j}j et ${h}`; }
function getHistoryLabel(type: string) { switch(type) { case 'conge': return 'Ajustement Manuel'; case 'hsup': return 'Heures Supp. (Calculé)'; case 'conge_accepte': return 'Congés Accepté'; case 'hsup_accepte': return 'Heures Accepté'; default: return type; } }

export default function DashboardAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [filters, setFilters] = useState<FiltersPayload>({});
  const [selectedFilters, setSelectedFilters] = useState({ type: '', statut: '', nom: '', date: '' });
  // Accordéons (ordre demandé)
  // ✅ Par défaut : Demandes (équipe) ouverte
  const [openSections, setOpenSections] = useState<{ mine: boolean; all: boolean; calendar: boolean }>({ mine: false, all: true, calendar: false });
  // Filtres - Mes demandes
  const [selectedFiltersMine, setSelectedFiltersMine] = useState<{ type: string; statut: string }>({ type: '', statut: '' });
  // Filtres - Calendrier
  const [calendarType, setCalendarType] = useState<string>('');
  const [calendarNom, setCalendarNom] = useState<string>('');
  
  // Modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetType, setTargetType] = useState<'conge' | 'hsup'>('conge');
  const [variation, setVariation] = useState<string>(""); 
  const [motif, setMotif] = useState<string>(""); 
  
  // ✅ Nouveaux états séparés pour Date et Heure
  const [dateOnly, setDateOnly] = useState<string>(""); 
  const [hourOnly, setHourOnly] = useState<string>("09"); 

  // Historique
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryItem[]>([]);

  useEffect(() => { const f=async()=>{const r=await fetch('/api/dashboard');const d=await r.json();if(r.ok){setUser(d.user);setDemandes(d.demandes);setFilters(d.filters);}};f();}, []);

  const handleUpdateSolde = async () => { 
      const val = parseFloat(variation.replace(',', '.')); 
      if (!user || isNaN(val) || val === 0) return; 

      let finalDateTime = undefined;

      // ✅ Reconstitution de la date complète (uniquement si crédit)
      if (targetType === 'hsup' && val > 0) {
          if (!motif || motif.trim() === '') { alert("Motif obligatoire."); return; }
          if (!dateOnly) { alert("La date est obligatoire."); return; }
          finalDateTime = `${dateOnly}T${hourOnly}:00`;
      }

      try { 
          const res = await fetch("/api/update-solde", { 
              method: "POST", 
              body: JSON.stringify({ 
                  targetUserId: user.id_user, 
                  type: targetType, 
                  variation: val, 
                  motif: targetType==='hsup' && val>0 ? motif : undefined,
                  dateAction: targetType==='hsup' && val>0 ? finalDateTime : undefined
              }) 
          }); 
          
          const data = await res.json(); 
          if (res.ok && data.success) { 
              alert(`Enregistré ! Crédit ajouté : ${data.added ? formatHeures(data.added) : 'Ok'}`);
              setIsModalOpen(false); 
              setVariation(""); setMotif(""); setDateOnly(""); setHourOnly("09");
              const r=await fetch('/api/dashboard');const d=await r.json();setUser(d.user); 
          } else { 
              alert(data.error || "Erreur"); 
          } 
      } catch (e) { alert("Erreur"); } 
  };

  const openHistory = async () => { if (!user) return; setIsHistoryOpen(true); const res = await fetch(`/api/solde-history?userId=${user.id_user}`); const data = await res.json(); setHistoryLogs(data.success ? data.history : []); };
  const handleDecision = async (id: number, decision: string) => { try { const res = await fetch("/api/update-demande", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id_demande: id, decision }), }); if (!res.ok) throw new Error(); setDemandes(prev => prev.map(d => d.id_demande === id ? { ...d, statut_demande: decision } : d)); } catch (e) { alert("Erreur"); } };
  const handleDownload = (id: number) => { const d = demandes.find(x => x.id_demande === id); if (!d?.justificatif) return alert("Aucun justificatif."); const link = document.createElement("a"); link.href = `${window.location.origin}${d.justificatif}`; link.download = d.justificatif.split("/").pop()!; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  const filteredDemandes = demandes.filter(d => { const matchesType = !selectedFilters.type || d.type.localeCompare(selectedFilters.type, 'fr', { sensitivity: 'accent' }) === 0; const matchesStatut = !selectedFilters.statut || d.statut_demande === selectedFilters.statut; const matchesNom = !selectedFilters.nom || d.nom === selectedFilters.nom; const matchesDate = !selectedFilters.date || (() => { const [m, y] = selectedFilters.date.split('/'); const d2 = new Date(d.date_debut); return String(d2.getMonth()+1).padStart(2,'0') === m && d2.getFullYear() === Number(y); })(); return matchesType && matchesStatut && matchesNom && matchesDate; });

  const myDemandes = user ? demandes.filter(d => d.id_user === user.id_user) : [];
  const filteredMyDemandes = myDemandes.filter(d => {
    const matchesType = !selectedFiltersMine.type || d.type.localeCompare(selectedFiltersMine.type, 'fr', { sensitivity: 'accent' }) === 0;
    const matchesStatut = !selectedFiltersMine.statut || d.statut_demande === selectedFiltersMine.statut;
    return matchesType && matchesStatut;
  });

  const calendarEvents: CalendarEvent[] = demandes
    .filter(d => d.statut_demande === 'Acceptée')
    .filter(d => !calendarType || d.type.localeCompare(calendarType, 'fr', { sensitivity: 'accent' }) === 0)
    .filter(d => !calendarNom || d.nom === calendarNom)
    .map(d => ({
      id: d.id_demande,
      title: `${d.prenom} ${d.nom}`,
      type: d.type,
      start: d.date_debut,
      end: d.date_fin,
      meta: {
        statut: d.statut_demande,
        nature: d.nature,
        motif: d.motif,
        justificatif: d.justificatif,
        userId: d.id_user,
      }
    }));

  const normalizeStatut = (s?: string) => (s || "").trim().toLowerCase();

  const getStatusBadge = (status: string) => {
    const s = normalizeStatut(status);

    if (s === "acceptée" || s === "acceptee") {
      return <span className="flex items-center gap-1 bg-blue-50 text-[#000091] px-3 py-1.5 rounded-xl text-xs font-bold uppercase">✅ Validée</span>;
    }

    if (s === "refusée" || s === "refusee") {
      return <span className="flex items-center gap-1 bg-gray-100 text-black px-3 py-1.5 rounded-xl text-xs font-bold uppercase">❌ Refusée</span>;
    }

    // DB enum is "En Attente" but some UIs display "En attente".
    return <span className="flex items-center gap-1 bg-orange-50 text-[#ff6400] px-3 py-1.5 rounded-xl text-xs font-bold uppercase">⏳ En attente</span>;
  };

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8 bg-[#f4f6fc] font-[poppins]">
      <div className="max-w-7xl mx-auto mb-10">
          <h1 className="text-5xl font-[Modak] text-[#000091] mb-2">Admin Dashboard</h1>
          <p className="text-gray-400 font-medium">Gérez vos équipes et validez les demandes.</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-100 flex flex-col justify-between h-fit relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#000091] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mon Compteur Perso</h2>
            <div className="text-4xl font-[Modak] text-[#000091] mb-2">{user ? formatSoldeGlobal(user.solde_conge, user.solde_hsup) : "..."}</div>
            <div className="flex gap-2 text-xs font-bold text-gray-500 mb-6">
                <span className="bg-blue-50 text-[#000091] px-2 py-1 rounded">Congés: {formatJours(user?.solde_conge || 0)}</span>
                <span className="bg-orange-50 text-[#ff6400] px-2 py-1 rounded">Récup: {formatHeures(user?.solde_hsup || 0)}</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => { setIsModalOpen(true); setMotif(""); setDateOnly(""); setHourOnly("09"); }} className="flex-1 bg-[#000091] text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition">Ajuster</button>
                <button onClick={openHistory} className="bg-gray-100 text-[#000091] px-4 py-3 rounded-xl hover:bg-gray-200 transition font-bold text-sm">Historique</button>
            </div>
         </div>

         
         <div className="lg:col-span-3 space-y-6">

            {/* 1) Mes demandes (repliable) */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSections({ mine: !openSections.mine, all: false, calendar: false })}
                className="w-full flex items-center justify-between p-6"
              >
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mes demandes</div>
                  <div className="text-xl font-[Modak] text-[#000091] leading-none mt-1">Mes demandes perso</div>
                </div>
                <div className="text-gray-400 font-bold text-xl">{openSections.mine ? "−" : "+"}</div>
              </button>

              {openSections.mine && (
                <div className="px-6 pb-6">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-4 bg-[#f8f9fc] p-4 rounded-3xl border border-gray-100 sm:items-center">
                    <span className="text-xs font-bold text-[#000091] uppercase mr-2">Filtres :</span>
                    <select
                      className="bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl outline-none py-3 px-4 transition cursor-pointer"
                      value={selectedFiltersMine.type}
                      onChange={(e) => setSelectedFiltersMine((s) => ({ ...s, type: e.target.value }))}
                    >
                      <option value="">Type</option>
                      {(filters.typesAll || []).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      className="bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl outline-none py-3 px-4 transition cursor-pointer"
                      value={selectedFiltersMine.statut}
                      onChange={(e) => setSelectedFiltersMine((s) => ({ ...s, statut: e.target.value }))}
                    >
                      <option value="">Statut</option>
                      {(filters.statuts || []).map((s) => (
                        <option key={s.statut_demande} value={s.statut_demande}>{s.statut_demande}</option>
                      ))}
                    </select>

                    {(selectedFiltersMine.type || selectedFiltersMine.statut) && (
                      <button
                        onClick={() => setSelectedFiltersMine({ type: "", statut: "" })}
                        className="text-xs text-red-400 font-bold hover:text-red-600 transition sm:ml-auto self-end sm:self-auto"
                      >
                        Effacer ✕
                      </button>
                    )}
                  </div>

                  {filteredMyDemandes.length === 0 ? (
                    <div className="bg-[#f8f9fc] rounded-3xl p-6 border border-gray-100 text-sm text-gray-400">
                      Aucune demande.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredMyDemandes.map((d) => (
                        <div key={d.id_demande} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                          <div className="flex items-center gap-4 mb-4">
                            <img src={d.photo || "/uploads/default.jpeg"} className="w-12 h-12 rounded-2xl object-cover bg-gray-50" alt="avatar" />
                            <div className="min-w-0">
                              <div className="font-[Modak] text-lg text-[#000091] leading-none truncate">{d.prenom} {d.nom}</div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">{formatDateSimple(d.date_demande)}</div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <span className="inline-block bg-[#f4f6fc] text-[#000091] px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">{d.type}</span>
                            <div className="bg-gray-50 rounded-xl p-3 text-xs">
                              <div className="flex justify-between mb-1"><span className="text-gray-400">Du</span> <span className="font-bold text-gray-700">{formatDateTime(d.date_debut)}</span></div>
                              <div className="flex justify-between"><span className="text-gray-400">Au</span> <span className="font-bold text-gray-700">{formatDateTime(d.date_fin)}</span></div>
                            </div>
                            <div>{getStatusBadge(d.statut_demande)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2) Demandes (tous statuts) */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSections({ mine: false, all: !openSections.all, calendar: false })}
                className="w-full flex items-center justify-between p-6"
              >
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Demandes</div>
                  <div className="text-xl font-[Modak] text-[#000091] leading-none mt-1">Demandes (équipe)</div>
                </div>
                <div className="text-gray-400 font-bold text-xl">{openSections.all ? "−" : "+"}</div>
              </button>

              {openSections.all && (
                <div className="px-6 pb-6">
                  <div className="flex flex-wrap gap-3 mb-6 bg-[#f8f9fc] p-4 rounded-3xl border border-gray-100 items-center">
                    <span className="text-xs font-bold text-[#000091] uppercase mr-2">Filtres :</span>
                    {["type", "statut", "nom", "date"].map((f) => {
                      type FilterKey = "type" | "statut" | "nom" | "date";
                      const key = f as FilterKey;
                      return (
                        <select
                          key={f}
                          className="bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl outline-none py-3 px-4 transition cursor-pointer"
                          value={(selectedFilters as any)[key]}
                          onChange={(e) =>
                            setSelectedFilters((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                        >
                          <option value="">{f}</option>
                          {key === "type" && (filters.types || []).map((t) => (
                            <option key={t.type} value={t.type}>{t.type}</option>
                          ))}
                          {key === "statut" && (filters.statuts || []).map((s) => (
                            <option key={s.statut_demande} value={s.statut_demande}>{s.statut_demande}</option>
                          ))}
                          {key === "nom" && (filters.noms || []).map((n) => (
                            <option key={n.nom} value={n.nom}>{n.nom}</option>
                          ))}
                          {key === "date" && (filters.dates || []).map((d) => (
                            <option key={d.date_demande} value={d.date_demande}>{d.date_demande}</option>
                          ))}
                        </select>
                      );
                    })}

                    {(selectedFilters.type || selectedFilters.statut || selectedFilters.nom || selectedFilters.date) && (
                      <button
                        onClick={() => setSelectedFilters({ type: "", statut: "", nom: "", date: "" })}
                        className="text-xs text-red-400 font-bold hover:text-red-600 transition sm:ml-auto self-end sm:self-auto"
                      >
                        Effacer ✕
                      </button>
                    )}
                  </div>

                  {filteredDemandes.length === 0 ? (
                    <div className="bg-[#f8f9fc] rounded-3xl p-6 border border-gray-100 text-sm text-gray-400">
                      Aucune demande correspondante.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredDemandes.map((d) => {
                        const pending = normalizeStatut(d.statut_demande).includes("attente");
                        return (
                          <div key={d.id_demande} className="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-4">
                              <img src={d.photo || "/uploads/default.jpeg"} className="w-12 h-12 rounded-2xl object-cover bg-gray-50" alt="avatar" />
                              <div className="min-w-0">
                                <div className="font-[Modak] text-lg text-[#000091] leading-none truncate">{d.prenom} {d.nom}</div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">{formatDateSimple(d.date_demande)}</div>
                              </div>
                            </div>

                            <div className="flex-1 space-y-3">
                              <span className="inline-block bg-[#f4f6fc] text-[#000091] px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">{d.type}</span>
                              <div className="bg-gray-50 rounded-xl p-3 text-xs">
                                <div className="flex justify-between mb-1"><span className="text-gray-400">Du</span> <span className="font-bold text-gray-700">{formatDateTime(d.date_debut)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Au</span> <span className="font-bold text-gray-700">{formatDateTime(d.date_fin)}</span></div>
                              </div>
                              {d.nature && <div className="text-xs text-[#ff6400] font-bold bg-orange-50 px-3 py-2 rounded-xl border border-orange-100">Nature : {d.nature}</div>}
                              {d.motif && <div className="text-xs text-gray-500 italic bg-gray-50 px-3 py-2 rounded-xl">Motif : &quot;{d.motif}&quot;</div>}
                              <div>{getStatusBadge(d.statut_demande)}</div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {d.justificatif && (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(d.id_demande)}
                                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition"
                                >
                                  Télécharger justificatif
                                </button>
                              )}
                              {pending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDecision(d.id_demande, "Acceptée")}
                                    className="px-4 py-2 rounded-xl bg-[#000091] hover:opacity-90 text-white font-bold text-xs transition"
                                  >
                                    Accepter
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDecision(d.id_demande, "Refusée")}
                                    className="px-4 py-2 rounded-xl bg-black hover:opacity-90 text-white font-bold text-xs transition"
                                  >
                                    Refuser
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3) Calendrier des absences (validées) */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSections({ mine: false, all: false, calendar: !openSections.calendar })}
                className="w-full flex items-center justify-between p-6"
              >
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calendrier</div>
                  <div className="text-xl font-[Modak] text-[#000091] leading-none mt-1">Calendrier des absences</div>
                </div>
                <div className="text-gray-400 font-bold text-xl">{openSections.calendar ? "−" : "+"}</div>
              </button>

              {openSections.calendar && (
                <div className="px-6 pb-6">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-4 bg-[#f8f9fc] p-4 rounded-3xl border border-gray-100 sm:items-center">
                    <span className="text-xs font-bold text-[#000091] uppercase mr-2">Filtres :</span>
                    <select
                      className="bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl outline-none py-3 px-4 transition cursor-pointer"
                      value={calendarType}
                      onChange={(e) => setCalendarType(e.target.value)}
                    >
                      <option value="">Type</option>
                      {(filters.typesAll || []).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      className="bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl outline-none py-3 px-4 transition cursor-pointer"
                      value={calendarNom}
                      onChange={(e) => setCalendarNom(e.target.value)}
                    >
                      <option value="">Nom</option>
                      {(filters.noms || []).map((n) => (
                        <option key={n.nom} value={n.nom}>{n.nom}</option>
                      ))}
                    </select>
                    {(calendarType || calendarNom) && (
                      <button
                        onClick={() => { setCalendarType(""); setCalendarNom(""); }}
                        className="text-xs text-red-400 font-bold hover:text-red-600 transition sm:ml-auto self-end sm:self-auto"
                      >
                        Effacer ✕
                      </button>
                    )}
                  </div>

                  <TeamCalendar mode="admin" events={calendarEvents} />
                </div>
              )}
            </div>
         </div>
        </div>
{isModalOpen && (
        <div className="fixed inset-0 bg-[#000091]/20 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border-4 border-white">
                <button onClick={()=>setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black text-xl">✕</button>
                <h3 className="text-3xl font-[Modak] text-[#000091] mb-6 text-center">Ajuster Mon Solde</h3>
                <div className="flex bg-[#f4f6fc] p-1.5 rounded-2xl mb-8">
                    <button onClick={() => setTargetType('conge')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${targetType === 'conge' ? 'bg-white text-[#000091] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Jours</button>
                    <button onClick={() => setTargetType('hsup')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${targetType === 'hsup' ? 'bg-white text-[#ff6400] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Heures</button>
                </div>
                
                <div className="relative mb-4">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">{targetType === 'conge' ? 'Variation (Jours)' : 'Durée réelle travaillée (Heures)'}</label>
                    <input type="number" step={targetType === 'conge' ? "0.5" : "0.25"} value={variation} onChange={e=>setVariation(e.target.value)} className={`w-full p-6 bg-white border-4 rounded-3xl text-center text-4xl font-[Modak] outline-none transition focus:scale-105 ${targetType==='conge'?'border-[#000091] text-[#000091]':'border-[#ff6400] text-[#ff6400]'}`} placeholder="0" autoFocus />
                    {targetType === 'hsup' && <p className="text-center text-[10px] text-gray-400 mt-1">Saisissez les heures réellement faites.<br/>La majoration sera calculée automatiquement.</p>}
                </div>

                {/* ✅ SÉLECTION DATE ET HEURE (H.SUP SEULEMENT) */}
                {targetType === 'hsup' && (
                    <div className="space-y-3 mb-6 animate-fadeIn">
                        <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="text-xs font-bold text-red-500 uppercase ml-2 mb-1 block">Date (obligatoire si ajout)</label>
                                <input type="date" value={dateOnly} onChange={e=>setDateOnly(e.target.value)} className="w-full p-3 bg-red-50 text-red-700 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold"/>
                             </div>
                             <div className="w-24">
                                <label className="text-xs font-bold text-red-500 uppercase ml-2 mb-1 block">Heure Début</label>
                                <select value={hourOnly} onChange={e=>setHourOnly(e.target.value)} className="w-full p-3 bg-red-50 text-red-700 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold">
                                    {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
                                </select>
                             </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 uppercase ml-2 mb-1 block">Motif (obligatoire si ajout)</label>
                            <input type="text" value={motif} onChange={e=>setMotif(e.target.value)} placeholder="Ex: Rattrapage, Urgence..." className="w-full p-3 bg-red-50 text-red-700 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold placeholder-red-300"/>
                        </div>
                    </div>
                )}
                <button onClick={handleUpdateSolde} className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] transition-all duration-300 ${targetType==='conge'?'bg-[#000091] shadow-blue-200':'bg-[#ff6400] shadow-orange-200'}`}>Calculer & Valider</button>
            </div>
        </div>
      )}
      
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-[#000091]/20 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl border-4 border-white">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-[Modak] text-[#000091]">Historique</h2><button onClick={()=>setIsHistoryOpen(false)} className="bg-gray-50 p-2 rounded-full hover:bg-gray-100 text-[#000091] transition">✕</button></div>
                {historyLogs.length===0 ? <p className="text-center text-gray-400">Vide</p> : (
                    <div className="space-y-4">
                        {historyLogs.map(h => {
                             const isPositive = h.valeur_modif > 0;
                             const isHsup = h.type_solde.includes('hsup');
                             return (
                                <div key={h.id_historique} className="bg-[#f8f9fc] p-4 rounded-2xl border border-transparent hover:border-gray-200 transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{formatDateTime(h.date_modif)}</div>
                                            <div className="text-xs text-gray-500 font-medium mt-0.5">Par <span className="font-bold text-[#000091]">{h.actor_prenom} {h.actor_nom}</span></div>
                                            {h.type_solde === 'hsup' && h.date_action && (
                                                <div className="mt-1 flex flex-col gap-1">
                                                    <div className="text-xs text-gray-500">Activité le : <span className="font-bold">{formatDateTime(h.date_action)}</span></div>
                                                    <div className="text-xs text-gray-500">Durée réelle : <span className="font-bold">{formatHeures(h.duree_reelle || 0)}</span></div>
                                                </div>
                                            )}
                                            {h.motif && <div className="mt-1 text-xs text-[#ff6400] font-bold italic bg-orange-50 px-2 py-0.5 rounded-lg w-fit">📝 {h.motif}</div>}
                                        </div>
                                        <div className={`text-xl font-[Modak] ${isPositive ? 'text-green-500' : 'text-red-500'}`}>{isPositive ? '+' : ''}{isHsup ? formatHeures(h.valeur_modif) : formatJours(h.valeur_modif)}</div>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}