import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { triggerRevalidation } from "@/lib/revalidate";
import { publishDraft, type PublishStore } from "@/lib/publishDraft";
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

  if (!ObjectId.isValid(siteId)) {
    return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
  }

  const db = await getDb();
  const store: PublishStore = {
    findSite: (id) =>
      db.collection<SiteDoc>("sites").findOne({ _id: new ObjectId(id) } as never),
    findContent: (id, pageSlug) =>
      db.collection<ContentDoc>("content").findOne({ siteId: id, slug: pageSlug }),
    async createSnapshot(snapshot) {
      const result = await db.collection<SnapshotDoc>("snapshots").insertOne(snapshot);
      return result.insertedId.toString();
    },
    async setPublished(id, pageSlug, content, snapshotId, updatedAt) {
      await db.collection<ContentDoc>("content").updateOne(
        { siteId: id, slug: pageSlug },
        {
          $set: {
            published: content,
            publishedSnapshotId: snapshotId,
            updatedAt,
          },
        }
      );
    },
    async recordAudit(event) {
      await db.collection<AuditLogDoc>("audit_log").insertOne(event);
    },
  };

  const result = await publishDraft(store, {
    siteId,
    slug,
    label,
    actor: session.email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const revalidated = await triggerRevalidation(result.site, slug);

  return NextResponse.json({
    ok: true,
    snapshotId: result.snapshotId,
    revalidated,
  });
}
