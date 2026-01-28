'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TeamCalendar, { CalendarEvent } from '@/components/TeamCalendar';

interface User { id_user: number; solde_conge: number; solde_hsup: number; nom: string; prenom: string; poste: string; photo: string; }
interface Demande { id_demande: number; id_user: number; type: string; date_debut: string; date_fin: string; statut_demande: string; nom: string; prenom: string; photo: string; }
interface HistoryItem { id_historique: number; type_solde: string; valeur_modif: number; nouveau_solde: number; date_modif: string; actor_nom: string; actor_prenom: string; motif?: string; date_action?: string; duree_reelle?: number; }

// Liste Heures
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function formatDateTime(dateStr: string) { if (!dateStr) return "-"; const d = new Date(dateStr); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function formatHeures(decimal: number | string): string { const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal; if (isNaN(val) || val === 0) return "0h"; const heures = Math.floor(Math.abs(val)); const minutes = Math.round((Math.abs(val) - heures) * 60); const signe = val < 0 ? "-" : ""; const minStr = minutes > 0 ? minutes.toString().padStart(2, '0') : ""; if (minutes === 0) return `${signe}${heures}h`; return `${signe}${heures}h${minStr}`; }
function formatJours(decimal: number | string): string { const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal; if (isNaN(val)) return "0"; return Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function formatSoldeGlobal(jours: number, heures: number): string { const j = formatJours(jours); const h = formatHeures(heures); if ((jours === 0 || isNaN(jours)) && (heures === 0 || isNaN(heures))) return "0"; if (jours === 0) return h; if (heures === 0) return `${j} jours`; return `${j}j et ${h}`; }
function getHistoryLabel(type: string) { switch(type) { case 'conge': return 'Ajustement Manuel'; case 'hsup': return 'Heures Supp. (Calculé)'; case 'conge_accepte': return 'Congés Accepté'; case 'hsup_accepte': return 'Heures Accepté'; default: return type; } }

export default function DashboardUserPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  // Accordéons (ordre demandé)
  const [openSections, setOpenSections] = useState<{ mine: boolean; calendar: boolean }>({ mine: true, calendar: false });
  // Filtres - Mes demandes
  const [selectedFiltersMine, setSelectedFiltersMine] = useState<{ type: string; statut: string }>({ type: '', statut: '' });
  // Filtres - Calendrier
  const [calendarType, setCalendarType] = useState<string>('');
  
  // Modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetType, setTargetType] = useState<'conge' | 'hsup'>('conge');
  const [variation, setVariation] = useState<string>("");
  const [motif, setMotif] = useState<string>(""); 

  // ✅ États Date/Heure
  const [dateOnly, setDateOnly] = useState<string>("");
  const [hourOnly, setHourOnly] = useState<string>("09");

  // Historique
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryItem[]>([]);

  useEffect(() => { const fetchData = async () => { const res = await fetch('/api/dashboard'); const data = await res.json(); if(res.ok) { setUser(data.user); setDemandes(data.demandes); } }; fetchData(); }, []);

  const handleUpdateSolde = async () => { 
      const val = parseFloat(variation.replace(',', '.')); 
      if (!user || isNaN(val) || val === 0) return; 

      let finalDateTime = undefined;

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
          if (data.success) { 
              alert(`Enregistré ! Crédit ajouté : ${data.added ? formatHeures(data.added) : 'Ok'}`);
              setIsModalOpen(false); 
              setVariation(""); setMotif(""); setDateOnly(""); setHourOnly("09");
              const res2 = await fetch('/api/dashboard'); const data2 = await res2.json(); setUser(data2.user); 
          } else { 
              alert("Erreur : " + data.error); 
          } 
      } catch(e) { alert("Erreur technique"); } 
  };

  const openHistory = async () => { if (!user) return; setIsHistoryOpen(true); const res = await fetch(`/api/solde-history?userId=${user.id_user}`); const data = await res.json(); setHistoryLogs(data.success ? data.history : []); };
  const normalizeStatut = (s?: string) => (s || "").trim().toLowerCase();

  const getStatusBadge = (status: string) => {
    const s = normalizeStatut(status);

    if (s === "acceptée" || s === "acceptee") {
      return <span className="flex items-center gap-1 bg-blue-50 text-[#000091] px-3 py-1.5 rounded-xl text-xs font-bold uppercase">✅ Validée</span>;
    }
    if (s === "refusée" || s === "refusee") {
      return <span className="flex items-center gap-1 bg-gray-100 text-black px-3 py-1.5 rounded-xl text-xs font-bold uppercase">❌ Refusée</span>;
    }

    return <span className="flex items-center gap-1 bg-orange-50 text-[#ff6400] px-3 py-1.5 rounded-xl text-xs font-bold uppercase">⏳ En attente</span>;
  };

  const myDemandes = user ? demandes.filter(d => d.id_user === user.id_user) : [];
  const filteredMyDemandes = myDemandes.filter(d => {
    const matchesType = !selectedFiltersMine.type || d.type.localeCompare(selectedFiltersMine.type, 'fr', { sensitivity: 'accent' }) === 0;
    const matchesStatut = !selectedFiltersMine.statut || d.statut_demande === selectedFiltersMine.statut;
    return matchesType && matchesStatut;
  });

  const calendarEvents: CalendarEvent[] = demandes
    .filter(d => d.statut_demande === 'Acceptée')
    .filter(d => !calendarType || d.type.localeCompare(calendarType, 'fr', { sensitivity: 'accent' }) === 0)
    .map(d => ({
      id: d.id_demande,
      title: `${d.prenom} ${d.nom}`,
      type: d.type,
      start: d.date_debut,
      end: d.date_fin,
    }));

  const typeOptions = Array.from(new Set(demandes.map(d => d.type))).sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'accent'}));
  const statutOptions = Array.from(new Set(demandes.map(d => d.statut_demande))).sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'accent'}));
  return (
    <div className="min-h-screen px-4 sm:px-8 py-8 bg-[#f4f6fc] font-[poppins]">
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-[Modak] text-[#000091] leading-none">
            Bonjour {user?.prenom} !
          </h1>
          <p className="text-gray-400 font-medium ml-1">
            Gère tes demandes, ton solde et ton planning.
          </p>
        </div>
        <button
          onClick={() => router.push('/demandes')}
          className="bg-[#000091] hover:opacity-90 text-white font-bold px-6 py-4 rounded-2xl shadow-xl shadow-blue-200 transition"
        >
          Nouvelle demande
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Solde (comme dashboard-admin) */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-100 flex flex-col justify-between h-fit relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#000091] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mon compteur perso</h2>
          <div className="text-4xl font-[Modak] text-[#000091] mb-2">
            {user ? formatSoldeGlobal(user.solde_conge, user.solde_hsup) : "..."}
          </div>
          <div className="flex gap-2 text-xs font-bold text-gray-500 mb-6">
            <span className="bg-blue-50 text-[#000091] px-2 py-1 rounded">Congés: {formatJours(user?.solde_conge || 0)}</span>
            <span className="bg-orange-50 text-[#ff6400] px-2 py-1 rounded">Récup: {formatHeures(user?.solde_hsup || 0)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setIsModalOpen(true); setMotif(""); setDateOnly(""); setHourOnly("09"); }}
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
        </div>

        {/* Accordéons */}
        <div className="lg:col-span-3 space-y-6">

          {/* 1) Mes demandes */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSections({ mine: !openSections.mine, calendar: false })}
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
                    {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    className="bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl outline-none py-3 px-4 transition cursor-pointer"
                    value={selectedFiltersMine.statut}
                    onChange={(e) => setSelectedFiltersMine((s) => ({ ...s, statut: e.target.value }))}
                  >
                    <option value="">Statut</option>
                    {statutOptions.map((s) => <option key={s} value={s}>{s}</option>)}
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
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="min-w-0">
                            <div className="font-[Modak] text-lg text-[#000091] leading-none truncate">{d.type}</div>
                            <div className="text-xs text-gray-400 font-bold mt-1">Du {formatDateTime(d.date_debut)} au {formatDateTime(d.date_fin)}</div>
                          </div>
                          {getStatusBadge(d.statut_demande)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2) Calendrier */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSections({ mine: false, calendar: !openSections.calendar })}
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
                    {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {calendarType && (
                    <button
                      onClick={() => setCalendarType("")}
                      className="text-xs text-red-400 font-bold hover:text-red-600 transition sm:ml-auto self-end sm:self-auto"
                    >
                      Effacer ✕
                    </button>
                  )}
                </div>
                <TeamCalendar mode="user" events={calendarEvents} />
              </div>
            )}
          </div>

        </div>
      </div>

{isModalOpen && (
        <div className="fixed inset-0 bg-[#000091]/20 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border-4 border-white">
                <button onClick={()=>setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black text-xl">✕</button>
                <h3 className="text-3xl font-[Modak] text-[#000091] mb-2 text-center">Ajuster le Solde</h3>
                <div className="flex bg-[#f4f6fc] p-1.5 rounded-2xl mb-8 mt-6">
                    <button onClick={() => setTargetType('conge')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${targetType === 'conge' ? 'bg-white text-[#000091] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Jours</button>
                    <button onClick={() => setTargetType('hsup')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${targetType === 'hsup' ? 'bg-white text-[#ff6400] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Heures</button>
                </div>
                
                <div className="mb-4 relative">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">{targetType === 'conge' ? 'Variation (Jours)' : 'Durée réelle travaillée (Heures)'}</label>
                    <input type="number" step={targetType === 'conge' ? "0.5" : "0.25"} value={variation} onChange={e=>setVariation(e.target.value)} className={`w-full p-6 bg-white border-4 rounded-3xl text-center text-4xl font-[Modak] outline-none transition focus:scale-105 ${targetType==='conge'?'border-[#000091] text-[#000091]':'border-[#ff6400] text-[#ff6400]'}`} placeholder="0" autoFocus />
                    {targetType === 'hsup' && <p className="text-center text-[10px] text-gray-400 mt-1">Saisissez les heures réellement faites.<br/>La majoration sera calculée automatiquement.</p>}
                </div>

                {targetType === 'hsup' && (
                    <div className="mb-6 animate-fadeIn space-y-3">
                         <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="text-xs font-bold text-red-500 uppercase ml-2 mb-1 block">Date (obligatoire si ajout)</label>
                                <input type="date" value={dateOnly} onChange={e=>setDateOnly(e.target.value)} className="w-full p-3 bg-red-50 text-red-700 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold"/>
                             </div>
                             <div className="w-24">
                                <label className="text-xs font-bold text-red-500 uppercase ml-2 mb-1 block">Heure *</label>
                                <select value={hourOnly} onChange={e=>setHourOnly(e.target.value)} className="w-full p-3 bg-red-50 text-red-700 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold">
                                    {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
                                </select>
                             </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 uppercase ml-2 mb-1 block">Motif (obligatoire si ajout)</label>
                            <input type="text" value={motif} onChange={e=>setMotif(e.target.value)} placeholder="Ex: Paiement H.Sup..." className="w-full p-3 bg-red-50 text-red-700 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold placeholder-red-300"/>
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