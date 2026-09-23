import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { generateApiKey, hashApiKey, previewApiKey } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { isAdminToken } from "@/lib/siteAuth";
import type { SiteDoc, AuditLogDoc } from "@/lib/types";

// POST /api/sites -- register a new client site.
//
// Two callers are allowed here: a logged-in operator using the dashboard,
// or the onboarding Skill's register-site script authenticating with
// ADMIN_API_TOKEN. That second path is what lets onboarding happen from a
// terminal/chat without a human clicking through the UI first.
export async function POST(req: NextRequest) {
  const session = await getSession();
  const viaAdminToken = isAdminToken(req);

  if (!session && !viaAdminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.domain !== "string") {
    return NextResponse.json(
      { error: "Request body must include 'name' and 'domain' strings" },
      { status: 400 }
    );
  }

  const name: string = body.name.trim();
  const domain: string = body.domain.trim();
  const revalidateUrl: string | undefined = typeof body.revalidateUrl === "string" ? body.revalidateUrl.trim() : undefined;

  if (!name || !domain) {
    return NextResponse.json({ error: "'name' and 'domain' cannot be empty" }, { status: 400 });
  }

  const db = await getDb();

  const existing = await db.collection<SiteDoc>("sites").findOne({ domain });
  if (existing) {
    return NextResponse.json({ error: `A site for domain '${domain}' already exists` }, { status: 409 });
  }

  const apiKey = generateApiKey();
  const revalidateSecret = generateApiKey();

  const site: SiteDoc = {
    name,
    domain,
    revalidateUrl,
    revalidateSecret,
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPreview: previewApiKey(apiKey),
    status: "active",
    createdAt: new Date(),
  };

  const result = await db.collection<SiteDoc>("sites").insertOne(site);

  await db.collection<AuditLogDoc>("audit_log").insertOne({
    siteId: result.insertedId.toString(),
    action: "site_created",
    actor: session?.email ?? "onboarding-skill",
    createdAt: new Date(),
  });

  // apiKey is returned exactly once, here, and cannot be recovered later --
  // only its hash is stored. revalidateSecret IS recoverable (GET on this
  // site will include it to an authorized operator), since the CMS itself
  // needs to keep using it. If apiKey is lost, the fix is to rotate it
  // (not implemented in this core pass; see README "Not yet built").
  return NextResponse.json(
    {
      siteId: result.insertedId.toString(),
      name,
      domain,
      apiKey,
      revalidateSecret,
    },
    { status: 201 }
  );
}

// GET /api/sites -- list registered sites for the dashboard. Operator session only.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const sites = await db
    .collection<SiteDoc>("sites")
    .find({}, { projection: { apiKeyHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    sites: sites.map((s) => ({ ...s, _id: s._id!.toString() })),
  });
}
