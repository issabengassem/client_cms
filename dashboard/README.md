# Command Center -- CMS core

The central dashboard. One deployment of this manages content for every
client site connected to it. This is the "core" pass: data model, auth,
the publish/rollback safety layer, and a read-oriented dashboard. The
field-by-field WYSIWYG editor, the AI chat assist, and the SEO panel are
the next build phase (see "Not yet built" below) -- this gets the
foundation everything else sits on working end to end first.

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
3. **Install and create your operator account**:
   ```
   npm install
   npm run create-admin
   ```
4. **Run it**:
   ```
   npm run dev
   ```
   Visit `http://localhost:3000`, sign in, you should see an empty sites
   list and a "register a site" form.

## Deploying

Push this to its own GitHub repo and import it into Vercel as its own
project (separate from any client site). Add the three env vars above in
Vercel's project settings. That deployed URL is the `CMS_BASE_URL` the
onboarding Skill and every client site's SDK will point at.

## Data model

Five collections, all in the database named by `MONGODB_DB`:

| Collection | Purpose |
|---|---|
| `sites` | One doc per client site: name, domain, hashed API key, revalidate webhook config |
| `content` | Per-page draft + published field maps, keyed by `siteId` + `slug` |
| `snapshots` | Immutable copy of a page's content every time it's published -- this is what rollback reads from |
| `users` | Operator accounts (you and anyone else who logs into this dashboard) |
| `audit_log` | Who did what (publish, rollback, site created), for accountability across multiple client sites |

## API surface

**Operator-facing** (session cookie required, set by `/login`):
- `GET/POST /api/sites`, `GET/PATCH/DELETE /api/sites/[siteId]`
- `GET/PUT /api/content/[siteId]/[slug]` -- read/write a page's **draft**
- `GET /api/snapshots/[siteId]/[slug]` -- version history
- `POST /api/publish` `{ siteId, slug, label? }`
- `POST /api/rollback` `{ siteId, slug, snapshotId }`

**Site-facing** (site's own API key as `Authorization: Bearer <key>`):
- `GET /api/public/content/[siteId]/[slug]` -- **published** content only, ever

**Automation-facing** (`ADMIN_API_TOKEN` as `Authorization: Bearer <token>`):
- `POST /api/sites` -- same route operators use, also accepts the admin
  token so the onboarding Skill can register sites unattended

## Not yet built

Left for the next phase, deliberately, so this core stayed reviewable:
- Field-by-field WYSIWYG editor and the AI chat assist in the dashboard
  (the API underneath -- draft read/write, publish, rollback -- is done;
  it just doesn't have a rich editing UI yet, only the raw page list)
- SEO panel and scoring
- Per-site password gate for a client's own (not-yet-public) site
- API key / revalidate secret rotation without re-registering the site
- Role-based permissions beyond admin/editor (e.g. a client-only editor
  scoped to just their own site)

## A note on this being a sandbox build

This was scaffolded and typechecked/built in a sandboxed environment
without a real MongoDB Atlas cluster to connect to, so DB-dependent
routes are verified for correctness by inspection and by a clean
`next build`, not by an end-to-end request against live data. Plug in a
real `MONGODB_URI` and run through the setup steps above before trusting
it further.
