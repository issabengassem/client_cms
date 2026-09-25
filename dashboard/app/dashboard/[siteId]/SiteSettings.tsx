"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Settings = { name: string; domain: string; status: "active" | "paused"; revalidateUrl: string };

export default function SiteSettings({ siteId, initial }: { siteId: string; initial: Settings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const changed = Object.keys(form).some((key) => form[key as keyof Settings] !== saved[key as keyof Settings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const update = Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== saved[key as keyof Settings]));
    if (Object.keys(update).length === 0) return;
    if (update.status === "paused" && !window.confirm("Pause this site? Its published-content API will stop serving content until you reactivate it.")) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update site settings.");
      setSaved(form);
      setNotice({ kind: "success", text: "Site settings saved." });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update site settings." });
    } finally {
      setPending(false);
    }
  }

  return <form className="card site-settings" id="settings" onSubmit={submit}>
    <span className="eyebrow">Configuration</span>
    <h2>Site settings</h2>
    <label htmlFor="site-name">Name</label>
    <input id="site-name" type="text" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
    <label htmlFor="site-domain">Domain</label>
    <input id="site-domain" type="text" required value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} />
    <label htmlFor="site-status">Status</label>
    <select id="site-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Settings["status"] })}>
      <option value="active">Active</option><option value="paused">Paused</option>
    </select>
    <p className="settings-help">Pausing a site blocks requests to its published-content API.</p>
    <label htmlFor="site-revalidate">Revalidation URL</label>
    <input id="site-revalidate" type="url" placeholder="https://example.com/api/revalidate" value={form.revalidateUrl} onChange={(event) => setForm({ ...form, revalidateUrl: event.target.value })} />
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error-text" : "success-text"}>{notice.text}</p>}
    <button type="submit" disabled={!changed || pending}>{pending ? "Saving..." : "Save settings"}</button>
  </form>;
}
