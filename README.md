# Client Website CMS

Reusable CMS dashboard for managing content across separately deployed client websites.

## Structure

- `dashboard/` is the central Next.js application. It is the only component that connects to MongoDB.
- `templates/cms.config.js` is an inert example, not a global config. Each onboarded website gets its own active `cms.config.js` beside its `package.json`. The config loader and server-side field enforcement still need implementation.
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

The example `dhamna` in the original request is a future integration example; the DHAMNA project has not been connected as part of adding the dashboard.

Read `AGENTS.md` for implementation facts, permission requirements, and future onboarding instructions; `CLAUDE.md` imports the same guidance. Issa will define permitted sections and fields in the next task. The next implementation step should reconcile the config/SDK contract and add server-side field validation and client isolation before enabling client editing. The bundled onboarder currently uses a different JSON configuration format.

## Local check — 2026-09-23

The active dashboard runs at http://localhost:3100. TypeScript passed. Read-only checks passed for the login page (200), signed-out dashboard redirect (307), signed-out sites API protection (401), MongoDB ping, authenticated dashboard rendering (200), and authenticated sites API (200; zero sites). Authenticated checks used a two-minute signed test session for the existing admin; password entry and the VS Code embedded browser were not tested. No accounts or client content were changed. Editing, publishing, and rollback still need a separate workflow test. The imported core also lacks a rich content editor and client-specific access controls, as documented in `dashboard/README.md`.

## Source note

The dashboard was copied from `C:\Bureau\LLMS\CLAUDE\claude_code\cms_core`. Generated dependencies/build output and the source `.env.local` were excluded; install dependencies in this workspace and configure fresh credentials here.

Browser follow-up: Issa signed in successfully in Brave at http://localhost:3100/dashboard. The authenticated page displayed his account, the empty sites list, and the registration form. Two development issues were indicated in the browser; their current details were not verified. No site registration or content changes were made.
