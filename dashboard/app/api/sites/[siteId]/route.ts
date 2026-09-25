import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import type { AuditLogDoc, SiteDoc } from "@/lib/types";

type RouteParams = { params: Promise<{ siteId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  if (!ObjectId.isValid(siteId)) {
    return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
  }

  const db = await getDb();
  const site = await db
    .collection<SiteDoc>("sites")
    .findOne({ _id: new ObjectId(siteId) } as never, { projection: { apiKeyHash: 0, revalidateSecret: 0 } });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ site: { ...site, _id: site._id!.toString() } });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  if (!ObjectId.isValid(siteId)) {
    return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Only a small allow-list of fields can be patched this way -- apiKeyHash
  // and _id are never editable through this route.
  const update: Partial<Pick<SiteDoc, "name" | "domain" | "revalidateUrl" | "status">> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.domain === "string") update.domain = body.domain.trim();
  if (typeof body.revalidateUrl === "string") update.revalidateUrl = body.revalidateUrl.trim();
  if (body.status === "active" || body.status === "paused") update.status = body.status;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }
  if (update.name === "" || update.domain === "") {
    return NextResponse.json({ error: "Name and domain cannot be empty" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .collection<SiteDoc>("sites")
    .findOneAndUpdate(
      { _id: new ObjectId(siteId) } as never,
      { $set: update },
      { returnDocument: "after", projection: { apiKeyHash: 0, revalidateSecret: 0 } }
    );

  if (!result) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  await db.collection<AuditLogDoc>("audit_log").insertOne({
    siteId,
    action: "site_updated",
    actor: session.email,
    details: JSON.stringify({ fields: Object.keys(update) }),
    createdAt: new Date(),
  });

  return NextResponse.json({ site: { ...result, _id: result._id!.toString() } });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  if (!ObjectId.isValid(siteId)) {
    return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<SiteDoc>("sites").deleteOne({ _id: new ObjectId(siteId) } as never);

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Note: this deliberately does not cascade-delete content/snapshots for
  // that site, so an accidental delete doesn't also destroy edit history.
  // A full "purge site" is a separate, more deliberate action to add later.
  return NextResponse.json({ ok: true });
}
