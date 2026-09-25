"use client";

import { useEffect, useRef } from "react";
import { fieldLabel, friendlyLabel } from "@/lib/editorLabels";
import type { ContentFieldMap } from "@/lib/types";

interface Props {
  open: boolean;
  siteName: string;
  siteDomain: string;
  slug: string;
  draft: ContentFieldMap;
  published: ContentFieldMap | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PublishDialog({ open, siteName, siteDomain, slug, draft, published, busy, error, onClose, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const changes = Object.entries(draft).filter(([path, field]) => field.value !== published?.[path]?.value);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return <dialog ref={dialog} className="publish-dialog" aria-labelledby="publish-title" aria-describedby="publish-description" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="publish-dialog__header">
      <div className="publish-dialog__icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V3m-5 5 5-5 5 5M5 14v6h14v-6" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      <button type="button" className="publish-dialog__close" aria-label="Close publish review" disabled={busy} onClick={onClose}>×</button>
      <span className="eyebrow">Ready for the world</span>
      <h2 id="publish-title">Publish your changes</h2>
      <p id="publish-description">Review the final wording before updating {siteName}.</p>
      <div className="publish-destination"><span className="publish-destination__dot" /><strong>{siteDomain || siteName}</strong><span>{friendlyLabel(slug)} page</span></div>
    </div>
    <div className="publish-dialog__body">
      <div className="publish-review-heading"><h3>What will change</h3><span>{changes.length} {changes.length === 1 ? "update" : "updates"}</span></div>
      {changes.map(([path, field]) => <section key={path} className="publish-change"><h4>{fieldLabel(path)}</h4><div className="publish-change__columns"><div><span>Currently published</span><p>{published?.[path]?.value || "Not published yet"}</p></div><div><span>New version</span><p>{field.value}</p></div></div></section>)}
      <p className="publish-history-note"><span aria-hidden="true">↶</span> A version is saved in your history, so you can restore it later.</p>
      {error && <p className="publish-error" role="alert">{error}</p>}
    </div>
    <div className="publish-dialog__footer"><button type="button" className="secondary" autoFocus disabled={busy} onClick={onClose}>Keep editing</button><button type="button" disabled={busy || changes.length === 0} onClick={onConfirm}>{busy ? "Publishing…" : "Publish to website"}<span aria-hidden="true"> ↗</span></button></div>
  </dialog>;
}
