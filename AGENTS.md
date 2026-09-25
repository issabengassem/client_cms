# Central CMS project instructions

## Purpose

Maintain the existing central CMS for multiple independently built client websites, usually Next.js/Vercel projects. Keep it reusable across current and future clients. Do not rebuild the CMS, create a demo website, or teach website creation unless requested.

Read `README.md` and `dashboard/README.md`, then inspect relevant implementation before changing anything. Reuse existing architecture and APIs; make the smallest necessary change. Application paths below are relative to `dashboard/`.

## Implementation facts

- Next.js App Router, React, TypeScript, and the MongoDB driver; run application commands from `dashboard/`.
- Authentication: `app/login/`, `lib/session.ts`, `lib/crypto.ts`, and `proxy.ts`. Passwords use bcrypt; sessions use signed JWT cookies. Proxy checks cookie presence; routes/pages verify sessions.
- `scripts/create-admin-user.mjs` can replace an existing account's password. Do not run it for an existing user without authorization to reset that account.
- `lib/mongodb.ts` and `lib/types.ts` define access and document shapes for `sites`, `content`, `snapshots`, `users`, and `audit_log`. Content uses dotted field keys mapped to `{ type, value }`, scoped by canonical `siteId` and page `slug`. Each site can store a server-enforced `contentSchema`; an empty or missing schema denies draft writes.
- `app/dashboard/` provides site registration, an overview, activity views, schema-driven site/page editing, site settings, published version history, and an admin-only read-only users list. Registration also exists at `POST /api/sites`; keep the API and server action consistent.
- Registration accepts an operator session or `ADMIN_API_TOKEN` and returns a MongoDB-generated site ID, a one-time site API key, and a revalidation secret. Site API keys are stored hashed.
- Operator-session APIs handle site management, draft reads/writes, snapshot history, publish, and rollback. `GET /api/public/content/[siteId]/[slug]` checks the site key, active status, and matching ID and returns published content only.
- Publish verifies the registered site, approved slug, and complete draft against the site's content schema before writing. A valid publish creates a snapshot; rollback restores a matching site/page snapshot without replacing the draft or deleting history. `lib/revalidate.ts` sends best-effort refresh requests.

## Gaps: do not present these as finished

The draft API enforces each site's configured slug, field path, field type, and basic string constraints. It does not yet provide full Guardian validation for every supported content type or operator permissions scoped to individual client sites. Admin/editor labels do not provide client isolation. Rich visual editing, image upload, full preview, multi-turn AI chat, and key rotation are not established features. The optional OpenRouter panel can propose validated field changes when server variables are configured; it cannot save or publish by itself. One live proposal passed validation in Preview on 2026-09-24. The public content handler does not implement the preview behavior mentioned in its comment.

Local checks confirm login, MongoDB access, dashboard reads, and the Dhamna draft editing flow. Preview at https://client-iffov0cv5-issabengassem2004-8957s-projects.vercel.app confirmed admin login, overview, site editor, activity, Users, and one AI proposal. Publishing and rollback have not been exercised as part of the Dhamna editor work. Verify current behavior before claiming they work. Production: https://client-cms-nine.vercel.app (Vercel project client-cms; root dashboard). Deployment and read-only authentication/database checks passed on 2026-09-23; the redesigned editor has not been deployed to Production.

## Website configuration and onboarding

Each website owns its design, layout, code, and business logic. Its active `cms.config.js`, where appropriate, belongs beside its own `package.json`. `templates/cms.config.js` here is an inert example, not a global config or implemented permission system.

The bundled `dashboard/cms-onboarder.skill` archive contains documentation, SDK/revalidation templates, and a registration script using `cms.config.json`. Inspect and reconcile that contract with the website's configuration and module system before implementation; the archive is not an installed or verified integration.

When onboarding is requested:

1. Inspect the provided repository/local path, project instructions, framework, and existing CMS integration. Inspect the deployed URL for live behavior when supplied; obtain source access when source changes are needed.
2. Suggest suitable editable pages, sections, and fields. Ask Issa to confirm unresolved content and permission decisions; discovered hardcoded content is not automatic approval.
3. Explain the planned integration, reconcile the actual config/API/SDK contract, and reuse existing registrations. Use the canonical ID returned by the CMS, not a friendly website name.
4. With the required authorization, register and connect the website using server-side credentials and published content for public visitors. Preserve visual design and business logic unless changes are requested.
5. Wire draft seeding, preview, publishing, and secure cache revalidation only through supported, authorized workflows. Never bypass authorization or fabricate sessions to seed content.
6. Test content fetching, site isolation, field permissions, invalid requests, draft/published separation, and publish/rollback behavior where implemented. Report gaps and manual steps.

## Content safety

Preferred workflow: Edit -> Draft -> Guardian -> Preview -> Explicit Publish.

Enforce site membership and permitted fields on the server; frontend configuration is never an authorization boundary. The Guardian must deterministically validate structure, types, required and allowed fields, safe values, and content integrity before publication. Preserve draft/published separation and immutable snapshots; rollback must preserve history.

AI may propose structured changes through the same authorization and Guardian workflow. It must not write directly to MongoDB outside the application's approved workflow or change application code, layout, or authentication without authorization.

## Secrets and authorization

Reuse existing configuration. CMS variables: `MONGODB_URI`, `MONGODB_DB`, `SESSION_SECRET`, `ADMIN_API_TOKEN`; optional AI variables: `OPENROUTER_API_KEY` (Secret) and `OPENROUTER_MODEL` (Config). Client templates use `CMS_BASE_URL`, `CMS_SITE_ID`, `CMS_API_KEY`, and `CMS_REVALIDATE_SECRET`; verify actual integration expectations.

Never expose, print, log, document, or commit secret values or `.env.local`. Keep credentials out of source, browser bundles, and `NEXT_PUBLIC_*` variables. Report missing variable names without their values.

Do not automatically register production sites, create/rotate credentials, modify client repositories, deploy production changes, change production settings, or delete data. Obtain explicit authorization for these actions when it is not already provided in the session. Explain major integration or architectural changes before making them; honor existing authorization without asking again.

## Checks and reporting

For implementation work, run relevant behavior checks and `npm run typecheck`; run `npm run build` before deployment. Test authentication, authorization, and errors as relevant. Documentation-only updates require content review, not database writes or application tests.

Use concise, simple language. Report what was inspected, what already exists, planned changes, files changed, checks performed, and any manual steps or remaining gaps. Do not claim untested functionality works.
