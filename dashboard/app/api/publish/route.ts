import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { triggerRevalidation } from "@/lib/revalidate";
import type { ContentDoc, SnapshotDoc, SiteDoc, AuditLogDoc } from "@/lib/types";

// POST /api/publish { siteId, slug, label? }
//
// This is the entire "safety layer": nothing ever goes live except through
// this one route. It snapshots whatever is currently in draft, flips the
// published pointer to that snapshot, and (best-effort) tells the client
// site to refresh its cache. Because every publish creates a new immutable
// snapshot rather than overwriting the old published value in place,
// rollback is just "point published at an older snapshot" -- see
// /api/rollback.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.siteId !== "string" || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Request body must include 'siteId' and 'slug'" }, { status: 400 });
  }

  const { siteId, slug } = body;
  const label: string | undefined = typeof body.label === "string" ? body.label : undefined;

  const db = await getDb();

  const contentDoc = await db.collection<ContentDoc>("content").findOne({ siteId, slug });
  if (!contentDoc || Object.keys(contentDoc.draft ?? {}).length === 0) {
    return NextResponse.json({ error: "No draft content to publish for this page" }, { status: 400 });
  }

  const snapshot: SnapshotDoc = {
    siteId,
    slug,
    content: contentDoc.draft,
    label,
    createdAt: new Date(),
    createdBy: session.email,
  };
  const snapshotResult = await db.collection<SnapshotDoc>("snapshots").insertOne(snapshot);

  await db.collection<ContentDoc>("content").updateOne(
    { siteId, slug },
    {
      $set: {
        published: contentDoc.draft,
        publishedSnapshotId: snapshotResult.insertedId.toString(),
        updatedAt: new Date(),
      },
    }
  );

  await db.collection<AuditLogDoc>("audit_log").insertOne({
    siteId,
    action: "publish",
    actor: session.email,
    details: `slug=${slug} snapshot=${snapshotResult.insertedId.toString()}`,
    createdAt: new Date(),
  });

  let revalidated = false;
  if (ObjectId.isValid(siteId)) {
    const site = await db.collection<SiteDoc>("sites").findOne({ _id: new ObjectId(siteId) } as never);
    if (site) {
      revalidated = await triggerRevalidation(site, slug);
    }
  }

  return NextResponse.json({
    ok: true,
    snapshotId: snapshotResult.insertedId.toString(),
    revalidated,
  });
}
