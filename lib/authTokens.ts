import crypto from "crypto";
import { getDBConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2/promise";

// Must match DB enum values in auth_token.purpose
export type TokenPurpose = "invited_signup" | "factory_signup" | "reset_password";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generate6DigitToken(): string {
  // 6 digits, avoids leading zeros issue by padding
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export async function cleanupExpiredTokens(): Promise<void> {
  const connection = await getDBConnection();
  try {
    await connection.execute("DELETE FROM auth_token WHERE expires_at < NOW() OR used_at IS NOT NULL");
  } finally {
    await connection.end();
  }
}

export async function createEmailToken(email: string, purpose: TokenPurpose, ttlMinutes = 10): Promise<{ token: string }> {
  const connection = await getDBConnection();
  try {
    // Clean old tokens for same email/purpose
    await connection.execute("DELETE FROM auth_token WHERE email = ? AND purpose = ?", [email, purpose]);

    const token = generate6DigitToken();
    const tokenHash = sha256(token);

    await connection.execute(
      "INSERT INTO auth_token (email, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())",
      [email, purpose, tokenHash, ttlMinutes]
    );

    return { token };
  } finally {
    await connection.end();
  }
}

export async function consumeEmailToken(email: string, purpose: TokenPurpose, token: string): Promise<{ ok: boolean }> {
  const connection = await getDBConnection();
  try {
    const tokenHash = sha256(token);

    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT id, expires_at, used_at FROM auth_token WHERE email = ? AND purpose = ? AND token_hash = ? LIMIT 1",
      [email, purpose, tokenHash]
    );

    if (!rows || rows.length === 0) return { ok: false };

    const row = rows[0] as any;
    if (row.used_at) return { ok: false };

    // MySQL returns Date or string depending on config; easiest: trust SQL check
    const [validRows] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM auth_token WHERE id = ? AND used_at IS NULL AND expires_at >= NOW() LIMIT 1",
      [row.id]
    );
    if (!validRows || validRows.length === 0) return { ok: false };

    await connection.execute("UPDATE auth_token SET used_at = NOW() WHERE id = ?", [row.id]);
    return { ok: true };
  } finally {
    await connection.end();
  }
}
