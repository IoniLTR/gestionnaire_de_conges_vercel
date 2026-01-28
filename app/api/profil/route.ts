import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDBConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { writeFile } from "fs/promises";
import path from "path";

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
  const cookieStore = await cookies();
  const userIdStr = cookieStore.get("userId")?.value;

  if (!userIdStr) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = Number(userIdStr);
  const conn = await getDBConnection();

  try {
    await conn.query(
      `
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
      WHERE id_user = ?
      `,
      [userId]
    );

    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT
        id_user, nom, prenom, mail, poste, date_entree,
        solde_conge, solde_hsup, statut, photo
      FROM user
      WHERE id_user = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const r = rows[0];
    const user = {
      ...r,
      id_user: Number(r.id_user),
      solde_conge: toNumber(r.solde_conge),
      solde_hsup: toNumber(r.solde_hsup),
    };

    return NextResponse.json({ user });
  } catch (err) {
    console.error("Erreur API profil :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    conn.release(); // ✅ pool connection
  }
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const userIdStr = cookieStore.get("userId")?.value;

  if (!userIdStr) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = Number(userIdStr);
  const formData = await req.formData();

  const nom = (formData.get("nom") as string | null)?.toString().trim();
  const prenom = (formData.get("prenom") as string | null)?.toString().trim();

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (nom) {
    updates.push("nom = ?");
    values.push(nom);
  }
  if (prenom) {
    updates.push("prenom = ?");
    values.push(prenom);
  }

  const photoFile = formData.get("photo") as File | null;
  if (photoFile && photoFile.size > 0) {
    const buffer = Buffer.from(await photoFile.arrayBuffer());
    const cleanName = photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const fileName = `user_${userId}_${Date.now()}_${cleanName}`;
    const uploadPath = path.join(process.cwd(), "public/uploads", fileName);
    await writeFile(uploadPath, buffer);
    updates.push("photo = ?");
    values.push(`/uploads/${fileName}`);
  }

  if (!updates.length) {
    return NextResponse.json({ success: true });
  }

  const conn = await getDBConnection();
  try {
    await conn.query(`UPDATE user SET ${updates.join(", ")} WHERE id_user = ?`, [...values, userId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erreur API profil PATCH :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    conn.release(); // ✅ pool connection
  }
}
