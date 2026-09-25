import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { AuditLogDoc, ContentDoc, SiteDoc, SnapshotDoc } from "@/lib/types";
import ContentEditor from "./ContentEditor";
import SiteSettings from "./SiteSettings";
import VersionHistory from "./VersionHistory";

export const dynamic = "force-dynamic";

function date(value?: Date | null) {
  return value ? new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function activity(event: AuditLogDoc) {
  if (event.action === "draft_update") {
    try {
      const details = JSON.parse(event.details ?? "{}");
      if (typeof details.slug === "string" && Array.isArray(details.fields)) return `Draft saved  /  ${details.slug}  /  ${details.fields.length} field${details.fields.length === 1 ? "" : "s"}`;
    } catch { /* Older audit entries use plain text. */ }
    return "Draft saved";
  }
  return ({ site_created: "Site connected", site_updated: "Site settings updated", publish: "Content published", rollback: "Version restored" })[event.action];
}

export default async function SiteDetailPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { siteId } = await params;
  const { page: selectedPage } = await searchParams;
  if (!ObjectId.isValid(siteId)) notFound();
  const db = await getDb();
  const site = await db.collection<SiteDoc>("sites").findOne({ _id: new ObjectId(siteId) } as never, { projection: { apiKeyHash: 0, revalidateSecret: 0 } });
  if (!site) notFound();
  const [content, audits, snapshots] = await Promise.all([
    db.collection<ContentDoc>("content").find({ siteId }).sort({ updatedAt: -1 }).toArray(),
    db.collection<AuditLogDoc>("audit_log").find({ siteId }).sort({ createdAt: -1 }).limit(8).toArray(),
    db.collection<SnapshotDoc>("snapshots").find({ siteId }, { projection: { slug: 1, createdAt: 1, label: 1, createdBy: 1 } }).sort({ createdAt: -1 }).toArray(),
  ]);
  const schema = site.contentSchema ?? {};
  const slugs = Array.from(new Set([...Object.keys(schema), ...content.map((page) => page.slug)]));
  const lastPublished = snapshots[0]?.createdAt;
  const pages = slugs.map((slug) => {
    const doc = content.find((page) => page.slug === slug);
    return { slug, draft: doc?.draft ?? {}, published: doc?.published ?? null, updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null, lastPublished: snapshots.find((item) => item.slug === slug)?.createdAt ? new Date(snapshots.find((item) => item.slug === slug)!.createdAt).toISOString() : null };
  });
  const changed = pages.filter((page) => JSON.stringify(page.draft) !== JSON.stringify(page.published ?? {})).length;

  return <>
    <Link className="back-link" href="/dashboard">&larr; All sites</Link>
    <header className="page-heading"><div><span className="eyebrow">Site workspace</span><h1>{site.name}</h1><p className="subtle">{site.domain} <span className="heading-separator"> / </span> <span className="mono">{siteId}</span></p></div><span className={`badge badge--${site.status}`}>{site.status}</span></header>
    <div className="stats-grid stats-grid--three"><div className="stat-card"><span>Editable pages</span><strong>{Object.values(schema).filter((item) => Object.keys(item.fields).length > 0).length}</strong><small>Chosen during website setup</small></div><div className="stat-card"><span>Draft changes</span><strong>{changed}</strong><small>Pages differing from the live site</small></div><div className="stat-card"><span>Last published</span><strong className="stat-card__date">{date(lastPublished)}</strong><small>{snapshots.length} saved versions</small></div></div>
    <div className="site-grid"><div>
      <section className="section" id="content"><div className="section-heading"><div><span className="eyebrow">Content library</span><h2>Pages</h2></div></div>
        {slugs.length === 0 ? <div className="empty-state">No pages are available to edit yet. The website owner chooses them during setup.</div> : <div className="card table-card"><div className="table-scroll"><table><thead><tr><th>Page</th><th>Editable areas</th><th>Status</th><th>Last updated</th></tr></thead><tbody>{pages.map((page) => <tr key={page.slug}><td><Link className="table-title" href={`/dashboard/${siteId}?page=${encodeURIComponent(page.slug)}#editor`}>{page.slug}</Link></td><td>{Object.keys(schema[page.slug]?.fields ?? {}).length} available</td><td><span className={`badge ${page.published ? "badge--active" : "badge--paused"}`}>{page.published ? "Published" : "Unpublished"}</span></td><td className="subtle">{date(page.updatedAt ? new Date(page.updatedAt) : null)}</td></tr>)}</tbody></table></div></div>}
      </section>
      <section className="section" id="editor"><div className="section-heading"><div><span className="eyebrow">Draft workspace</span><h2>Content editor</h2></div></div><ContentEditor key={content.map((item) => `${item.slug}:${item.publishedSnapshotId ?? ""}`).join("|")} siteId={siteId} siteName={site.name} siteDomain={site.domain} schema={schema} pages={pages} initialSlug={selectedPage} aiAvailable={Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL)} /></section>
      <section className="section" id="versions"><div className="section-heading"><div><span className="eyebrow">Published history</span><h2>Versions</h2></div></div><VersionHistory siteId={siteId} snapshots={snapshots.map((item) => ({ id: item._id!.toString(), slug: item.slug, label: item.label, createdBy: item.createdBy, createdAt: new Date(item.createdAt).toISOString() }))} currentVersions={Object.fromEntries(content.map((item) => [item.slug, item.publishedSnapshotId ?? null]))} /></section>
      <section className="section" id="activity"><div className="section-heading"><div><span className="eyebrow">History</span><h2>Recent activity</h2></div></div><div className="card activity-card">{audits.length === 0 ? <p className="subtle">No activity recorded for this site.</p> : audits.map((event) => <div className="activity-row" key={event._id!.toString()}><span className="activity-mark" aria-hidden="true" /><div><strong>{activity(event)}</strong><span>{event.actor}</span></div><time>{date(event.createdAt)}</time></div>)}</div></section>
    </div><aside className="site-aside"><div className="card"><span className="eyebrow">Integration</span><h2>Connection</h2><dl className="fact-list"><div><dt>Status</dt><dd><span className={`badge badge--${site.status}`}>{site.status}</span></dd></div><div><dt>Domain</dt><dd>{site.domain}</dd></div><div><dt>API key</dt><dd className="mono">****{site.apiKeyPreview}</dd></div><div><dt>Revalidation</dt><dd>{site.revalidateUrl ? "Configured" : "Not configured"}</dd></div><div><dt>Registered</dt><dd>{date(site.createdAt)}</dd></div></dl></div><SiteSettings siteId={siteId} initial={{ name: site.name, domain: site.domain, status: site.status, revalidateUrl: site.revalidateUrl ?? "" }} /><div className="card side-note"><span className="eyebrow">Publishing</span><h2>Review before going live</h2><p className="subtle">Save a draft in the editor, compare it with the published values, then publish through the protected CMS workflow.</p></div></aside></div>
  </>;
}
