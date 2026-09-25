import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { mergeDraft, validateDraftPatch } from "@/lib/contentSchema";
import type { AuditLogDoc, ContentDoc, SiteDoc } from "@/lib/types";

type RouteParams = { params: Promise<{ siteId: string; slug: string }> };

// This is the OPERATOR-facing content route -- used by the dashboard editor,
// authenticated with the session cookie. It can see and write drafts.
// Client sites never call this route directly; they call
// /api/public/content/[siteId]/[slug] with their API key instead, and only
// ever see the published version. Keeping these as two separate routes
// means a leaked site API key can only ever read published content, never
// drafts, and can never write anything.

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId, slug } = await params;
  if (!ObjectId.isValid(siteId)) {
    return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
  }

  const db = await getDb();
  const site = await db
    .collection<SiteDoc>("sites")
    .findOne({ _id: new ObjectId(siteId) } as never);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  if (!site.contentSchema?.[slug]) {
    return NextResponse.json({ error: `Slug '${slug}' is not approved for this site` }, { status: 400 });
  }

  const doc = await db.collection<ContentDoc>("content").findOne({ siteId, slug });

  if (!doc) {
    // Not an error -- a page simply hasn't been touched in the CMS yet.
    return NextResponse.json({
      siteId,
      slug,
      draft: {},
      published: null,
      exists: false,
    });
  }

  return NextResponse.json({ ...doc, _id: doc._id!.toString(), exists: true });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId, slug } = await params;
  if (!ObjectId.isValid(siteId)) {
    return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must include a 'draft' object" }, { status: 400 });
  }

  const db = await getDb();
  const site = await db
    .collection<SiteDoc>("sites")
    .findOne({ _id: new ObjectId(siteId) } as never);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const validation = validateDraftPatch(site.contentSchema, slug, body.draft);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const existing = await db.collection<ContentDoc>("content").findOne({ siteId, slug });
  const draft = mergeDraft(existing?.draft, validation.draft);
  const updatedAt = new Date();

  await db.collection<ContentDoc>("content").updateOne(
    { siteId, slug },
    {
      $set: { draft, updatedAt },
      $setOnInsert: { siteId, slug, published: null, publishedSnapshotId: null },
    },
    { upsert: true }
  );

  await db.collection<AuditLogDoc>("audit_log").insertOne({
    siteId,
    action: "draft_update",
    actor: session.email,
    details: JSON.stringify({ slug, fields: Object.keys(validation.draft) }),
    createdAt: updatedAt,
  });

  return NextResponse.json({ ok: true, draft });
}
