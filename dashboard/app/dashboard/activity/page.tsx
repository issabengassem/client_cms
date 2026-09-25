import Link from "next/link";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { AuditLogDoc, SiteDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const actions: AuditLogDoc["action"][] = ["site_created", "site_updated", "draft_update", "publish", "rollback"];
const labels: Record<AuditLogDoc["action"], string> = {
  site_created: "Site connected",
  site_updated: "Site settings updated",
  draft_update: "Draft saved",
  publish: "Content published",
  rollback: "Version restored",
};

function target(event: AuditLogDoc) {
  if (!event.details) return "-";
  if (event.action === "draft_update") {
    try {
      const details = JSON.parse(event.details);
      if (typeof details.slug === "string" && Array.isArray(details.fields)) return `${details.slug} / ${details.fields.join(", ")}`;
    } catch { return "-"; }
  }
  if (event.action === "site_updated") {
    try {
      const details = JSON.parse(event.details);
      if (Array.isArray(details.fields)) return details.fields.join(", ");
    } catch { return "-"; }
  }
  const match = event.details.match(/(?:^|\s)slug=([^\s]+)/);
  return match?.[1] ?? "-";
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ site?: string; action?: string; page?: string }> }) {
  const query = await searchParams;
  const db = await getDb();
  const sites = await db.collection<SiteDoc>("sites").find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
  const selectedSite = sites.some((site) => site._id!.toString() === query.site) ? query.site : "";
  const selectedAction = actions.includes(query.action as AuditLogDoc["action"]) ? query.action as AuditLogDoc["action"] : "";
  const page = Math.min(100, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const filter: { siteId?: string; action?: AuditLogDoc["action"] } = {};
  if (selectedSite) filter.siteId = selectedSite;
  if (selectedAction) filter.action = selectedAction;
  const [events, count] = await Promise.all([
    db.collection<AuditLogDoc>("audit_log").find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).toArray(),
    db.collection<AuditLogDoc>("audit_log").countDocuments(filter),
  ]);
  const siteNames = new Map(sites.map((site) => [site._id!.toString(), site.name]));
  const hrefFor = (nextPage: number) => `/dashboard/activity?${new URLSearchParams({ ...(selectedSite ? { site: selectedSite } : {}), ...(selectedAction ? { action: selectedAction } : {}), page: String(nextPage) })}`;

  return <>
    <header className="page-heading"><div><span className="eyebrow">Audit trail</span><h1>Activity</h1><p className="subtle">Changes across connected sites, newest first.</p></div></header>
    <form className="filter-bar" action="/dashboard/activity" method="get">
      <div><label htmlFor="activity-site">Site</label><select id="activity-site" name="site" defaultValue={selectedSite}><option value="">All sites</option>{sites.map((site) => <option key={site._id!.toString()} value={site._id!.toString()}>{site.name}</option>)}</select></div>
      <div><label htmlFor="activity-action">Action</label><select id="activity-action" name="action" defaultValue={selectedAction}><option value="">All actions</option>{actions.map((action) => <option key={action} value={action}>{labels[action]}</option>)}</select></div>
      <button type="submit">Apply filters</button>
    </form>
    <div className="card table-card"><div className="table-scroll"><table><thead><tr><th>Action</th><th>Site</th><th>Page / fields</th><th>User</th><th>When</th></tr></thead><tbody>{events.map((event) => <tr key={event._id!.toString()}><td><strong>{labels[event.action]}</strong></td><td>{ObjectId.isValid(event.siteId) ? <Link className="text-link" href={`/dashboard/${event.siteId}`}>{siteNames.get(event.siteId) ?? "Unknown site"}</Link> : "Unknown site"}</td><td className="subtle">{target(event)}</td><td className="subtle">{event.actor}</td><td className="subtle">{new Date(event.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>{events.length === 0 && <div className="empty-state">No activity matches these filters.</div>}</div>
    <div className="pagination"><span>{count} events / page {page}</span><div>{page > 1 && <Link href={hrefFor(page - 1)}>Previous</Link>}{page * 50 < count && <Link href={hrefFor(page + 1)}>Next</Link>}</div></div>
  </>;
}
