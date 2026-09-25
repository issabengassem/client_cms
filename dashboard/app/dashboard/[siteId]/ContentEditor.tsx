"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldLabel, friendlyLabel } from "@/lib/editorLabels";
import type { ContentFieldMap, SiteContentSchema } from "@/lib/types";
import AiAssistant from "./AiAssistant";
import PublishDialog from "./PublishDialog";

interface PageState {
  slug: string;
  draft: ContentFieldMap;
  published: ContentFieldMap | null;
  updatedAt: string | null;
  lastPublished: string | null;
}

type Notice = { kind: "success" | "error"; message: string } | null;

function sectionOf(path: string) {
  return path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "General";
}

export default function ContentEditor({ siteId, siteName, siteDomain, schema, pages: initialPages, initialSlug, aiAvailable }: { siteId: string; siteName: string; siteDomain: string; schema: SiteContentSchema; pages: PageState[]; initialSlug?: string; aiAvailable: boolean }) {
  const router = useRouter();
  const editable = initialPages.filter((item) => schema[item.slug] && Object.keys(schema[item.slug].fields).length > 0);
  const startingPage = editable.find((item) => item.slug === initialSlug) ?? editable[0];
  const [pages, setPages] = useState(initialPages);
  const [slug, setSlug] = useState(startingPage?.slug ?? "");
  const [valuesBySlug, setValuesBySlug] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(initialPages.map((item) => [item.slug, Object.fromEntries(Object.entries(item.draft).map(([path, value]) => [path, value.value]))]))
  );
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSlug && editable.some((item) => item.slug === initialSlug)) setSlug(initialSlug);
  }, [initialSlug]);

  const page = pages.find((item) => item.slug === slug);
  const values = valuesBySlug[slug] ?? {};
  const fields = schema[slug]?.fields ?? {};
  const groups = Object.groupBy(Object.keys(fields), sectionOf);
  const savedValue = (path: string) => page?.draft[path]?.value ?? page?.published?.[path]?.value ?? "";
  const valueOf = (path: string) => values[path] ?? savedValue(path);
  const dirty = Object.keys(fields).some((path) => valueOf(path) !== savedValue(path));
  const hasDraft = !!page && Object.keys(page.draft).length > 0;
  const changesReady = hasDraft && JSON.stringify(page?.draft) !== JSON.stringify(page?.published ?? {});

  function setCurrentValue(path: string, value: string) {
    setValuesBySlug((current) => ({ ...current, [slug]: { ...current[slug], [path]: value } }));
  }

  async function saveDraft() {
    if (!page) return;
    const patch: ContentFieldMap = {};
    for (const [path, rule] of Object.entries(fields)) {
      const value = valueOf(path);
      if (value !== savedValue(path)) {
        if (!value.trim()) {
          setNotice({ kind: "error", message: `${fieldLabel(path)} cannot be empty.` });
          return;
        }
        patch[path] = { type: rule.type, value };
      }
    }
    if (Object.keys(patch).length === 0) return;
    setBusy("save");
    setNotice(null);
    try {
      const response = await fetch(`/api/content/${encodeURIComponent(siteId)}/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: patch }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save draft.");
      setPages((current) => current.map((item) => item.slug === slug ? { ...item, draft: result.draft, updatedAt: new Date().toISOString() } : item));
      setNotice({ kind: "success", message: "Draft saved. Your live website has not changed." });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not save draft." });
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!page || !hasDraft || dirty || !changesReady) return;
    setBusy("publish");
    setPublishError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, slug }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not publish content.");
      setPages((current) => current.map((item) => item.slug === slug ? { ...item, published: { ...item.draft }, lastPublished: new Date().toISOString() } : item));
      setReviewOpen(false);
      setNotice({ kind: "success", message: result.revalidated ? "Published. Website refresh confirmed." : "Published. Your website will use this version on its next content refresh." });
      router.refresh();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Could not publish content.");
    } finally {
      setBusy(null);
    }
  }

  if (editable.length === 0) return <div className="card editor-empty">
    <span className="eyebrow">Editing setup</span>
    <h3>This website has no editable content yet</h3>
    <p>The website is connected, but its setup has not approved any text or images for changes. AI cannot suggest edits until the site owner enables specific content during onboarding.</p>
    <p className="subtle">Nothing is wrong with your AI connection. The CMS will show the approved areas here as soon as the website setup provides them.</p>
  </div>;

  return <div className="card editor-card">
    <div className="editor-toolbar"><div><label htmlFor="editor-page">Page</label><select id="editor-page" value={slug} onChange={(event) => { setSlug(event.target.value); setNotice(null); }}>{editable.map((item) => <option key={item.slug} value={item.slug}>{friendlyLabel(item.slug)}</option>)}</select></div><span className={`badge ${dirty ? "badge--warning" : changesReady ? "badge--paused" : "badge--active"}`}>{dirty ? "Unsaved changes" : changesReady ? "Draft ready to publish" : page?.published ? "Live and up to date" : "Not published"}</span></div>
    <div className="editor-workspace">
      <div className="editor-fields">
        <div className="editor-intro"><h3>{friendlyLabel(slug)} page</h3><p className="subtle">Change the areas below. Save a draft first; publish only when you are ready.</p></div>
        {Object.entries(groups).map(([section, paths]) => <section className="field-section" key={section}><div className="field-section__heading"><span className="field-section__mark" /><h3>{fieldLabel(section)}</h3></div>{paths?.map((path) => {
          const rule = fields[path];
          const value = valueOf(path);
          return <div className="field-control" key={path}><label htmlFor={`field-${path}`}>{friendlyLabel(path.split(".").at(-1) ?? path)}</label><textarea id={`field-${path}`} rows={rule.type === "richtext" ? 6 : 3} maxLength={rule.maxLength} minLength={rule.minLength} value={value} onChange={(event) => { setCurrentValue(path, event.target.value); setNotice(null); }} placeholder={`Enter ${friendlyLabel(path.split(".").at(-1) ?? path).toLowerCase()}`} />{rule.maxLength && <div className="field-hint"><span>{value.length} / {rule.maxLength} characters</span></div>}</div>;
        })}</section>)}
        <details className="editor-advanced"><summary>Technical field details</summary>{Object.entries(fields).map(([path, rule]) => <p key={path}><code>{path}</code> · {rule.type}</p>)}</details>
      </div>
      <aside className="editor-review">
        <AiAssistant key={`${slug}:${page?.updatedAt ?? ""}:${page?.lastPublished ?? ""}`} siteId={siteId} slug={slug} available={aiAvailable} fields={fields} formValues={values} hasUnsavedChanges={dirty} onApply={(path, value) => { setCurrentValue(path, value); setNotice(null); }} />
        <div className="review-current"><span className="eyebrow">Saved and live</span><h3>Where your changes stand</h3><p className="subtle">Your live website stays the same until you publish.</p>{Object.keys(fields).map((path) => <div className="review-field" key={path}><strong>{fieldLabel(path)}</strong><span>Saved draft</span><p>{page?.draft[path]?.value ?? "No saved draft yet"}</p><span>Live website</span><p>{page?.published?.[path]?.value ?? "Not published"}</p></div>)}</div>
      </aside>
    </div>
    <div className="editor-footer"><div><span className="subtle">{dirty ? "Save your changes before publishing." : changesReady ? "Your saved draft is ready to publish." : hasDraft ? "Your saved draft and live content match." : "No saved draft yet."}</span>{notice && <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error-text" : "success-text"}>{notice.message}</p>}{/^[a-z0-9.-]+(?::\d+)?$/i.test(siteDomain) && <a className="editor-live-link" href={`https://${siteDomain}`} target="_blank" rel="noopener noreferrer">View live website <span aria-hidden="true">↗</span></a>}</div><div className="editor-actions"><button className="secondary" type="button" onClick={saveDraft} disabled={!dirty || busy !== null}>{busy === "save" ? "Saving..." : "Save draft"}</button><button type="button" onClick={() => { setPublishError(null); setReviewOpen(true); }} disabled={dirty || !changesReady || busy !== null}>Review & publish</button></div></div>
    <PublishDialog open={reviewOpen} siteName={siteName} siteDomain={siteDomain} slug={slug} draft={page?.draft ?? {}} published={page?.published ?? null} busy={busy === "publish"} error={publishError} onClose={() => setReviewOpen(false)} onConfirm={publish} />
  </div>;
}
