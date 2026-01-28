import nodemailer from "nodemailer";

type MailOptions = { to: string; subject: string; text: string; html?: string };

function hasSmtp(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(opts: MailOptions): Promise<{ ok: boolean; devTokenPrinted?: boolean }> {
  // ✅ Dev fallback: if SMTP not configured, we don't crash the flow
  // and we print the email content (token) in server logs.
  if (!hasSmtp()) {
    console.warn("[MAIL DEV MODE] SMTP not configured. Email not sent.");
    console.warn("[MAIL DEV MODE] To:", opts.to);
    console.warn("[MAIL DEV MODE] Subject:", opts.subject);
    console.warn("[MAIL DEV MODE] Text:", opts.text);
    return { ok: true, devTokenPrinted: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // 465 = SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  return { ok: true };
}
