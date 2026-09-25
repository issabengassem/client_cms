import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import type { AuditLogDoc, ContentDoc, SiteDoc, SnapshotDoc } from "@/lib/types";
import CreateSiteForm from "./CreateSiteForm";

export const dynamic = "force-dynamic";

function date(value?: Date | null) {
  return value ? new Date(value).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function actionLabel(action: AuditLogDoc["action"]) {
  return ({ site_created: "Site connected", site_updated: "Site settings updated", draft_update: "Draft saved", publish: "Content published", rollback: "Version restored" })[action];
}

export default async function DashboardPage() {
  const db = await getDb();
  const [sites, content, audits, snapshots, draftUpdates] = await Promise.all([
    db.collection<SiteDoc>("sites").find({}, { projection: { apiKeyHash: 0, revalidateSecret: 0 } }).sort({ createdAt: -1 }).toArray(),
    db.collection<ContentDoc>("content").find({}, { projection: { siteId: 1, slug: 1, draft: 1, published: 1, updatedAt: 1 } }).toArray(),
    db.collection<AuditLogDoc>("audit_log").find({}).sort({ createdAt: -1 }).limit(6).toArray(),
    db.collection<SnapshotDoc>("snapshots").aggregate<{ _id: string; lastPublished: Date }>([{ $sort: { createdAt: -1 } }, { $group: { _id: "$siteId", lastPublished: { $first: "$createdAt" } } }]).toArray(),
    db.collection<AuditLogDoc>("audit_log").aggregate<{ _id: string; lastDraft: Date }>([{ $match: { action: "draft_update" } }, { $group: { _id: "$siteId", lastDraft: { $max: "$createdAt" } } }]).toArray(),
  ]);
  const siteName = new Map(sites.map((site) => [site._id!.toString(), site.name]));
  const publishedPages = content.filter((page) => page.published !== null).length;
  const pendingPages = content.filter((page) => JSON.stringify(page.draft ?? {}) !== JSON.stringify(page.published ?? {})).length;

  return <>
    <header className="page-heading"><div><span className="eyebrow">Workspace overview</span><h1>Dashboard</h1><p className="subtle">A clear view of your connected websites and content.</p></div><a className="button-link" href="#register-site">Add a site</a></header>
    <div className="stats-grid">
      <div className="stat-card"><span>Connected sites</span><strong>{sites.length}</strong><small>{sites.filter((site) => site.status === "active").length} active</small></div>
      <div className="stat-card"><span>Published pages</span><strong>{publishedPages}</strong><small>Across all sites</small></div>
      <div className="stat-card"><span>Pages with changes</span><strong>{pendingPages}</strong><small>Draft differs from published</small></div>
      <div className="stat-card"><span>Recent activity</span><strong>{audits.length}</strong><small>Latest recorded events</small></div>
    </div>
    <section className="section" id="sites"><div className="section-heading"><div><span className="eyebrow">Your workspace</span><h2>Sites</h2></div><span className="subtle">{sites.length} total</span></div>
      {sites.length === 0 ? <div className="empty-state">No sites yet. Use the registration form below to connect one.</div> : <div className="card table-card"><div className="table-scroll"><table><thead><tr><th>Site</th><th>Status</th><th>Content</th><th>Last draft</th><th>Last publish</th><th aria-label="Action" /></tr></thead><tbody>{sites.map((site) => {
        const id = site._id!.toString();
        const pages = content.filter((page) => page.siteId === id);
        const latestDraft = draftUpdates.find((item) => item._id === id)?.lastDraft;
        const latestPublish = snapshots.find((snapshot) => snapshot._id === id)?.lastPublished;
        return <tr key={id}><td><Link className="table-title" href={`/dashboard/${id}`}>{site.name}</Link><span className="table-description">{site.domain}</span></td><td><span className={`badge badge--${site.status}`}>{site.status}</span></td><td>{pages.length} {pages.length === 1 ? "page" : "pages"}</td><td className="subtle">{date(latestDraft)}</td><td className="subtle">{date(latestPublish)}</td><td><Link className="text-link" href={`/dashboard/${id}`}>Open →</Link></td></tr>;
      })}</tbody></table></div></div>}
    </section>
    <section className="section" id="activity"><div className="section-heading"><div><span className="eyebrow">Recent changes</span><h2>Activity</h2></div></div><div className="card activity-card">{audits.length === 0 ? <p className="subtle">No activity recorded yet.</p> : audits.map((event) => <div className="activity-row" key={event._id!.toString()}><span className="activity-mark" aria-hidden="true" /><div><strong>{actionLabel(event.action)}</strong><span>{siteName.get(event.siteId) ?? "Unknown site"} · {event.actor}</span></div><time>{date(event.createdAt)}</time></div>)}</div></section>
    <section className="section" id="register-site"><div className="section-heading"><div><span className="eyebrow">Onboarding</span><h2>Register a site</h2></div></div><CreateSiteForm /></section>
  </>;
}
