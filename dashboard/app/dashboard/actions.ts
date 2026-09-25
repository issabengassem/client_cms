"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/mongodb";
import { getSession, destroySession } from "@/lib/session";
import { generateApiKey, hashApiKey, previewApiKey } from "@/lib/crypto";
import type { SiteDoc, AuditLogDoc } from "@/lib/types";

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export interface CreateSiteState {
  error?: string;
  createdKey?: { siteId: string; apiKey: string; revalidateSecret: string; name: string };
}

// Manual path for registering a site from the dashboard UI. The onboarding
// Skill uses POST /api/sites instead (see the Skill's register-site
// script) so it can run unattended -- this action exists so the CMS is
// still fully usable by a human with nothing but a browser, e.g. to
// register a site before the client project exists yet.
export async function createSiteAction(_prevState: CreateSiteState, formData: FormData): Promise<CreateSiteState> {
  const session = await getSession();
  if (!session) {
    return { error: "Not signed in." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  const revalidateUrl = String(formData.get("revalidateUrl") ?? "").trim() || undefined;

  if (!name || !domain) {
    return { error: "Name and domain are both required." };
  }

  const db = await getDb();
  const existing = await db.collection<SiteDoc>("sites").findOne({ domain });
  if (existing) {
    return { error: `A site for domain '${domain}' already exists.` };
  }

  const apiKey = generateApiKey();
  const revalidateSecret = generateApiKey();

  const site: SiteDoc = {
    name,
    domain,
    revalidateUrl,
    revalidateSecret,
    contentSchema: {},
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPreview: previewApiKey(apiKey),
    status: "active",
    createdAt: new Date(),
  };

  const result = await db.collection<SiteDoc>("sites").insertOne(site);

  await db.collection<AuditLogDoc>("audit_log").insertOne({
    siteId: result.insertedId.toString(),
    action: "site_created",
    actor: session.email,
    createdAt: new Date(),
  });

  revalidatePath("/dashboard");

  return {
    createdKey: { siteId: result.insertedId.toString(), apiKey, revalidateSecret, name },
  };
}
