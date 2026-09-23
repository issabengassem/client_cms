import { NextRequest } from "next/server";
import { getDb } from "./mongodb";
import { hashApiKey } from "./crypto";
import type { SiteDoc } from "./types";

// Verifies the "Authorization: Bearer <key>" header on requests that come
// FROM a client site (public content fetch) or FROM the onboarding Skill's
// register-site script (admin token), as opposed to requests from a human
// sitting at the dashboard, which use the cookie session in session.ts.

export async function authenticateSiteRequest(
  req: NextRequest
): Promise<{ site: SiteDoc & { _id: string } } | { error: string; status: number }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing Authorization header", status: 401 };
  }
  const key = authHeader.slice("Bearer ".length).trim();
  if (!key) {
    return { error: "Empty API key", status: 401 };
  }

  const db = await getDb();
  const keyHash = hashApiKey(key);
  const site = await db.collection<SiteDoc>("sites").findOne({ apiKeyHash: keyHash });

  if (!site) {
    return { error: "Invalid API key", status: 401 };
  }
  if (site.status !== "active") {
    return { error: "Site is paused", status: 403 };
  }

  return { site: { ...site, _id: site._id!.toString() } };
}

export function isAdminToken(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected || !authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice("Bearer ".length).trim() === expected;
}
