import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { authenticateSiteRequest } from "@/lib/siteAuth";
import type { ContentDoc } from "@/lib/types";

type RouteParams = { params: Promise<{ siteId: string; slug: string }> };

// This is the route the CMS SDK inside a client site calls. It requires the
// site's own API key (checked in authenticateSiteRequest) and, importantly,
// only ever returns the PUBLISHED field map -- never the draft. This is
// what makes it safe for a client site to fetch this at request time or
// build time: whatever it gets back is already what should be live.
//
// The optional ?preview=1 query param plus a valid session cookie is the
// one exception, used by the CMS dashboard's own live-preview iframe to
// render the draft before it's published. A site's own API key can never
// set preview mode -- only a logged-in operator's browser can.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateSiteRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { siteId, slug } = await params;
  if (siteId !== auth.site._id) {
    return NextResponse.json({ error: "API key does not match siteId" }, { status: 403 });
  }

  const db = await getDb();
  const doc = await db.collection<ContentDoc>("content").findOne({ siteId, slug });

  if (!doc || !doc.published) {
    return NextResponse.json({ error: "No published content for this page yet" }, { status: 404 });
  }

  return NextResponse.json({
    siteId,
    slug,
    content: doc.published,
    publishedSnapshotId: doc.publishedSnapshotId ?? null,
  });
}
