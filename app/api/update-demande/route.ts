import { NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { updateDemandeSchema } from "@/lib/validation";
import { cookies } from "next/headers";
import { RowDataPacket } from "mysql2";

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
  add(1);  // Lundi de Pâques
  add(39); // Ascension
  add(50); // Lundi de Pentecôte
  return set;
}

function isHolidayOrWeekend(date: Date) {
  if (isWeekend(date)) return true;
  return getHolidaySet(date.getFullYear()).has(toYmdLocal(date));
}

// ✅ FONCTION DE CALCUL INTELLIGENTE (Jours / Demi-journées)
function calculateLeaveDays(startDate: string | Date, endDate: string | Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Si c'est le MEME JOUR
    if (start.toDateString() === end.toDateString()) {
        if (isHolidayOrWeekend(start)) return 0;
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        // Si durée <= 5h (ex: 9h-12h ou 14h-18h), c'est une demi-journée (0.5)
        // Sinon (ex: 9h-18h), c'est une journée complète (1.0)
        return diffHours <= 5 ? 0.5 : 1.0;
    }

    // 2. Si c'est sur PLUSIEURS JOURS
    let totalDays = 0;
    
    // A. Contribution du Premier Jour
    // Si on commence l'après-midi (>= 13h), on compte 0.5, sinon 1.0
    if (!isHolidayOrWeekend(start)) {
        totalDays += start.getHours() >= 13 ? 0.5 : 1.0;
    }

    // B. Contribution du Dernier Jour
    // Si on finit le matin (<= 13h), on compte 0.5, sinon 1.0
    if (!isHolidayOrWeekend(end)) {
        totalDays += end.getHours() <= 13 ? 0.5 : 1.0;
    }

    // C. Jours Complets Intermédiaires
    // On crée des dates clones à midi pour éviter les problèmes d'heures
    const current = new Date(start);
    current.setDate(current.getDate() + 1); // Lendemain du début
    
    const stop = new Date(end);
    stop.setHours(0,0,0,0); // Minuit du jour de fin

    // Tant que le jour courant est strictement avant le jour de fin
    while (current < stop) {
        if (!isHolidayOrWeekend(current)) totalDays += 1.0;
        current.setDate(current.getDate() + 1);
    }

    return totalDays;
}

export async function POST(req: Request) {
  const conn = await getDBConnection();
  
  try {
    const parsed = updateDemandeSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide", details: parsed.error.flatten() }, { status: 400 });
    }

    const { id_demande, decision  } = parsed.data;
const cookieStore = await cookies();
    const actorIdStr = cookieStore.get("userId")?.value;
    const actorId = actorIdStr ? parseInt(actorIdStr, 10) : null;

    if (!id_demande || !decision || !actorId) {
      return NextResponse.json({ error: "Paramètres manquants ou non connecté" }, { status: 400 });
    }

    if (!["Acceptée", "Refusée"].includes(decision)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM demande WHERE id_demande = ?", [id_demande]);
    if (rows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    const demande = rows[0];
    const isNewAcceptance = decision === "Acceptée" && demande.statut_demande !== "Acceptée";

    if (isNewAcceptance) {
        let variation = 0;
        let typeSolde = "";

        const start = new Date(demande.date_debut);
        const end = new Date(demande.date_fin);

        // ✅ APPLICATION DE LA NOUVELLE LOGIQUE
        if (demande.type === "Congés Payés") {
            const days = calculateLeaveDays(start, end);
            variation = -days; 
            typeSolde = "conge_accepte";
        } 
        else if (demande.type === "Heures Supplémentaire") {
            // Pour les heures, on garde le calcul précis
            const diffMs = end.getTime() - start.getTime();
            const hours = diffMs / (1000 * 60 * 60);
            variation = -hours;
            typeSolde = "hsup_accepte";
        }

        // APPLICATION DE LA DÉDUCTION
        if (typeSolde !== "" && variation !== 0) {
            const colName = typeSolde.startsWith('conge') ? 'solde_conge' : 'solde_hsup';
            
            await conn.query(
                `UPDATE user SET ${colName} = ${colName} + ? WHERE id_user = ?`,
                [variation, demande.id_user]
            );

            const [userRows] = await conn.query<RowDataPacket[]>(`SELECT ${colName} FROM user WHERE id_user = ?`, [demande.id_user]);
            const nouveauSolde = userRows[0][colName];

            await conn.query(
                `INSERT INTO historique_solde (id_user_target, id_user_actor, type_solde, valeur_modif, nouveau_solde, date_modif)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [demande.id_user, actorId, typeSolde, variation, nouveauSolde]
            );
        }
    }

    await conn.query("UPDATE demande SET statut_demande = ? WHERE id_demande = ?", [decision, id_demande]);

    await conn.commit();
    return NextResponse.json({ success: true, message: isNewAcceptance ? "Demande acceptée et solde débité" : "Statut mis à jour" });

  } catch (error: unknown) {
    await conn.rollback();
    console.error("Erreur API update-demande:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    await conn.end();
  }
}