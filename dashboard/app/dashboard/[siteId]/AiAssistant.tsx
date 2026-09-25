"use client";

import { FormEvent, useState } from "react";
import { fieldLabel } from "@/lib/editorLabels";
import type { ContentFieldMap, ContentFieldRule } from "@/lib/types";

interface Proposal {
  suggestions: ContentFieldMap;
  originalValues: Record<string, string>;
}

interface Props {
  siteId: string;
  slug: string;
  available: boolean;
  fields: Record<string, ContentFieldRule>;
  formValues: Record<string, string>;
  hasUnsavedChanges: boolean;
  onApply: (path: string, value: string) => void;
}

export default function AiAssistant({ siteId, slug, available, fields, formValues, hasUnsavedChanges, onApply }: Props) {
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const editablePaths = Object.keys(fields);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasUnsavedChanges || pending) return;
    setPending(true);
    setError("");
    setProposal(null);
    try {
      const response = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, slug, instruction: instruction.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "AI could not suggest a change. Please try again.");
      setProposal({ suggestions: result.suggestions, originalValues: result.originalValues });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI could not suggest a change. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <div className="editor-ai" aria-labelledby="ai-heading">
    <span className="eyebrow">Website assistant</span>
    <h3 id="ai-heading">Ask AI to improve this page</h3>
    <p>Describe the wording you want. You decide whether to use each suggestion.</p>
    <div className="ai-scope"><strong>You can change</strong><ul>{editablePaths.map((path) => <li key={path}>{fieldLabel(path)}</li>)}</ul></div>
    {!available ? <p role="status" className="ai-help">AI suggestions are unavailable right now. Ask your site administrator to check the connection.</p> : <>
      <form onSubmit={generate}>
        <label htmlFor="ai-instruction">What would you like to change?</label>
        <textarea id="ai-instruction" rows={4} minLength={5} maxLength={1000} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Make the headline warmer and shorter" required />
        {hasUnsavedChanges && <p role="status" className="ai-help">Save or undo your current edits before asking AI. It uses the last saved text.</p>}
        <button type="submit" disabled={pending || hasUnsavedChanges || instruction.trim().length < 5}>{pending ? "Thinking..." : "Suggest changes"}</button>
      </form>
      {error && <p role="alert" className="error-text ai-error">{error}</p>}
      {proposal && <div className="ai-suggestions" aria-live="polite"><div className="ai-suggestions__heading"><strong>Review AI suggestions</strong><button type="button" className="ai-dismiss" onClick={() => setProposal(null)}>Dismiss</button></div>
        {Object.entries(proposal.suggestions).map(([path, field]) => {
          const applied = formValues[path] === field.value;
          return <div key={path} className="ai-suggestion"><strong>{fieldLabel(path)}</strong><div className="ai-diff"><div><span>Current saved text</span><p>{proposal.originalValues[path] || "No saved text yet"}</p></div><div><span>Suggested text</span><p>{field.value}</p></div></div><button className="secondary button-small" type="button" disabled={applied} onClick={() => onApply(path, field.value)}>{applied ? "Added to draft" : "Use this suggestion"}</button></div>;
        })}
        <p className="ai-disclosure">Using a suggestion changes only your unsaved editor. Save the draft separately; nothing goes live until you publish.</p>
      </div>}
      <p className="ai-disclosure">AI receives your instruction and this page&apos;s approved saved content through OpenRouter.</p>
    </>}
  </div>;
}
