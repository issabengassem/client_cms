import { validateDraftPatch } from "./contentSchema.ts";
import type { ContentFieldMap, SiteContentSchema } from "./types";

export function parseAiSuggestion(
  content: unknown,
  schema: SiteContentSchema,
  slug: string
): { ok: true; suggestions: ContentFieldMap } | { ok: false; error: string } {
  if (typeof content !== "string") return { ok: false, error: "AI response was not text" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { ok: false, error: "AI response was not valid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "AI response was not an object" };
  }
  const changes = (parsed as Record<string, unknown>).changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return { ok: false, error: "AI response had no changes" };
  }
  if (Object.keys(changes).length === 0) {
    return { ok: false, error: "AI response had no changes" };
  }
  const patch: ContentFieldMap = {};
  for (const [path, value] of Object.entries(changes)) {
    const rule = schema[slug]?.fields[path];
    if (!rule || typeof value !== "string") {
      return { ok: false, error: "AI response included an unapproved field or value" };
    }
    patch[path] = { type: rule.type, value };
  }
  const validation = validateDraftPatch(schema, slug, patch);
  if (!validation.ok) return { ok: false, error: validation.error };
  return { ok: true, suggestions: validation.draft };
}

export function changedAiSuggestions(suggestions: ContentFieldMap, currentValues: Record<string, string>): ContentFieldMap {
  return Object.fromEntries(Object.entries(suggestions).filter(([path, field]) => field.value !== currentValues[path]));
}
