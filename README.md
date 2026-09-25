# Client Website CMS

Reusable CMS dashboard for managing content across separately deployed client websites.

## Current Preview — 2026-09-24

The latest local dashboard changes are deployed to Vercel Preview at https://client-77pvfy9ix-issabengassem2004-8957s-projects.vercel.app . The Preview build is Ready. On Dhamna, the editor shows only the approved `home` -> `hero.eyebrow` field. Operators can ask OpenRouter for wording, compare saved text with a suggestion, and put an approved suggestion into the unsaved editor. They must still save a draft and explicitly publish. A local browser check generated a suggestion, applied it to the unsaved form, then restored the original text without saving or publishing. A layout request was rejected; the final build improves its out-of-scope message. TypeScript, 19 tests, and local and Vercel builds passed. Authenticated checks of this particular Preview URL are pending sign-in.

## Repository and deployment

Public source: https://github.com/issabengassem/client_cms

The Vercel project is `client-cms`, configured for Next.js with `dashboard` as its root directory. Run `vercel --prod` from this repository root after linking the project. Configure `MONGODB_URI`, `MONGODB_DB`, `SESSION_SECRET`, and `ADMIN_API_TOKEN` in Vercel production environment settings before deployment. Local environment files are excluded from Git and deployment uploads.

## Structure

- `dashboard/` is the central Next.js application. It is the only component that connects to MongoDB.
- `templates/cms.config.js` is an inert example, not a global config. Each onboarded website gets its own active `cms.config.js` beside its `package.json`. The CMS stores a server-side allowlist per registered site; Dhamna's client config and loader now use the same schema shape.
- Client websites will fetch **published** content from the dashboard API using a site-scoped API key. Never put MongoDB credentials in a client website.

The dashboard stores draft and published content separately, captures snapshots on publish, and supports rollback. Each website remains its own project and deployment; the dashboard manages multiple registered sites.

## Start the dashboard

1. In `dashboard/`, copy `.env.example` to `.env.local` and set `MONGODB_URI`, `SESSION_SECRET`, and `ADMIN_API_TOKEN`. Keep `.env.local` private.
2. Run `npm install` and `npm run create-admin` to create the first operator account.
3. Run `npm run dev` and open `http://localhost:3000`.

The first run needs a MongoDB connection and operator credentials. Deployment instructions and the current API surface are in `dashboard/README.md`.

## Onboarding future client websites

When asked to connect a client site, read its project instructions and add `cms.config.js` with that site's stable ID and editable dotted paths. Register the site in this dashboard, then add the site ID, scoped API key, and dashboard URL to the website's private environment configuration. Implement the site-side read integration and revalidation hook appropriate to that website's framework. Only expose published content to the public website. Do not add client registrations or modify existing sites until asked.

Proposed example config shape (reconcile with the SDK during onboarding):

```js
module.exports = {
  siteId: "<registered-site-id>",
  editable: { home: ["hero.title", "hero.description", "hero.image"] },
};
```

The registered Dhamna test site uses canonical ID `6ab46563cab67088362a335e`. Its current server-side allowlist permits only `home` -> `hero.eyebrow` as text. Production now publishes the approved test value; the dashboard work does not change it.

Read `AGENTS.md` for implementation facts, permission requirements, and future onboarding instructions; `CLAUDE.md` imports the same guidance. Issa defines permitted sections and fields during onboarding. The dashboard has a schema-driven editor; client-scoped operator permissions remain future work. The bundled onboarder currently uses a different JSON configuration format.

## Dashboard phase 2 — 2026-09-24

Preview deployment on 2026-09-24: https://client-iffov0cv5-issabengassem2004-8957s-projects.vercel.app . Vercel reports this deployment as Ready with target Preview. Preview-scoped MongoDB, session, and OpenRouter variables are present. Brave checks confirmed admin login, overview, Dhamna editor, activity, Users, and one OpenRouter suggestion. The suggestion was not applied or saved. Site settings, draft writes, publish, and rollback were not exercised. The local `.env.local` was excluded from the upload. Production was not redeployed or reconfigured. The `client-cms-git-main` branch URL still serves the older dashboard from GitHub, not this local Preview build.

The local CMS dashboard now presents a SaaS-style overview, sidebar, site table, activity list, and per-site content workspace. The editor derives pages, sections, and fields from each registered site's content schema and saves through the protected draft API. Publishing uses the existing publish API and requires an explicit click. The optional OpenRouter panel proposes reviewed field changes; a live proposal passed validation in Preview. The CMS `.env.example` uses safe placeholders, and operator-facing site API responses no longer include the revalidation secret. Production has not been redeployed by this dashboard work.

The local site workspace also has editable site settings, published version history with explicit rollback confirmation, a full audit view, and an admin-only read-only user list. Settings changes record an audit event listing changed field names only. The Users page was opened read-only in the authenticated Preview and showed the existing admin account; account changes were not attempted.

## Dhamna editor check — 2026-09-24

The authenticated Dhamna site detail page edits only `home` -> `hero.eyebrow` because that is its current allowlist. The editor displays current draft and published values and saves through the protected partial-draft API. Unit tests, TypeScript, the CMS production build, the Dhamna production build, and an authenticated editor integration check passed. The approved test value has since been published through the controlled workflow; the dashboard redesign did not republish it.

The publish endpoint now verifies the registered site, approved slug, and complete draft schema before creating publication records. Valid behavior was tested with an in-memory store; authenticated rejection checks against the configured database confirmed that invalid targets create no snapshot or publish audit and leave Dhamna's published content unchanged. No live Dhamna publish has been executed.

## Local check — 2026-09-23

The active dashboard runs at http://localhost:3100. TypeScript passed. Read-only checks passed for the login page (200), signed-out dashboard redirect (307), signed-out sites API protection (401), MongoDB ping, authenticated dashboard rendering (200), and authenticated sites API (200; zero sites). Authenticated checks used a two-minute signed test session for the existing admin; password entry and the VS Code embedded browser were not tested. No accounts or client content were changed. Editing, publishing, and rollback still need a separate workflow test. The imported core also lacks a rich content editor and client-specific access controls, as documented in `dashboard/README.md`.

## Source note

The dashboard was copied from `C:\Bureau\LLMS\CLAUDE\claude_code\cms_core`. Generated dependencies/build output and the source `.env.local` were excluded; install dependencies in this workspace and configure fresh credentials here.

Browser follow-up: Issa signed in successfully in Brave at http://localhost:3100/dashboard. The authenticated page displayed his account, the empty sites list, and the registration form. Two development issues were indicated in the browser; their current details were not verified. No site registration or content changes were made.

## Production status - 2026-09-23

Live CMS: https://client-cms-nine.vercel.app

Published with gh to the public client_cms repository and deployed using vercel --prod. Local and Vercel production builds passed. Live checks passed for the login page, signed-out dashboard redirect, protected sites API, and database-backed invalid API-key rejection. Production settings are stored as Vercel secrets. Content editing/publishing and browser password login on the production domain were not exercised in this deployment check.
