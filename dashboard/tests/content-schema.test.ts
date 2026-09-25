import assert from "node:assert/strict";
import test from "node:test";
import { mergeDraft, validateContentSchema, validateDraftPatch } from "../lib/contentSchema.ts";
import type { SiteContentSchema } from "../lib/types";

const schema: SiteContentSchema = {
  home: {
    fields: {
      "hero.eyebrow": { type: "text", maxLength: 120 },
    },
  },
};

test("accepts the approved Dhamna field", () => {
  const result = validateDraftPatch(schema, "home", {
    "hero.eyebrow": { type: "text", value: "A MORE INTENTIONAL WAY TO STAY" },
  });

  assert.equal(result.ok, true);
});

test("rejects an unknown slug", () => {
  const result = validateDraftPatch(schema, "about", {
    "hero.eyebrow": { type: "text", value: "Test" },
  });

  assert.equal(result.ok, false);
});

test("rejects an unapproved field path", () => {
  const result = validateDraftPatch(schema, "home", {
    "hero.title": { type: "text", value: "Test" },
  });

  assert.equal(result.ok, false);
});

test("rejects prototype paths in site schemas and draft patches", () => {
  const unsafeSchema = validateContentSchema(JSON.parse('{"home":{"fields":{"__proto__":{"type":"text"}}}}'));
  assert.equal(unsafeSchema.ok, false);
  const unsafePatch = validateDraftPatch(schema, "home", JSON.parse('{"__proto__":{"type":"text","value":"bad"}}'));
  assert.equal(unsafePatch.ok, false);
});

test("rejects an invalid field type", () => {
  const result = validateDraftPatch(schema, "home", {
    "hero.eyebrow": { type: "image", value: "Test" },
  });

  assert.equal(result.ok, false);
});

test("rejects invalid text values", () => {
  const empty = validateDraftPatch(schema, "home", {
    "hero.eyebrow": { type: "text", value: "   " },
  });
  const tooLong = validateDraftPatch(schema, "home", {
    "hero.eyebrow": { type: "text", value: "x".repeat(121) },
  });

  assert.equal(empty.ok, false);
  assert.equal(tooLong.ok, false);
});

test("merges one field without deleting other draft fields", () => {
  const merged = mergeDraft(
    { "legacy.field": { type: "text", value: "keep me" } },
    { "hero.eyebrow": { type: "text", value: "new value" } }
  );

  assert.deepEqual(merged, {
    "legacy.field": { type: "text", value: "keep me" },
    "hero.eyebrow": { type: "text", value: "new value" },
  });
});
