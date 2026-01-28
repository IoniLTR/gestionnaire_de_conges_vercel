/**
 * Formate un nombre décimal en chaîne d'heures (ex: 1.5 -> 1h30)
 */
export function formatHeures(decimal: number | string): string {
  const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal;
  if (isNaN(val) || val === 0) return "0h";

  const heures = Math.floor(Math.abs(val));
  const minutes = Math.round((Math.abs(val) - heures) * 60);

  // Gestion du signe négatif
  const signe = val < 0 ? "-" : "";
  
  // Si pas de minutes, on affiche juste "Xh"
  if (minutes === 0) return `${signe}${heures}h`;
  
  // Sinon "XhYY"
  return `${signe}${heures}h${minutes.toString().padStart(2, '0')}`;
}

/**
 * Formate un solde de jours proprement (ex: 10.00 -> 10, 10.50 -> 10.5)
 */
export function formatJours(decimal: number | string): string {
  const val = typeof decimal === 'string' ? parseFloat(decimal) : decimal;
  if (isNaN(val)) return "0";
  // Supprime les zéros inutiles après la virgule
  return Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Crée la phrase complète demandée : "10 jours et 1h30"
 */
export function formatSoldeGlobal(jours: number, heures: number): string {
    const j = formatJours(jours);
    const h = formatHeures(heures);
    
    if (jours === 0 && heures === 0) return "0 solde";
    if (jours === 0) return h;
    if (heures === 0) return `${j} jours`;
    
    return `${j} jours et ${h}`;
}