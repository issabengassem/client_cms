import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Operator sessions (dashboard logins) are a signed JWT in an httpOnly
// cookie -- not NextAuth. For a single-tenant admin dashboard like this,
// a hand-rolled session is fewer moving parts and easier to reason about
// than pulling in a full auth framework for what is essentially "is this
// person one of the people in the users collection."

const COOKIE_NAME = "cms_session";
const ALG = "HS256";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "admin" | "editor";
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Missing SESSION_SECRET. Copy .env.example to .env.local and set a random secret."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
