import { NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  id_user: number;
  nom: string;
  prenom: string;
  mail: string;
}

export async function POST(req: Request) {
  const connection = await getDBConnection();

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const [rows] = await connection.execute<UserRow[]>(
      "SELECT id_user, nom, prenom, mail FROM user WHERE mail = ? LIMIT 1",
      [email]
    );

    connection.release();

    if (rows.length === 0) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Ici, normalement on génère un token et on envoie un email
    // Pour l'instant on retourne juste un message pour la démo
    return NextResponse.json({
      message: "Si cet email existe, un lien de réinitialisation a été envoyé."
    }, { status: 200 });

  } catch (err: unknown) {
     connection.release();
    if (err instanceof Error) {
      console.error("Erreur API forgot-password :", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("Erreur API forgot-password :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
