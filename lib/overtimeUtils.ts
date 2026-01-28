import { Connection } from "mysql2/promise";
import { RowDataPacket } from "mysql2";

/**
 * Calcule le montant majoré à ajouter au solde selon la Convention 0086.
 * @param conn Connexion MySQL active
 * @param userId ID de l'utilisateur
 * @param dateAction Date et heure de début de l'heure supp
 * @param dureeReelle Durée brute réellement travaillée (ex: 2 heures)
 */
export async function calculateRecoveryHours(
  conn: Connection,
  userId: number,
  dateAction: Date,
  dureeReelle: number
): Promise<{ toCredit: number; rate: string }> {
  
  // 1. Détection Dimanche (+100%)
  const isSunday = dateAction.getDay() === 0; 
  if (isSunday) {
    return { toCredit: dureeReelle * 2, rate: "Dimanche (100%)" };
  }

  // 2. Détection Nuit (21h - 06h) (+100%)
  const startHour = dateAction.getHours();
  // On considère nuit si l'heure de début est >= 21h OU < 6h
  if (startHour >= 21 || startHour < 6) {
    return { toCredit: dureeReelle * 2, rate: "Nuit (100%)" };
  }

  // 3. Calcul par Semaine Civile (Lundi-Dimanche)
  // On récupère le total des heures RÉELLES déjà faites cette semaine
  const [rows] = await conn.query<RowDataPacket[]>(`
    SELECT COALESCE(SUM(duree_reelle), 0) as total_week
    FROM historique_solde
    WHERE id_user_target = ?
    AND type_solde = 'hsup'
    AND YEARWEEK(date_action, 1) = YEARWEEK(?, 1) 
  `, [userId, dateAction]);
  
  const existingHours = parseFloat(rows[0].total_week);
  const threshold = 8; // Seuil des 8 premières heures

  // Cas A : On est déjà au-delà de 8h -> Tout à 50%
  if (existingHours >= threshold) {
      return { toCredit: dureeReelle * 1.5, rate: ">8h (50%)" };
  } 
  // Cas B : On reste en dessous de 8h avec cet ajout -> Tout à 25%
  else if ((existingHours + dureeReelle) <= threshold) {
      return { toCredit: dureeReelle * 1.25, rate: "<8h (25%)" };
  } 
  // Cas C : Mixte (on franchit le seuil)
  else {
      const hoursInQuota25 = threshold - existingHours; // Reste à 25%
      const hoursInQuota50 = dureeReelle - hoursInQuota25; // Le dépassement à 50%
      const total = (hoursInQuota25 * 1.25) + (hoursInQuota50 * 1.5);
      return { toCredit: total, rate: "Mixte (25% / 50%)" };
  }
}