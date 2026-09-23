import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";

// Site API keys: shown to the user once at creation time, then only the
// hash is stored. A site's request proves its identity by sending the raw
// key; we hash whatever arrives and compare hashes, so the real key never
// needs to live in the database.
export function generateApiKey(): string {
  return `cms_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function previewApiKey(key: string): string {
  return key.slice(-4);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
