import { NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function GET() {
  const conn = await getDBConnection();

  try {
    const cookieStore = await cookies();
    const userIdStr = cookieStore.get("userId")?.value;

    if (!userIdStr) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }

    const userId = Number(userIdStr);

    // 1) Mise à jour statuts (lazy)
    await conn.query(`
      UPDATE user u
      SET statut = CASE
        WHEN EXISTS (
          SELECT 1 FROM demande d
          WHERE d.id_user = u.id_user
            AND d.type = 'Arrêt Maladie'
            AND d.statut_demande = 'Acceptée'
            AND NOW() BETWEEN d.date_debut AND d.date_fin
        ) THEN 'malade'
        WHEN EXISTS (
          SELECT 1 FROM demande d
          WHERE d.id_user = u.id_user
            AND d.type IN ('Congés Payés', 'Heures Supplémentaire', 'Congé spécifique')
            AND d.statut_demande = 'Acceptée'
            AND NOW() BETWEEN d.date_debut AND d.date_fin
        ) THEN 'en congés'
        ELSE 'au travail'
      END
    `);

    // 2) Auto-accept maladies
    await conn.query(`
      UPDATE demande
      SET statut_demande = 'Acceptée'
      WHERE type = 'Arrêt Maladie'
        AND statut_demande != 'Acceptée'
    `);

    // 3) User connecté
    const [userRows] = await conn.query<RowDataPacket[]>(
      `
      SELECT id_user, solde_conge, solde_hsup, nom, prenom, poste, photo
      FROM user
      WHERE id_user = ?
      LIMIT 1
      `,
      [userId]
    );

    const user = userRows[0]
      ? {
          ...userRows[0],
          id_user: Number(userRows[0].id_user),
          solde_conge: toNumber(userRows[0].solde_conge),
          solde_hsup: toNumber(userRows[0].solde_hsup),
        }
      : null;

    // 4) Demandes
    const [demandeRows] = await conn.query<RowDataPacket[]>(
      `
      SELECT
        d.*,
        u.nom,
        u.prenom,
        u.photo,
        COALESCE(m.justificatif, c.justificatif) as justificatif,
        c.nature
      FROM demande d
      JOIN user u ON d.id_user = u.id_user
      LEFT JOIN maladie_spec m ON d.id_demande = m.id_demande
      LEFT JOIN conges_spec c ON d.id_demande = c.id_demande
      ORDER BY d.date_demande DESC
      `
    );

    // 5) Filtres
    const [typesObserved] = await conn.query<RowDataPacket[]>(`SELECT DISTINCT type FROM demande`);
    const [statuts] = await conn.query<RowDataPacket[]>(`SELECT DISTINCT statut_demande FROM demande`);
    const [noms] = await conn.query<RowDataPacket[]>(`SELECT DISTINCT nom FROM user`);
    const [dates] = await conn.query<RowDataPacket[]>(`SELECT DISTINCT date_demande FROM demande ORDER BY date_demande DESC`);

    const [enumTypeRows] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM demande LIKE 'type'`);
    const enumSpec = enumTypeRows?.[0]?.Type as string | undefined;
    const typesAll = enumSpec ? (enumSpec.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)) : [];
    typesAll.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "accent" }));

    return NextResponse.json({
      user,
      demandes: demandeRows,
      filters: { types: typesObserved, typesAll, statuts, noms, dates },
    });
  } catch (error) {
    console.error("Erreur /api/dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    conn.release(); // ✅ pool connection
  }
}
