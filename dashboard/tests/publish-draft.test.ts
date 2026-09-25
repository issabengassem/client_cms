import assert from "node:assert/strict";
import test from "node:test";
import { publishDraft, type PublishStore } from "../lib/publishDraft.ts";
import type {
  AuditLogDoc,
  ContentDoc,
  ContentFieldMap,
  SiteDoc,
  SnapshotDoc,
} from "../lib/types";

const SITE_ID = "6ab46563cab67088362a335e";
const TEST_VALUE = "A MORE INTENTIONAL WAY TO STAY";

const site: SiteDoc = {
  name: "Dhamna",
  domain: "dhamna.test",
  apiKeyHash: "test-hash",
  apiKeyPreview: "test",
  status: "active",
  createdAt: new Date("2026-09-24T00:00:00.000Z"),
  contentSchema: {
    home: {
      fields: {
        "hero.eyebrow": { type: "text", maxLength: 120 },
      },
    },
  },
};

function createContent(draft: ContentFieldMap): ContentDoc {
  return {
    siteId: SITE_ID,
    slug: "home",
    draft,
    published: { "hero.eyebrow": { type: "text", value: "OLD VALUE" } },
    publishedSnapshotId: "old-snapshot",
    updatedAt: new Date("2026-09-24T00:00:00.000Z"),
  };
}

class MemoryPublishStore implements PublishStore {
  snapshots: SnapshotDoc[] = [];
  audits: AuditLogDoc[] = [];
  registeredSite: SiteDoc | null;
  content: ContentDoc | null;

  constructor(registeredSite: SiteDoc | null, content: ContentDoc | null) {
    this.registeredSite = registeredSite;
    this.content = content;
  }

  async findSite() {
    return this.registeredSite;
  }

  async findContent() {
    return this.content;
  }

  async createSnapshot(snapshot: SnapshotDoc) {
    this.snapshots.push(snapshot);
    return "new-snapshot";
  }

  async setPublished(
    _siteId: string,
    _slug: string,
    content: ContentFieldMap,
    snapshotId: string,
    updatedAt: Date
  ) {
    assert.ok(this.content);
    this.content.published = content;
    this.content.publishedSnapshotId = snapshotId;
    this.content.updatedAt = updatedAt;
  }

  async recordAudit(event: AuditLogDoc) {
    this.audits.push(event);
  }
}

async function run(store: MemoryPublishStore, slug = "home") {
  return publishDraft(
    store,
    {
      siteId: SITE_ID,
      slug,
      label: "Dhamna first publish",
      actor: "operator@example.test",
    },
    () => new Date("2026-09-24T12:00:00.000Z")
  );
}

test("accepts the valid Dhamna publication payload", async () => {
  const store = new MemoryPublishStore(
    site,
    createContent({
      "hero.eyebrow": { type: "text", value: TEST_VALUE },
    })
  );

  const result = await run(store);

  assert.equal(result.ok, true);
  assert.equal(store.content?.published?.["hero.eyebrow"].value, TEST_VALUE);
});

test("rejects an unknown site ID before creating publication records", async () => {
  const store = new MemoryPublishStore(
    null,
    createContent({ "hero.eyebrow": { type: "text", value: TEST_VALUE } })
  );

  const result = await run(store);

  assert.deepEqual(result, { ok: false, error: "Site not found", status: 404 });
  assert.equal(store.snapshots.length, 0);
  assert.equal(store.audits.length, 0);
});

test("rejects an unknown slug", async () => {
  const store = new MemoryPublishStore(
    site,
    createContent({ "hero.eyebrow": { type: "text", value: TEST_VALUE } })
  );

  const result = await run(store, "about");

  assert.equal(result.ok, false);
  assert.equal(store.snapshots.length, 0);
});

test("rejects a draft containing an unapproved field", async () => {
  const store = new MemoryPublishStore(
    site,
    createContent({ "hero.title": { type: "text", value: "Not approved" } })
  );

  const result = await run(store);

  assert.equal(result.ok, false);
  assert.equal(store.snapshots.length, 0);
});

test("rejects a draft containing an invalid type", async () => {
  const store = new MemoryPublishStore(
    site,
    createContent({ "hero.eyebrow": { type: "image", value: TEST_VALUE } })
  );

  const result = await run(store);

  assert.equal(result.ok, false);
  assert.equal(store.snapshots.length, 0);
});

test("invalid draft leaves published content unchanged", async () => {
  const content = createContent({
    "hero.eyebrow": { type: "text", value: "x".repeat(121) },
  });
  const originalPublished = structuredClone(content.published);
  const store = new MemoryPublishStore(site, content);

  const result = await run(store);

  assert.equal(result.ok, false);
  assert.deepEqual(content.published, originalPublished);
  assert.equal(store.snapshots.length, 0);
  assert.equal(store.audits.length, 0);
});

test("valid publication creates a snapshot and audit event", async () => {
  const draft = {
    "hero.eyebrow": { type: "text" as const, value: TEST_VALUE },
  };
  const store = new MemoryPublishStore(site, createContent(draft));

  const result = await run(store);

  assert.equal(result.ok, true);
  assert.equal(store.snapshots.length, 1);
  assert.deepEqual(store.snapshots[0].content, draft);
  assert.equal(store.snapshots[0].createdBy, "operator@example.test");
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].action, "publish");
  assert.equal(store.audits[0].details, "slug=home snapshot=new-snapshot");
});
