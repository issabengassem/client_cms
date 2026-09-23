import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import type { SiteDoc } from "@/lib/types";
import CreateSiteForm from "./CreateSiteForm";

export default async function DashboardPage() {
  const db = await getDb();
  const sites = await db
    .collection<SiteDoc>("sites")
    .find({}, { projection: { apiKeyHash: 0, revalidateSecret: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return (
    <>
      <h1>Your sites</h1>
      <p className="subtle">{sites.length} client {sites.length === 1 ? "site" : "sites"} connected</p>

      <div className="section">
        {sites.length === 0 ? (
          <div className="empty-state">
            No sites yet. Register one below, or run the onboarding Skill against a client project.
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>API key</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site._id!.toString()}>
                    <td>
                      <Link href={`/dashboard/${site._id!.toString()}`}>{site.name}</Link>
                    </td>
                    <td className="subtle">{site.domain}</td>
                    <td>
                      <span className={`badge badge--${site.status}`}>{site.status}</span>
                    </td>
                    <td className="mono subtle">...{site.apiKeyPreview}</td>
                    <td className="subtle">{new Date(site.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <CreateSiteForm />
      </div>
    </>
  );
}
