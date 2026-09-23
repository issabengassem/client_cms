import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { triggerRevalidation } from "@/lib/revalidate";
import type { ContentDoc, SnapshotDoc, SiteDoc, AuditLogDoc } from "@/lib/types";

// POST /api/rollback { siteId, slug, snapshotId }
//
// Deliberately does NOT touch the current draft -- rollback only changes
// what's live. If someone's mid-edit on a draft when a rollback happens,
// that work-in-progress is still sitting there afterwards, unaffected.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.siteId !== "string" ||
    typeof body.slug !== "string" ||
    typeof body.snapshotId !== "string"
  ) {
    return NextResponse.json(
      { error: "Request body must include 'siteId', 'slug', and 'snapshotId'" },
      { status: 400 }
    );
  }

  const { siteId, slug, snapshotId } = body;
  if (!ObjectId.isValid(snapshotId)) {
    return NextResponse.json({ error: "Invalid snapshotId" }, { status: 400 });
  }

  const db = await getDb();

  const snapshot = await db
    .collection<SnapshotDoc>("snapshots")
    .findOne({ _id: new ObjectId(snapshotId), siteId, slug } as never);

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found for this site/slug" }, { status: 404 });
  }

  await db.collection<ContentDoc>("content").updateOne(
    { siteId, slug },
    {
      $set: {
        published: snapshot.content,
        publishedSnapshotId: snapshotId,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  await db.collection<AuditLogDoc>("audit_log").insertOne({
    siteId,
    action: "rollback",
    actor: session.email,
    details: `slug=${slug} restored snapshot=${snapshotId}`,
    createdAt: new Date(),
  });

  let revalidated = false;
  if (ObjectId.isValid(siteId)) {
    const site = await db.collection<SiteDoc>("sites").findOne({ _id: new ObjectId(siteId) } as never);
    if (site) {
      revalidated = await triggerRevalidation(site, slug);
    }
  }

  return NextResponse.json({ ok: true, restoredSnapshotId: snapshotId, revalidated });
}
