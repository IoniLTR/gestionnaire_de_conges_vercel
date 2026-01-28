import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hash a plain password (bcrypt). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare a plain password with a stored hash. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // If it's not a bcrypt hash, caller can handle legacy/plain cases.
  return bcrypt.compare(plain, stored);
}

/** Quick check to know if a string looks like a bcrypt hash. */
export function looksLikeBcryptHash(value: string): boolean {
  return typeof value === "string" && value.startsWith("$2");
}
