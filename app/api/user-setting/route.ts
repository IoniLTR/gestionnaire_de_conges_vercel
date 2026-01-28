import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getDBConnection } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createUserSchema } from "@/lib/validation";
import { RowDataPacket, OkPacket } from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const connection = await getDBConnection();
  try {
    await connection.query(`
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

    const [users] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM user ORDER BY nom ASC`
    );

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    console.error("Erreur GET /api/user-setting:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(req: NextRequest) {
  const connection = await getDBConnection();
  try {
    const formData = await req.formData();

    const nom = (formData.get("nom") as string) ?? "";
    const prenom = (formData.get("prenom") as string) ?? "";
    const mail = (formData.get("mail") as string) ?? "";
    const mdp = (formData.get("mdp") as string) ?? "";
    const poste = (formData.get("poste") as string) ?? "";
    const date_entree = (formData.get("date_entree") as string) ?? "";

    const solde_conge = parseFloat((formData.get("solde_conge") as string) || "0");
    const solde_hsup = parseFloat((formData.get("solde_hsup") as string) || "0");

    const photoFile = formData.get("photo") as File | null;
    const parsed = createUserSchema.safeParse({
      nom,
      prenom,
      mail,
      mdp,
      poste,
      solde_conge,
      solde_hsup,
      date_entree,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Payload invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT id_user FROM user WHERE mail = ?",
      [mail]
    );
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    let photoPath = "/uploads/default.jpeg";
    if (photoFile && photoFile.size > 0) {
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const fileName = `user_${Date.now()}_${photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const uploadPath = path.join(process.cwd(), "public/uploads", fileName);
      await writeFile(uploadPath, buffer);
      photoPath = `/uploads/${fileName}`;
    }

    const [result] = await connection.query<OkPacket>(
      `INSERT INTO user 
        (nom, prenom, mail, mdp, poste, solde_conge, solde_hsup, photo, date_entree, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'au travail')`,
      [nom, prenom, mail, mdp && mdp.trim().length > 0 ? await hashPassword(mdp) : null, poste, solde_conge, solde_hsup, photoPath, date_entree]
    );

    return NextResponse.json({ success: true, id: result.insertId }, { status: 200 });
  } catch (error) {
    console.error("Erreur POST /api/user-setting:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  } finally {
    connection.release();
  }
}
