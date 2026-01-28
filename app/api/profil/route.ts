import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDBConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { writeFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const connection = await getDBConnection();

    // 1. ✅ MISE À JOUR AUTO DU STATUT (Uniquement pour cet utilisateur)
    await connection.query(
      `
      UPDATE user u
      SET statut = CASE
          -- Maladie
          WHEN EXISTS (
              SELECT 1 FROM demande d
              WHERE d.id_user = u.id_user
              AND d.type = 'Arrêt Maladie'
              AND d.statut_demande = 'Acceptée'
              AND NOW() BETWEEN d.date_debut AND d.date_fin
          ) THEN 'malade'

          -- Congés / H.Sup
          WHEN EXISTS (
              SELECT 1 FROM demande d
              WHERE d.id_user = u.id_user
              AND d.type IN ('Congés Payés', 'Heures Supplémentaire', 'Congé spécifique')
              AND d.statut_demande = 'Acceptée'
              AND NOW() BETWEEN d.date_debut AND d.date_fin
          ) THEN 'en congés'

          -- Sinon
          ELSE 'au travail'
      END
      WHERE id_user = ?
      `,
      [userId]
    );

    // 2. Récupération des infos
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
      SELECT 
        id_user, nom, prenom, mail, poste, date_entree, 
        solde_conge, solde_hsup, statut, photo
      FROM user 
      WHERE id_user = ? LIMIT 1
      `,
      [userId]
    );

    await connection.end();

    if (rows.length === 0) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // On peut typer l'objet utilisateur si nécessaire
    const user = rows[0] as {
      id_user: number;
      nom: string;
      prenom: string;
      mail: string;
      poste: string;
      date_entree: string;
      solde_conge: number;
      solde_hsup: number;
      statut: string;
      photo: string | null;
    };

    return NextResponse.json({ user });
  } catch (err) {
    console.error("Erreur API profil :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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

    if (updates.length === 0) {
      return NextResponse.json({ success: true });
    }

    const conn = await getDBConnection();
    try {
      await conn.query(`UPDATE user SET ${updates.join(", ")} WHERE id_user = ?`, [...values, Number(userId)]);
      return NextResponse.json({ success: true });
    } finally {
      await conn.end();
    }
  } catch (err) {
    console.error("Erreur API profil PATCH :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
