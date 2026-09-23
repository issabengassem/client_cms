import type { SiteDoc } from "./types";

// Best-effort call to the client site's own /api/revalidate route (see the
// Skill's assets/revalidate-route-template.ts for what that route looks
// like). "Best-effort" is deliberate: if a site's revalidate endpoint is
// down or misconfigured, that should never block a publish or rollback from
// succeeding in the CMS -- the content is correctly published either way,
// the client site just won't pick it up until its cache naturally expires
// or someone retries. Callers get the boolean back so the dashboard can
// show "published, but the site didn't confirm the refresh" if it happens.
export async function triggerRevalidation(site: SiteDoc, slug: string): Promise<boolean> {
  if (!site.revalidateUrl || !site.revalidateSecret) {
    return false;
  }

  try {
    const res = await fetch(site.revalidateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${site.revalidateSecret}`,
      },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
