import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import type { SnapshotDoc } from "@/lib/types";

type RouteParams = { params: Promise<{ siteId: string; slug: string }> };

// GET /api/snapshots/[siteId]/[slug] -- version history for the rollback picker.
// Content is omitted from the list response (could be large); fetch a
// specific snapshot's content via the rollback flow itself, not this route.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId, slug } = await params;
  const db = await getDb();

  const snapshots = await db
    .collection<SnapshotDoc>("snapshots")
    .find({ siteId, slug }, { projection: { content: 0 } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    snapshots: snapshots.map((s) => ({ ...s, _id: s._id!.toString() })),
  });
}
