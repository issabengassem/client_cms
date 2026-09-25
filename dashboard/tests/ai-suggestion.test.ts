import assert from "node:assert/strict";
import { test } from "node:test";
import { changedAiSuggestions, parseAiSuggestion } from "../lib/aiSuggestion.ts";

const schema = { home: { fields: { "hero.title": { type: "text" as const, maxLength: 40 } } } };

test("accepts an approved AI field as a proposal", () => {
  const result = parseAiSuggestion('{"changes":{"hero.title":"A calmer stay"}}', schema, "home");
  assert.deepEqual(result, { ok: true, suggestions: { "hero.title": { type: "text", value: "A calmer stay" } } });
});

test("rejects an unapproved AI field", () => {
  const result = parseAiSuggestion('{"changes":{"hero.subtitle":"Unapproved"}}', schema, "home");
  assert.equal(result.ok, false);
});

test("rejects a suggestion that exceeds the site's limit", () => {
  const result = parseAiSuggestion(JSON.stringify({ changes: { "hero.title": "x".repeat(41) } }), schema, "home");
  assert.equal(result.ok, false);
});

test("rejects empty or invalid model output", () => {
  assert.equal(parseAiSuggestion("not json", schema, "home").ok, false);
  assert.deepEqual(parseAiSuggestion('{"changes":{}}', schema, "home"), { ok: false, error: "AI response had no changes" });
});

test("drops AI suggestions that repeat the current text", () => {
  const suggestions = {
    "hero.title": { type: "text" as const, value: "Current title" },
    "hero.eyebrow": { type: "text" as const, value: "A warmer welcome" },
  };
  assert.deepEqual(changedAiSuggestions(suggestions, { "hero.title": "Current title", "hero.eyebrow": "Old wording" }), {
    "hero.eyebrow": { type: "text", value: "A warmer welcome" },
  });
});
