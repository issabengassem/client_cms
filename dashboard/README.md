# Command Center -- CMS core

## Latest Preview check — 2026-09-24

Preview: https://client-77pvfy9ix-issabengassem2004-8957s-projects.vercel.app . The deployment is Ready. The Dhamna editor now lists approved areas in plain language, places the AI request beside the field editor, compares current saved text with suggested text, and makes applying a suggestion a separate unsaved step. A local authenticated browser check generated a Dhamna suggestion and verified that applying it enabled Save draft while Publish remained disabled; the original text was restored without saving. An unsupported layout request was rejected, and the final build returns a clearer out-of-scope message. The new Preview's authenticated editor still needs a fresh sign-in check. The dashboard does not provide click-to-edit website preview or multi-turn chat.

The central dashboard. One deployment manages content for every connected
client site. It includes the data model, auth, draft and publish workflow,
rollback, activity, site settings, and a schema-driven editor. A reviewed
OpenRouter suggestion panel is available when server credentials are set.
The SEO panel and multi-turn AI chat remain future work.

## How it fits together

- **This app** is the only thing that talks to MongoDB directly.
- **Client sites** never see a database connection string. They hold a
  scoped API key and call this app's public API to fetch published
  content, nothing else.
- **The onboarding Skill** (separate deliverable, `cms-onboarder/`) is what
  wires a new client site up to this app -- it calls `POST /api/sites` to
  register the site, then scaffolds the SDK and config into the client's
  repo. This app just needs to be reachable at a URL for that to work.

## Setup

1. **MongoDB Atlas**: create a free cluster if you don't have one, and get
   its connection string (Atlas dashboard -> Connect -> Drivers).
2. **Copy the env file**:
   ```
   cp .env.example .env.local
   ```
   Fill in:
   - `MONGODB_URI` -- your Atlas connection string
   - `SESSION_SECRET` -- random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_API_TOKEN` -- same command, different value. This is what the
     onboarding Skill's register-site script authenticates with.
   Optionally set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to enable AI
   suggestions. Keep the key in the ignored local env file or your hosting
   provider's server-side environment settings.
3. **Install and create your operator account**:
   ```
   npm install
   npm run create-admin
   ```
4. **Run it**:
   ```
   npm run dev
   ```
   Visit `http://localhost:3000` and sign in. The overview lists any sites
   already registered and includes a "register a site" form.

## Deploying

Deploy this as its own project, separate from any client site. Set the
required env vars above in the project's settings and, if needed, the
OpenRouter variables. That deployed URL is the `CMS_BASE_URL` the onboarding
Skill and every client site's SDK will point at.

## Data model

Five collections, all in the database named by `MONGODB_DB`:

| Collection | Purpose |
|---|---|
| `sites` | One doc per client site: name, domain, hashed API key, revalidate webhook config, and server-enforced content schema |
| `content` | Per-page draft + published field maps, keyed by `siteId` + `slug` |
| `snapshots` | Immutable copy of a page's content every time it's published -- this is what rollback reads from |
| `users` | Operator accounts (you and anyone else who logs into this dashboard) |
| `audit_log` | Who did what (publish, rollback, site created), for accountability across multiple client sites |

## API surface

**Operator-facing** (session cookie required, set by `/login`):
- `GET/POST /api/sites`, `GET/PATCH/DELETE /api/sites/[siteId]`
- `GET/PUT /api/content/[siteId]/[slug]` -- read/write a page's **draft**; PUT accepts a partial field map and validates it against the site's content schema
- `GET /api/snapshots/[siteId]/[slug]` -- version history
- `POST /api/publish` `{ siteId, slug, label? }` -- validates the registered site, approved slug, and complete draft before writing
- `POST /api/rollback` `{ siteId, slug, snapshotId }`

**Site-facing** (site's own API key as `Authorization: Bearer <key>`):
- `GET /api/public/content/[siteId]/[slug]` -- **published** content only, ever

**Automation-facing** (`ADMIN_API_TOKEN` as `Authorization: Bearer <token>`):
- `POST /api/sites` -- same route operators use, also accepts the admin
  token so the onboarding Skill can register sites unattended

## Not yet built

Left for later phases:
- A multi-turn AI chat. The current OpenRouter panel generates one reviewed suggestion set at a time when server credentials are configured.
- SEO panel and scoring
- Per-site password gate for a client's own (not-yet-public) site
- API key / revalidate secret rotation without re-registering the site
- Role-based permissions beyond admin/editor (e.g. a client-only editor
  scoped to just their own site)

## Dashboard UI — 2026-09-24

The authenticated workspace now has a persistent sidebar, site and content summary cards, a sites table, recent activity, and a site-specific content workspace. The editor is generated from each site's server-enforced `contentSchema`: approved page slugs and dotted field paths become page, section, and field controls. It shows draft and published values separately and uses the existing authenticated draft and publish APIs. No content is changed by viewing the dashboard.

The UI supports existing text, richtext, image, and metadata fields as string inputs. It does not upload images or provide a visual site preview. Publishing remains a separate explicit action; the backend's current validation and snapshot behavior remain in force.

Optional OpenRouter suggestions use `OPENROUTER_API_KEY` (server-only Secret) and `OPENROUTER_MODEL` (server-side Config). Issa selected `z-ai/glm-5.3-flash`; its nonsecret slug is set in the ignored local env file. When both variables are set, an operator can describe a change in the editor. The CMS sends only that page's approved field values, schema limits, and the operator's instruction to OpenRouter. The response must pass the site's draft validation before it is shown. The operator can apply individual suggestions to the unsaved form, then review and save through the existing draft API; AI never writes or publishes by itself. Without both variables, the panel says it is not connected. One real provider call returned a validated, unapplied proposal in Preview on 2026-09-24.

The site APIs omit both the stored API key hash and revalidation secret from operator-facing responses. `.env.example` contains only placeholders. Keep local `.env.local` private. Per-site operator isolation is still not implemented, so admin/editor sessions can currently access all registered sites.

The site workspace now also exposes the existing site-settings PATCH API and published snapshot history. Restoring a version requires an explicit confirmation and calls the existing rollback API; the current draft remains separate. A full Activity page lists audit events with site/action filters and pagination, showing field paths but never field values. Admin operators have a read-only Users page that projects email, role, and creation date; it does not expose password hashes or offer account management.

## Verification scope

Local authenticated reads against the configured MongoDB confirmed the dashboard and Dhamna editor render. The original draft and publish unit tests pass. Preview checks confirmed admin login, overview, Dhamna editor, activity, Users, and one OpenRouter proposal. Account administration, live draft writes, publish, rollback, and production deployment of this UI are not verified yet. Test those flows separately before a Production deployment.
