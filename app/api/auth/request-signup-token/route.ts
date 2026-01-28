import { NextResponse } from "next/server";
import { z } from "zod";
import { getDBConnection } from "@/lib/db";
import { createEmailToken, TokenPurpose } from "@/lib/authTokens";
import { sendMail } from "@/lib/mailer";
import { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  mode: z.enum(["invited", "factory"]),
});

function hasSMTP() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

async function sendOrLogToken(email: string, subject: string, text: string, token: string) {
  // Si pas de SMTP (local), on ne doit pas planter : on log le token.
  if (!hasSMTP()) {
    console.log("====================================");
    console.log("MAIL DEV MODE (SMTP non configuré)");
    console.log("Email :", email);
    console.log("Token :", token);
    console.log("====================================");
    return;
  }

  // SMTP configuré : on tente d'envoyer. Si ça échoue, on log quand même et on ne bloque pas.
  try {
    await sendMail({ to: email, subject, text });
  } catch (e) {
    console.error("sendMail failed (will fallback to console token):", e);
    console.log("====================================");
    console.log("MAIL FALLBACK MODE (sendMail a échoué)");
    console.log("Email :", email);
    console.log("Token :", token);
    console.log("====================================");
  }
}

export async function POST(req: Request) {
  const connection = await getDBConnection();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const mode = parsed.data.mode;

    if (mode === "invited") {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT id_user, mdp FROM user WHERE mail = ? LIMIT 1",
        [email]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Aucun compte pré-créé pour cet email." },
          { status: 404 }
        );
      }

      const user = rows[0] as any;
      if (user.mdp) {
        return NextResponse.json(
          { error: "Ce compte est déjà activé (mot de passe déjà défini)." },
          { status: 409 }
        );
      }

      const purpose: TokenPurpose = "invited_signup";
      const { token } = await createEmailToken(email, purpose, 10);

      const subject = "Ze-Com — Code d'inscription (valable 10 min)";
      const text = `Votre code d'inscription Ze-Com : ${token}\n\nCe code est valable 10 minutes.`;

      await sendOrLogToken(email, subject, text, token);

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // factory
    const [countRows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) as c FROM user"
    );
    const count = Number((countRows?.[0] as any)?.c ?? 0);

    if (count > 0) {
      return NextResponse.json(
        { error: "Le formulaire d'usine est désactivé (un compte existe déjà)." },
        { status: 403 }
      );
    }

    const purpose: TokenPurpose = "factory_signup";
    const { token } = await createEmailToken(email, purpose, 10);

    const subject = "Ze-Com — Code d'initialisation (valable 10 min)";
    const text = `Votre code d'initialisation Ze-Com : ${token}\n\nCe code est valable 10 minutes.`;

    await sendOrLogToken(email, subject, text, token);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("request-signup-token error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    await connection.end();
  }
}
