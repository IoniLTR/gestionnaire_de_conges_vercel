import { NextRequest, NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { createDemandeSchema } from "@/lib/validation";
import { writeFile } from "fs/promises";
import path from "path";
import { RowDataPacket } from "mysql2";
import { OkPacket } from "mysql2/promise";

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
    const x = new Date(
      easter.getFullYear(),
      easter.getMonth(),
      easter.getDate() + days,
      12,
      0,
      0,
      0
    );
    set.add(toYmdLocal(x));
  };
  add(1); // Lundi de Pâques
  add(39); // Ascension
  add(50); // Lundi de Pentecôte
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
  for (
    let cur = start;
    cur.getTime() <= end.getTime();
    cur = new Date(
      cur.getFullYear(),
      cur.getMonth(),
      cur.getDate() + 1,
      12,
      0,
      0,
      0
    )
  ) {
    const ymd = toYmdLocal(cur);
    if (isHolidayOrWeekendYmd(ymd)) return ymd;
  }
  return null;
}

// ✅ Jours ouvrés uniquement (exclut week-ends + jours fériés FR)
function isHolidayOrWeekend(date: Date) {
  const ymd = toYmdLocal(date);
  return isHolidayOrWeekendYmd(ymd);
}

// ✅ Calcul congés en jours (support demi-journées), en excluant week-ends/jours fériés.
function calculateLeaveDaysWorking(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Même jour
  if (start.toDateString() === end.toDateString()) {
    if (isHolidayOrWeekend(start)) return 0;
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diffHours <= 5 ? 0.5 : 1.0;
  }

  let totalDays = 0;

  // Contribution du premier jour
  if (!isHolidayOrWeekend(start)) {
    totalDays += start.getHours() >= 13 ? 0.5 : 1.0;
  }

  // Contribution du dernier jour
  if (!isHolidayOrWeekend(end)) {
    totalDays += end.getHours() <= 13 ? 0.5 : 1.0;
  }

  // Jours complets intermédiaires
  const current = new Date(start);
  current.setHours(12, 0, 0, 0);
  current.setDate(current.getDate() + 1);

  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);

  while (current < stop) {
    if (!isHolidayOrWeekend(current)) totalDays += 1.0;
    current.setDate(current.getDate() + 1);
  }

  return totalDays;
}

export async function POST(req: NextRequest) {
  const connection = await getDBConnection();

  try {
    const formData = await req.formData();

    const typeKey = formData.get("type") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const userId = formData.get("userId") as string;    const parsed = createDemandeSchema.safeParse({
      type: typeKey,
      date_debut: startDate,
      date_fin: endDate,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }


    const justificatifFile = formData.get("justificatifFile") as File | null;
    const nature = formData.get("nature") as string | null;
    const motifText = formData.get("justificatifText") as string | null;

    if (!userId || !startDate || !endDate) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
    }

    // ✅ On autorise les plages contenant des week-ends / jours fériés.
    //    On refuse seulement si la période ne contient AUCUN jour ouvré (pour les types en jours).
    if (typeKey === "conge" || typeKey === "specifique") {
      const days = calculateLeaveDaysWorking(startDate, endDate);
      if (days === 0) {
        return NextResponse.json(
          { error: "La période sélectionnée ne contient aucun jour ouvré." },
          { status: 400 }
        );
      }
    }

    let dbType = "";
    switch (typeKey) {
      case "maladie":
        dbType = "Arrêt Maladie";
        break;
      case "conge":
        dbType = "Congés Payés";
        break;
      case "hsup":
        dbType = "Heures Supplémentaire";
        break;
      case "specifique":
        dbType = "Congé spécifique";
        break;
      default:
        return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }

    // Règles métier :
    // - Maladie: justificatif obligatoire (déjà géré plus bas en DB)
    // - Congé spécifique: nature obligatoire (justificatif optionnel)
    if (typeKey === "specifique") {
      if (!nature || String(nature).trim() === "") {
        return NextResponse.json({ error: "Nature obligatoire" }, { status: 400 });
      }
    }

    // Maladie : justificatif obligatoire (UI + API)
    if (typeKey === "maladie" && !justificatifFile) {
      return NextResponse.json({ error: "Justificatif obligatoire." }, { status: 400 });
    }

    // Vérification solde utilisateur
    const [users] = await connection.query<RowDataPacket[]>(
      "SELECT solde_conge, solde_hsup FROM user WHERE id_user = ?",
      [userId]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: "Utilisateur inconnu" }, { status: 404 });
    }

    const user = users[0];
    const diffMs = Math.abs(end.getTime() - start.getTime());

    if (dbType === "Congés Payés") {
      const daysRequested = calculateLeaveDaysWorking(startDate, endDate);
      if (user.solde_conge < daysRequested) {
        return NextResponse.json({ error: `Solde insuffisant (${user.solde_conge}j).` }, { status: 400 });
      }
    } else if (dbType === "Heures Supplémentaire") {
      const hoursRequested = diffMs / (1000 * 60 * 60);
      if (user.solde_hsup < hoursRequested) {
        return NextResponse.json({ error: `Heures insuffisantes (${user.solde_hsup}h).` }, { status: 400 });
      }
    }

    const statutInitial = dbType === "Arrêt Maladie" ? "Acceptée" : "En Attente";

    await connection.beginTransaction();

    const sqlStart = startDate.replace("T", " ");
    const sqlEnd = endDate.replace("T", " ");

    // INSERTION DEMANDE
    const [result] = await connection.execute<OkPacket>(
      `INSERT INTO demande (id_user, type, date_demande, date_debut, date_fin, statut_demande, motif) 
       VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
      [userId, dbType, sqlStart, sqlEnd, statutInitial, motifText]
    );

    const demandeId = result.insertId;

    // Gestion fichiers justificatifs
    let dbPath: string | null = null;
    if ((typeKey === "maladie" || typeKey === "specifique") && justificatifFile) {
      const buffer = Buffer.from(await justificatifFile.arrayBuffer());
      const fileName = `${typeKey}_${demandeId}_${Date.now()}_${justificatifFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const uploadPath = path.join(process.cwd(), "public/uploads", fileName);
      await writeFile(uploadPath, buffer);
      dbPath = `/uploads/${fileName}`;
    }

    if (typeKey === "maladie") {
      if (!dbPath) throw new Error("Justificatif requis");
      await connection.execute(
        `INSERT INTO maladie_spec (id_demande, justificatif) VALUES (?, ?)`,
        [demandeId, dbPath]
      );
    } else if (typeKey === "specifique") {
      await connection.execute(
        `INSERT INTO conges_spec (id_demande, nature, justificatif) VALUES (?, ?, ?)`,
        [demandeId, nature || "Autre", dbPath]
      );
    }

    await connection.commit();
    return NextResponse.json({ success: true, id: demandeId });
  } catch (err: unknown) {
    await connection.rollback();
    if (err instanceof Error) {
      console.error(err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    await connection.end();
  }
}
