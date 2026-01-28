import { NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { hashPassword, looksLikeBcryptHash, verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import { RowDataPacket } from "mysql2";

// Définition du type exact de la table user que l'on récupère
interface UserRow extends RowDataPacket {
  id_user: number;
  nom: string;
  prenom: string;
  mail: string;
  mdp: string | null;
  solde_conge?: number;
  solde_hsup?: number;
  jours_conge_pris?: number;
  photo?: string;
}

export async function POST(req: Request) {
  const connection = await getDBConnection();

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const [rows] = await connection.execute<UserRow[]>(
      "SELECT * FROM user WHERE mail = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const user = rows[0];

    if (!user.mdp) {
      return NextResponse.json({ error: "Compte non activé. Merci de finaliser votre inscription." }, { status: 403 });
    }

    let ok = false;

    if (looksLikeBcryptHash(user.mdp)) {
      ok = await verifyPassword(password, user.mdp);
    } else {
      // Legacy / dev mode: plain password stored in DB
      ok = user.mdp === password;

      // If it matches, we upgrade to bcrypt immediately
      if (ok) {
        const newHash = await hashPassword(password);
        await connection.execute("UPDATE user SET mdp = ? WHERE id_user = ?", [newHash, user.id_user]);
      }
    }

    if (!ok) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true, user });

    // 🔐 On pose juste un cookie "userId"
    res.cookies.set("userId", String(user.id_user), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    });

    return res;
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Erreur API login :", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("Erreur API login :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    await connection.end();
  }
}
