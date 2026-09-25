import type {
  ContentFieldMap,
  ContentFieldRule,
  ContentFieldType,
  SiteContentSchema,
} from "./types";

const SUPPORTED_FIELD_TYPES = new Set<ContentFieldType>([
  "text",
  "richtext",
  "image",
  "metadata",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value) &&
    value.split(".").every((part) => part && !["__proto__", "prototype", "constructor"].includes(part));
}

export function validateContentSchema(
  value: unknown
): { ok: true; schema: SiteContentSchema } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "contentSchema must be an object" };
  }

  const schema: SiteContentSchema = {};

  for (const [slug, pageValue] of Object.entries(value)) {
    if (!isSafeIdentifier(slug) || !isRecord(pageValue) || !isRecord(pageValue.fields)) {
      return { ok: false, error: `Invalid content schema for slug '${slug}'` };
    }

    const fields: Record<string, ContentFieldRule> = {};
    for (const [path, ruleValue] of Object.entries(pageValue.fields)) {
      if (!isSafeIdentifier(path) || !isRecord(ruleValue) || !SUPPORTED_FIELD_TYPES.has(ruleValue.type as ContentFieldType)) {
        return { ok: false, error: `Invalid content schema rule for '${slug}.${path}'` };
      }

      const rule: ContentFieldRule = { type: ruleValue.type as ContentFieldType };
      if (ruleValue.minLength !== undefined) {
        if (!isPositiveInteger(ruleValue.minLength)) {
          return { ok: false, error: `Invalid minLength for '${slug}.${path}'` };
        }
        rule.minLength = ruleValue.minLength;
      }
      if (ruleValue.maxLength !== undefined) {
        if (!isPositiveInteger(ruleValue.maxLength)) {
          return { ok: false, error: `Invalid maxLength for '${slug}.${path}'` };
        }
        rule.maxLength = ruleValue.maxLength;
      }
      if (rule.minLength && rule.maxLength && rule.minLength > rule.maxLength) {
        return { ok: false, error: `minLength exceeds maxLength for '${slug}.${path}'` };
      }

      fields[path] = rule;
    }

    schema[slug] = { fields };
  }

  return { ok: true, schema };
}

export function validateDraftPatch(
  schema: SiteContentSchema | undefined,
  slug: string,
  value: unknown
): { ok: true; draft: ContentFieldMap } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must include a 'draft' object" };
  }

  const pageSchema = schema?.[slug];
  if (!pageSchema) {
    return { ok: false, error: `Slug '${slug}' is not approved for this site` };
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return { ok: false, error: "Draft patch must contain at least one field" };
  }

  const draft: ContentFieldMap = {};

  for (const [path, fieldValue] of entries) {
    if (!isSafeIdentifier(path)) {
      return { ok: false, error: `Field '${path}' is not a safe path` };
    }
    const rule = pageSchema.fields[path];
    if (!rule) {
      return { ok: false, error: `Field '${path}' is not approved for slug '${slug}'` };
    }
    if (!isRecord(fieldValue)) {
      return { ok: false, error: `Field '${path}' must be an object` };
    }
    if (fieldValue.type !== rule.type) {
      return {
        ok: false,
        error: `Field '${path}' must use type '${rule.type}'`,
      };
    }
    if (typeof fieldValue.value !== "string") {
      return { ok: false, error: `Field '${path}' value must be a string` };
    }
    if (fieldValue.value.trim().length === 0) {
      return { ok: false, error: `Field '${path}' value cannot be empty` };
    }
    if (rule.minLength && fieldValue.value.length < rule.minLength) {
      return { ok: false, error: `Field '${path}' value is too short` };
    }
    if (rule.maxLength && fieldValue.value.length > rule.maxLength) {
      return { ok: false, error: `Field '${path}' value is too long` };
    }

    draft[path] = { type: rule.type, value: fieldValue.value };
  }

  return { ok: true, draft };
}

// Publication validates every field currently present in the draft. Schema
// rules do not currently mark fields as required, so a valid complete draft
// may contain any non-empty subset of the approved fields.
export function validateCompleteDraft(
  schema: SiteContentSchema | undefined,
  slug: string,
  value: unknown
): { ok: true; draft: ContentFieldMap } | { ok: false; error: string } {
  return validateDraftPatch(schema, slug, value);
}

export function mergeDraft(
  existing: ContentFieldMap | null | undefined,
  patch: ContentFieldMap
): ContentFieldMap {
  return { ...(existing ?? {}), ...patch };
}
