import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { SiteDoc, ContentDoc } from "@/lib/types";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  if (!ObjectId.isValid(siteId)) notFound();

  const db = await getDb();
  const site = await db
    .collection<SiteDoc>("sites")
    .findOne({ _id: new ObjectId(siteId) } as never, { projection: { apiKeyHash: 0, revalidateSecret: 0 } });

  if (!site) notFound();

  const pages = await db
    .collection<ContentDoc>("content")
    .find({ siteId })
    .sort({ updatedAt: -1 })
    .toArray();

  return (
    <>
      <h1>{site.name}</h1>
      <p className="subtle mono">{site.domain}</p>

      <div className="section card">
        <h2>Connection</h2>
        <table style={{ marginTop: 12 }}>
          <tbody>
            <tr>
              <td className="subtle">Status</td>
              <td>
                <span className={`badge badge--${site.status}`}>{site.status}</span>
              </td>
            </tr>
            <tr>
              <td className="subtle">API key</td>
              <td className="mono">...{site.apiKeyPreview}</td>
            </tr>
            <tr>
              <td className="subtle">Revalidate URL</td>
              <td className="mono">{site.revalidateUrl || "not configured"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 style={{ marginBottom: 12 }}>Pages</h2>
        {pages.length === 0 ? (
          <div className="empty-state">
            No content yet. Once the onboarding Skill wires up this site&rsquo;s{" "}
            <code className="mono">cms.config.json</code>, pages will appear here as their fields get edited.
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>Draft fields</th>
                  <th>Published</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page._id!.toString()}>
                    <td className="mono">{page.slug}</td>
                    <td className="subtle">{Object.keys(page.draft ?? {}).length} fields</td>
                    <td>
                      {page.published ? (
                        <span className="badge badge--active">live</span>
                      ) : (
                        <span className="badge badge--paused">unpublished</span>
                      )}
                    </td>
                    <td className="subtle">{new Date(page.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="subtle section" style={{ fontSize: 13 }}>
        Field-by-field editing, the AI chat assist, and the SEO panel are the next build phase --
        this view is read-only for now. Publish and rollback both work today via the API
        (<code className="mono">POST /api/publish</code>, <code className="mono">POST /api/rollback</code>).
      </p>
    </>
  );
}
