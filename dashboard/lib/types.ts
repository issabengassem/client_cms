// Shared document shapes for the Command Center CMS.
//
// These are intentionally loose TypeScript interfaces rather than an
// enforced Mongoose-style schema -- the whole point of MongoDB here is that
// two different client sites can have wildly different page structures
// without a migration. `draft` and `published` are open records of field
// key -> field value, so a new site can introduce new field keys for free.

export type ContentFieldType = "text" | "richtext" | "image" | "metadata";

export interface ContentFieldValue {
  type: ContentFieldType;
  value: string;
}

export type ContentFieldMap = Record<string, ContentFieldValue>;

export interface ContentFieldRule {
  type: ContentFieldType;
  minLength?: number;
  maxLength?: number;
}

export interface ContentPageSchema {
  fields: Record<string, ContentFieldRule>;
}

export type SiteContentSchema = Record<string, ContentPageSchema>;

export interface SiteDoc {
  _id?: string;
  name: string;
  domain: string;
  vercelProjectId?: string;
  apiKeyHash: string;
  apiKeyPreview: string; // last 4 chars only, so the dashboard can show "...ab12" without holding the real key
  revalidateUrl?: string; // e.g. https://client-site.vercel.app/api/revalidate
  // Unlike apiKeyHash, this one is stored in cleartext: the CMS is the
  // caller when hitting revalidateUrl, so it has to be able to read the
  // secret back out to send it. It flows CMS -> site, the API key flows
  // site -> CMS -- keeping them separate means rotating one never affects
  // the other.
  revalidateSecret?: string;
  // Server-enforced allowlist of page slugs, editable field paths, and
  // accepted value shapes. A missing or empty schema denies all draft writes.
  contentSchema?: SiteContentSchema;
  status: "active" | "paused";
  createdAt: Date;
}

export interface ContentDoc {
  _id?: string;
  siteId: string;
  slug: string; // page identifier, e.g. "home", "about"
  draft: ContentFieldMap;
  published: ContentFieldMap | null;
  publishedSnapshotId?: string | null;
  updatedAt: Date;
}

export interface SnapshotDoc {
  _id?: string;
  siteId: string;
  slug: string;
  content: ContentFieldMap;
  label?: string;
  createdAt: Date;
  createdBy?: string;
}

export interface UserDoc {
  _id?: string;
  email: string;
  passwordHash: string;
  role: "admin" | "editor";
  createdAt: Date;
}

export interface AuditLogDoc {
  _id?: string;
  siteId: string;
  action: "publish" | "rollback" | "draft_update" | "site_created" | "site_updated";
  actor: string; // user email or "onboarding-skill"
  details?: string;
  createdAt: Date;
}
