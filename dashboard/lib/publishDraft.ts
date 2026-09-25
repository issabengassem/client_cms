import { validateCompleteDraft } from "./contentSchema.ts";
import type {
  AuditLogDoc,
  ContentDoc,
  ContentFieldMap,
  SiteDoc,
  SnapshotDoc,
} from "./types";

export interface PublishStore {
  findSite(siteId: string): Promise<SiteDoc | null>;
  findContent(siteId: string, slug: string): Promise<ContentDoc | null>;
  createSnapshot(snapshot: SnapshotDoc): Promise<string>;
  setPublished(
    siteId: string,
    slug: string,
    content: ContentFieldMap,
    snapshotId: string,
    updatedAt: Date
  ): Promise<void>;
  recordAudit(event: AuditLogDoc): Promise<void>;
}

interface PublishDraftInput {
  siteId: string;
  slug: string;
  label?: string;
  actor: string;
}

export type PublishDraftResult =
  | { ok: false; error: string; status: 400 | 404 }
  | { ok: true; snapshotId: string; site: SiteDoc };

export async function publishDraft(
  store: PublishStore,
  input: PublishDraftInput,
  now: () => Date = () => new Date()
): Promise<PublishDraftResult> {
  const site = await store.findSite(input.siteId);
  if (!site) {
    return { ok: false, error: "Site not found", status: 404 };
  }

  if (!site.contentSchema?.[input.slug]) {
    return {
      ok: false,
      error: `Slug '${input.slug}' is not approved for this site`,
      status: 400,
    };
  }

  const content = await store.findContent(input.siteId, input.slug);
  if (!content || Object.keys(content.draft ?? {}).length === 0) {
    return {
      ok: false,
      error: "No draft content to publish for this page",
      status: 400,
    };
  }

  const validation = validateCompleteDraft(
    site.contentSchema,
    input.slug,
    content.draft
  );
  if (!validation.ok) {
    return { ok: false, error: validation.error, status: 400 };
  }

  const createdAt = now();
  const snapshotId = await store.createSnapshot({
    siteId: input.siteId,
    slug: input.slug,
    content: validation.draft,
    label: input.label,
    createdAt,
    createdBy: input.actor,
  });

  await store.setPublished(
    input.siteId,
    input.slug,
    validation.draft,
    snapshotId,
    now()
  );

  await store.recordAudit({
    siteId: input.siteId,
    action: "publish",
    actor: input.actor,
    details: `slug=${input.slug} snapshot=${snapshotId}`,
    createdAt: now(),
  });

  return { ok: true, snapshotId, site };
}
