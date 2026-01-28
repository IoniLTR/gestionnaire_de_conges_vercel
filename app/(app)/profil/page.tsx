"use client";

import { useEffect, useState } from "react";

interface User { id_user: number; nom: string; prenom: string; poste: string; mail: string; date_entree: string; solde_conge: number; solde_hsup: number; statut: string; photo?: string; }
interface HistoryItem { id_historique: number; type_solde: string; valeur_modif: number; nouveau_solde: number; date_modif: string; actor_nom: string; actor_prenom: string; motif?: string; date_action?: string; duree_reelle?: number; }

// Liste Heures
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function formatDateFr(dateStr?: string) { if (!dateStr) return "-"; const d = new Date(dateStr); return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`; }
function formatDateTimeFr(dateStr: string) { if (!dateStr) return "-"; const d = new Date(dateStr); return `${formatDateFr(dateStr)} ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`; }
function formatHeures(decimal: number | string): string { const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal; if (isNaN(val) || val === 0) return "0h"; const heures = Math.floor(Math.abs(val)); const minutes = Math.round((Math.abs(val) - heures) * 60); const signe = val < 0 ? "-" : ""; const minStr = minutes > 0 ? minutes.toString().padStart(2, '0') : ""; if (minutes === 0) return `${signe}${heures}h`; return `${signe}${heures}h${minStr}`; }
function formatConges(decimal: number | string): string { const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal; if (isNaN(val) || val === 0) return "0j"; const signe = val < 0 ? "-" : ""; const absVal = Math.abs(val); const joursEntiers = Math.floor(absVal); const resteDecimal = absVal - joursEntiers; if (resteDecimal < 0.01) return `${signe}${joursEntiers}j`; return `${signe}${Number(val).toLocaleString('fr-FR')}j`; }
function formatSoldeGlobal(jours: number, heures: number): string { const jStr = formatConges(jours); const hStr = formatHeures(heures); if ((!jours || jours === 0) && (!heures || heures === 0)) return "0"; if (!jours || jours === 0) return hStr; if (!heures || heures === 0) return jStr; return `${jStr} et ${hStr}`; }
function getHistoryLabel(type: string) {
  switch (type) {
    case 'conge':
      return 'Ajustement Manuel';
    case 'hsup':
      return 'Heures Supp. (Calculé)';
    case 'hsup_manual':
      return 'Ajustement Manuel (Récup)';
    case 'conge_accepte':
      return 'Congés Accepté';
    case 'hsup_accepte':
      return 'Heures Accepté';
    default:
      return type;
  }
}


export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editNom, setEditNom] = useState<string>("");
  const [editPrenom, setEditPrenom] = useState<string>("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [targetType, setTargetType] = useState<'conge' | 'hsup'>('conge');
  const [variation, setVariation] = useState<string>(""); 
  const [motif, setMotif] = useState<string>("");
  
  // ✅ États Date/Heure
  const [dateOnly, setDateOnly] = useState<string>("");
  const [hourOnly, setHourOnly] = useState<string>("09");

  useEffect(() => {
    const f = async () => {
      const r = await fetch("/api/profil");
      const d = await r.json();
      if (r.ok) {
        setUser(d.user);
        fetchHistory(d.user.id_user);
      }
    };
    f();
  }, []);
  const fetchHistory = async (userId: number) => { const r=await fetch(`/api/solde-history?userId=${userId}`);const d=await r.json();if(d.success)setHistory(d.history); };

  const handleUpdate = async () => { 
      const val = parseFloat(variation.replace(',', '.')); 
      if (!user || isNaN(val) || val === 0) return; 

      let finalDateTime = undefined;
      if (targetType === 'hsup' && val > 0) {
          if (!motif || motif.trim() === '') { alert("Motif obligatoire."); return; }
          if (!dateOnly) { alert("Date obligatoire."); return; }
          finalDateTime = `${dateOnly}T${hourOnly}:00`; 
      }

      await fetch("/api/update-solde", { 
          method: "POST", 
          body: JSON.stringify({ 
              targetUserId: user.id_user, 
              type: targetType, 
              variation: val, 
              motif: targetType==='hsup' && val>0 ? motif : undefined,
              dateAction: targetType==='hsup' && val>0 ? finalDateTime : undefined
          }) 
      }); 
      
      setIsModalOpen(false); 
      setVariation(""); setMotif(""); setDateOnly(""); setHourOnly("09");
      const r=await fetch("/api/profil");const d=await r.json();setUser(d.user);fetchHistory(d.user.id_user); 
  };

  const openEditProfile = () => {
    if (!user) return;
    setEditNom(user.nom || "");
    setEditPrenom(user.prenom || "");
    setEditPhotoFile(null);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const fd = new FormData();
    fd.append("nom", editNom.trim());
    fd.append("prenom", editPrenom.trim());
    if (editPhotoFile) fd.append("photo", editPhotoFile);

    const res = await fetch("/api/profil", { method: "PATCH", body: fd });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("PATCH /api/profil failed:", res.status, t);
      alert("Erreur lors de la mise à jour du profil.");
      return;
    }

    setIsEditProfileOpen(false);
    const r = await fetch("/api/profil");
    const d = await r.json();
    if (r.ok) {
      setUser(d.user);
      fetchHistory(d.user.id_user);
    }
  };

  if (!user) return <div className="p-10 text-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-[#f4f6fc] px-4 py-8 font-[poppins]">
      <div className="max-w-4xl mx-auto bg-white rounded-[3rem] shadow-xl overflow-hidden mb-8 border border-gray-100 relative group">
        <div className="h-32 bg-gradient-to-r from-[#000091] to-[#0000cc] relative"><div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div></div>
        <div className="px-8 pb-8 flex flex-col md:flex-row items-end -mt-16 gap-6">
            <div className="relative"><img src={user.photo || '/uploads/default.jpeg'} className="w-32 h-32 rounded-full border-[6px] border-white shadow-md object-cover bg-white" /><div className="absolute bottom-2 right-2 bg-[#ff6400] text-white px-3 py-1 rounded-full text-xs font-bold uppercase shadow-sm border-2 border-white">{user.statut}</div></div>
            <div className="pt-20 flex-1 text-center md:text-left mb-2"><h1 className="text-4xl font-[Modak] text-[#000091] leading-none mb-1">{user.prenom} {user.nom}</h1><p className="text-sm text-gray-400 font-bold uppercase tracking-widest">{user.poste}</p></div>
            <div className="flex flex-col gap-2 items-center md:items-end">
              <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 text-sm text-gray-500 font-medium">{user.mail} • Depuis le {formatDateFr(user.date_entree)}</div>
              <button onClick={openEditProfile} className="bg-white text-[#000091] border border-gray-100 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow-md hover:bg-gray-50 transition">Modifier profil</button>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-1 bg-[#000091] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-200 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
            <div>
                <p className="text-white/60 font-bold text-xs uppercase tracking-widest mb-4">Solde Global</p>
                <div className="text-5xl font-[Modak] leading-none mb-4">{formatSoldeGlobal(user.solde_conge, user.solde_hsup)}</div>
                <div className="space-y-2 text-sm font-medium opacity-80">
                    <div className="flex justify-between bg-white/10 px-3 py-2 rounded-xl"><span>Congés</span> <span>{formatConges(user.solde_conge)}</span></div>
                    <div className="flex justify-between bg-[#ff6400]/80 px-3 py-2 rounded-xl"><span>Récup</span> <span>{formatHeures(user.solde_hsup)}</span></div>
                </div>
            </div>
            <button onClick={() => { setIsModalOpen(true); setMotif(""); setDateOnly(""); setHourOnly("09"); }} className="mt-8 w-full bg-white text-[#000091] py-3 rounded-xl font-bold hover:bg-gray-100 transition shadow-lg">Ajuster ✏️</button>
         </div>

         <div className="md:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
            <h2 className="text-xl font-[Modak] text-[#000091] mb-6">Historique Récent</h2>
            {history.length === 0 ? <p className="text-gray-400 text-center py-10">Rien à signaler.</p> : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {history.map(h => (
                        <div key={h.id_historique} className="flex flex-col p-4 bg-[#f8f9fc] rounded-2xl hover:bg-white hover:shadow-md transition border border-transparent hover:border-gray-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase">{formatDateTimeFr(h.date_modif)}</span>
                                <span className="text-[10px] text-gray-400 font-bold">Par : <span className="text-[#000091]">{h.actor_prenom} {h.actor_nom}</span></span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <div className="text-sm font-bold text-[#000091]">{getHistoryLabel(h.type_solde)}</div>
                                    {h.type_solde === 'hsup' && h.date_action && (
                                        <div className="mt-1 flex flex-col gap-1">
                                            <div className="text-xs text-gray-500">Activité le : <span className="font-bold">{formatDateTimeFr(h.date_action)}</span></div>
                                            <div className="text-xs text-gray-500">Durée réelle : <span className="font-bold">{formatHeures(h.duree_reelle || 0)}</span></div>
                                        </div>
                                    )}
                                    {h.motif && <div className="mt-1 text-xs text-[#ff6400] font-bold italic bg-orange-50 px-2 py-0.5 rounded-lg w-fit">📝 {h.motif}</div>}
                                </div>
                                <div className={`text-xl font-[Modak] ${h.valeur_modif>0?'text-green-500':'text-red-500'}`}>{h.valeur_modif>0?'+':''}{h.type_solde.includes('hsup') ? formatHeures(h.valeur_modif) : formatConges(h.valeur_modif)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#000091]/20 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border-4 border-white">
                <button onClick={()=>setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black text-xl">✕</button>
                <h3 className="text-3xl font-[Modak] text-[#000091] mb-6 text-center">Mise à jour</h3>
                <div className="flex bg-[#f4f6fc] p-1.5 rounded-2xl mb-8">
                    <button onClick={() => setTargetType('conge')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${targetType === 'conge' ? 'bg-white text-[#000091] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Jours</button>
                    <button onClick={() => setTargetType('hsup')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${targetType === 'hsup' ? 'bg-white text-[#ff6400] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Heures</button>
                </div>
                
                <div className="relative mb-4">
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
                <button onClick={handleUpdate} className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] transition-all duration-300 ${targetType==='conge'?'bg-[#000091] shadow-blue-200':'bg-[#ff6400] shadow-orange-200'}`}>Calculer & Valider</button>
            </div>
        </div>
      )}

      {isEditProfileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border border-gray-100">
            <button onClick={() => setIsEditProfileOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black text-xl">✕</button>
            <h3 className="text-3xl font-[Modak] text-[#000091] mb-6 text-center">Profil</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Prénom</label>
                  <input value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} className="w-full mt-1 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-[#000091]/20 font-bold text-[#000091]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nom</label>
                  <input value={editNom} onChange={(e) => setEditNom(e.target.value)} className="w-full mt-1 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-[#000091]/20 font-bold text-[#000091]" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Photo de profil</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full mt-1 bg-gray-50 rounded-xl px-4 py-2.5 outline-none text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#000091] font-bold text-[#000091] file:text-white hover:file:opacity-90"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setEditPhotoFile(e.target.files[0]);
                  }}
                />
              </div>
            </div>

            <button onClick={handleSaveProfile} className="mt-6 w-full bg-[#000091] text-white py-4 rounded-2xl font-[Modak] text-xl tracking-wider hover:opacity-90 transition shadow-lg shadow-blue-200">
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}