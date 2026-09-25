"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Version = { id: string; slug: string; label?: string; createdBy?: string; createdAt: string };

export default function VersionHistory({ siteId, snapshots, currentVersions }: { siteId: string; snapshots: Version[]; currentVersions: Record<string, string | null> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function restore(version: Version) {
    if (!window.confirm(`Restore the ${version.slug} page version from ${new Date(version.createdAt).toLocaleString()}? This changes published content. Your current draft stays saved.`)) return;
    setBusy(version.id);
    setNotice(null);
    try {
      const response = await fetch("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, slug: version.slug, snapshotId: version.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not restore this version.");
      setNotice({ kind: "success", text: result.revalidated ? "Version restored and site refresh confirmed." : "Version restored in the CMS. The site did not confirm a refresh." });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not restore this version." });
    } finally {
      setBusy(null);
    }
  }

  if (snapshots.length === 0) return <div className="empty-state">No published versions yet. The first publish will create a snapshot here.</div>;
  return <div className="card table-card">
    <div className="table-scroll"><table><thead><tr><th>Page / version</th><th>Published by</th><th>Published at</th><th aria-label="Action" /></tr></thead><tbody>{snapshots.map((version) => <tr key={version.id}><td><strong className="table-title">{version.slug}</strong><span className="table-description">{version.label || `Version ${version.id.slice(-6)}`}</span></td><td className="subtle">{version.createdBy || "Unknown"}</td><td className="subtle">{new Date(version.createdAt).toLocaleString()}</td><td>{currentVersions[version.slug] === version.id ? <span className="badge badge--active">Current</span> : <button className="secondary button-small" type="button" disabled={busy !== null} onClick={() => restore(version)}>{busy === version.id ? "Restoring..." : "Restore"}</button>}</td></tr>)}</tbody></table></div>
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`version-notice ${notice.kind === "error" ? "error-text" : "success-text"}`}>{notice.text}</p>}
  </div>;
}
