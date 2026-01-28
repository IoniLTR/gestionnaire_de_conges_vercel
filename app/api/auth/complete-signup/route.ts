import { NextResponse } from "next/server";
import { z } from "zod";
import { getDBConnection } from "@/lib/db";
import { consumeEmailToken, TokenPurpose } from "@/lib/authTokens";
import { hashPassword } from "@/lib/password";
import { RowDataPacket, OkPacket } from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(4).max(12),
  password: z.string().min(6, "Mot de passe trop court"),
  mode: z.enum(["invited", "factory"]),
  // factory only:
  nom: z.string().optional(),
  prenom: z.string().optional(),
  poste: z.enum(["admin", "RH"]).optional(),
});

export async function POST(req: Request) {
  const connection = await getDBConnection();
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide", details: parsed.error.flatten() }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const mode = parsed.data.mode;

    const purpose: TokenPurpose = mode === "invited" ? "invited_signup" : "factory_signup";

    // 1) consume token (single-use + expiration)
    const consumed = await consumeEmailToken(email, purpose, parsed.data.token);
    if (!consumed.ok) {
      return NextResponse.json({ error: "Code invalide ou expiré." }, { status: 401 });
    }

    const hashed = await hashPassword(parsed.data.password);

    if (mode === "invited") {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT id_user, mdp FROM user WHERE mail = ? LIMIT 1",
        [email]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "Aucun compte pré-créé pour cet email." }, { status: 404 });
      }
      const user = rows[0] as any;
      if (user.mdp) {
        return NextResponse.json({ error: "Ce compte est déjà activé." }, { status: 409 });
      }

      await connection.execute("UPDATE user SET mdp = ? WHERE id_user = ?", [hashed, user.id_user]);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // factory
    const [countRows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) as c FROM user");
    const count = Number((countRows?.[0] as any)?.c ?? 0);
    if (count > 0) {
      return NextResponse.json({ error: "Initialisation déjà effectuée." }, { status: 403 });
    }

    const nom = (parsed.data.nom || "").trim();
    const prenom = (parsed.data.prenom || "").trim();
    const poste = parsed.data.poste;

    if (!nom || !prenom || !poste) {
      return NextResponse.json({ error: "Nom, prénom et rôle (admin/RH) requis." }, { status: 400 });
    }

    const [result] = await connection.query<OkPacket>(
      `INSERT INTO user (nom, prenom, mail, mdp, poste, solde_conge, solde_hsup, photo, date_entree, statut)
       VALUES (?, ?, ?, ?, ?, 0, 0, '/uploads/default.jpeg', CURDATE(), 'au travail')`,
      [nom, prenom, email, hashed, poste]
    );

    return NextResponse.json({ success: true, id: result.insertId }, { status: 200 });
  } catch (e) {
    console.error("complete-signup error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    await connection.end();
  }
}
