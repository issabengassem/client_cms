import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import type { ContentDoc, ContentFieldMap } from "@/lib/types";

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
  const db = await getDb();
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
  const body = await req.json().catch(() => null);

  if (!body || typeof body.draft !== "object" || body.draft === null) {
    return NextResponse.json({ error: "Request body must include a 'draft' object" }, { status: 400 });
  }

  const draft: ContentFieldMap = body.draft;

  const db = await getDb();
  await db.collection<ContentDoc>("content").updateOne(
    { siteId, slug },
    {
      $set: { draft, updatedAt: new Date() },
      $setOnInsert: { siteId, slug, published: null, publishedSnapshotId: null },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
