# BONAE TECH Digital Services Website

This is the static website for BONAE TECH Digital Services, built with Astro and Tailwind CSS in [`apps/static`](apps/static/). Deployed on Cloudflare Pages.

## Design Principles

- **Mobile-first**: The majority of Latin American traffic is mobile. Layouts and components are designed for small screens first, then enhanced for desktop.
- **Low-bandwidth friendly**: Optimized for 3G/4G connections. Minimal external assets, inline critical styles, and PWA support for offline use.
- **Accessibility (WCAG 2.1 AA)**: Semantic HTML, ARIA labels, focus states, and sufficient color contrast. Forms and interactive elements are keyboard-navigable.
- **Bilingual by default**: Spanish (primary) and English with clear language switching and proper `hreflang` for SEO.
- **Cercano y profesional**: Tone is approachable and empowering—digitalization is within reach. Avoid unnecessary jargon; explain technical terms when used.
- **Trust signals**: Clear value propositions, founder profiles, contact options, and visible CTAs (WhatsApp, contact form) to reduce friction.

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Static generator | Astro 4.x |
| Styling | Tailwind CSS |
| Hosting | Cloudflare Pages |
| Output | Static HTML (no client-side routing) |
| Backend (optional) | AWS: Cognito + API Gateway + Lambda + DynamoDB — see [infra/README.md](infra/README.md) |

### Page Structure

- **Spanish**: `/` (index)
- **English**: `/en/`
- Single-page layout per language: all sections (Hero, Value Prop, Services, About, Portfolio, Plans, Contact) are rendered on the homepage with anchor navigation.

### i18n

- Translation files: `apps/static/src/i18n/es.ts` (source) and `apps/static/src/i18n/en.ts`
- Shared `Translations` type ensures both languages stay in sync
- Each page imports the relevant translation object and passes it as `t` to Layout and components
- No runtime i18n library; content is compiled at build time

### Component Hierarchy

```
Layout.astro (HTML shell, meta, PWA, WhatsApp float, Cookie banner)
├── Header.astro (nav, language switch, CTA)
├── <main>
│   ├── Hero.astro
│   ├── ValueProp.astro
│   ├── ServicesSummary.astro
│   ├── KeyFigures.astro
│   ├── About.astro
│   ├── Services.astro
│   ├── Portfolio.astro
│   ├── Testimonials.astro
│   ├── Plans.astro
│   ├── BlogPreview.astro
│   └── Contact.astro
└── Footer.astro (4-column: brand, nav, services, contact)
```

### Data Flow

- Default copy lives in `apps/static/src/i18n/es.ts` and `apps/static/src/i18n/en.ts`. At build time, `npm run merge:i18n` deep-merges optional overrides into `apps/static/src/i18n/generated/*.merged.ts` (used by pages).
- Overrides can come from (pick one policy per deployment): **committed** [`apps/static/i18n-overrides.json`](apps/static/i18n-overrides.json) (for example after [Decap CMS](https://decapcms.org/) edits), DynamoDB **published** content when CI runs `npm run fetch:i18n`, or local env / file paths — see comments in [`apps/static/scripts/merge-i18n.ts`](apps/static/scripts/merge-i18n.ts).
- Components receive `t: Translations` as a prop and render text from `t.*`.

### Decap CMS (git-based editor, optional)

- **URL:** after deploy, open `/decap/` on the marketing site (files live under [`apps/static/public/decap/`](apps/static/public/decap/)).
- **Config:** edit [`apps/static/public/decap/config.yml`](apps/static/public/decap/config.yml) — set `backend.repo`, `branch`, and `backend.base_url` to your [OAuth Worker](workers/decap-github-oauth/README.md) origin (GitHub OAuth App callback: `https://<worker>/callback?provider=github`).
- **Saving:** Decap commits changes to `apps/static/i18n-overrides.json` in GitHub; pushes rebuild the site (Cloudflare Pages or your CI). This path does **not** use Cognito or DynamoDB.
- **CI vs AWS:** If production should use **only** git-committed overrides, set the GitHub repository variable `SKIP_FETCH_I18N` to `true` so [`.github/workflows/deploy-site.yml`](.github/workflows/deploy-site.yml) skips DynamoDB fetch and OIDC (see table below). Leave it unset or not `true` to keep fetching published content from DynamoDB (AWS admin workflow).

### AWS backend and admin (optional)

- **Infrastructure**: CDK app in [`infra/`](infra/README.md) — Cognito user pool, `administrators` group, HTTP API (Lambda), DynamoDB for profiles and draft/published content, Secrets Manager for GitHub token + repo.
- **Admin UI (AWS):** React/Vite app in [`apps/admin`](apps/admin/) — sign-in with Cognito, edit hero/contact draft per locale, save draft, **Publicar sitio** copies drafts to published and triggers GitHub `repository_dispatch` (`publish-site`), which runs [`.github/workflows/deploy-site.yml`](.github/workflows/deploy-site.yml) to fetch overrides, build Astro, and deploy to Cloudflare Pages with Wrangler. **Decap** (above) is a separate, git-based editor for the same merge pipeline without AWS.
- **Environment variables**: see [`apps/admin/.env.example`](apps/admin/.env.example) for the admin app; GitHub Actions needs `AWS_DEPLOY_ROLE_ARN`, `CONTENT_TABLE_NAME`, and `CLOUDFLARE_API_TOKEN` (see [`infra/README.md`](infra/README.md)).

### PWA & Performance

- `manifest.webmanifest` and `sw.js` for installability and offline support
- `compressHTML: true` and `inlineStylesheets: 'auto'` in Astro config
- Target: Lighthouse performance > 90, load time < 3s on 3G

---

## Development Setup

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bonae
   ```

2. Install dependencies for the marketing site (and optionally the admin app):
   ```bash
   npm ci --prefix apps/static
   npm ci --prefix apps/admin
   ```
   The repo root has no `node_modules`; convenience scripts (`npm run dev`, `npm run build`, etc.) delegate to `apps/static`.

### Development

To start the development server:

```bash
npm run dev
```

This will start the Astro development server, typically available at `http://localhost:4321`.

The admin app is a **standalone** Vite package under `apps/admin` (own `package.json` and `package-lock.json`). From that directory use `npm ci`, `npm run dev`, and `npm run build`. From the repo root you can run `npm run admin:dev`, `npm run admin:build`, or `npm run admin:preview` as shortcuts. See [`apps/admin/README.md`](apps/admin/README.md) and the Cloudflare table under [Backend and admin quick reference](#backend-and-admin-quick-reference).

### Building for Production

To build the website for production:

```bash
npm run build
```

The built files will be in `apps/static/dist/`.

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

This serves the built website from `apps/static/dist/`.

## Project Structure

- `apps/static/` - Marketing site (Astro): `src/pages/`, `src/components/`, `src/layouts/`, `src/styles/`, `public/` (includes `decap/` for Decap CMS), `scripts/` (`merge:i18n`, `fetch:i18n`), `src/i18n/` (merged output in `src/i18n/generated/`), `i18n-overrides.json` (optional overrides)
- `infra/` - AWS CDK stack (Cognito, API, DynamoDB)
- `apps/admin/` - Vite/React admin UI for drafts and publish (Cognito + API)
- `workers/decap-github-oauth/` - Cloudflare Worker for Decap GitHub OAuth

## Technologies Used

- [Astro](https://astro.build/) - Static site generator
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- TypeScript - Type-safe JavaScript

## License

Apache-2.0

---

## Backend and admin quick reference

| Item | Purpose |
|------|---------|
| `VITE_*` in `apps/admin` | Cognito pool id, client id, Region, API base URL for the admin SPA |
| Secrets Manager (`GitHubSecretArn` from CDK) | JSON `githubToken` + `repository` for `repository_dispatch` after publish |
| GitHub `AWS_DEPLOY_ROLE_ARN` | OIDC role so Actions can read DynamoDB published content |
| GitHub `CONTENT_TABLE_NAME` | DynamoDB table name for `fetch:i18n` in deploy workflow |
| GitHub `CLOUDFLARE_API_TOKEN` | Deploy `apps/static/dist/` to Cloudflare Pages |
| GitHub `SKIP_FETCH_I18N` (repository **variable**, not secret) | Set to `true` to skip DynamoDB `fetch:i18n` and `configure-aws-credentials` in [`deploy-site.yml`](.github/workflows/deploy-site.yml) — use when production overrides come only from git (`i18n-overrides.json`, e.g. Decap). Leave unset for the AWS publish workflow. |

Deploy the **marketing** site from `apps/static` (or rely on GitHub Actions). Deploy the admin app as a **second** Cloudflare Pages project (for example `admin.yourdomain.com`):

| Setting | Value |
|--------|--------|
| Root directory | `apps/admin` |
| Build command | `npm ci && npm run build` (or `npm run build` if dependencies are installed another way) |
| Build output directory | `dist` |
| **Deploy command** | **Leave empty** — Pages uploads `dist` after the build automatically. |

**Wrangler / `wrangler.toml`:** Do **not** add a repo-root or `apps/admin` `wrangler.toml` for these static sites unless you need Pages Functions bindings. Cloudflare’s build runs a Wrangler config step that can pick up the wrong file in a monorepo or fail with “Missing … `name`” on older commits. Configure **build output** (`dist`) and env vars **only in the Pages dashboard** for both projects. The marketing deploy in GitHub Actions runs from `apps/static` and uses [`wrangler pages deploy dist --project-name bonae-tech`](.github/workflows/deploy-site.yml); it does not rely on a committed Wrangler file.

**If builds still fail,** check the log line that shows `HEAD is now at <commit>` — it must match the commit on GitHub that contains your latest changes (push `main` / your production branch and redeploy).

Do **not** set the deploy command to `npx wrangler deploy`: that targets **Workers**, not static sites, and will fail with “Missing entry-point to Worker script”. The marketing site’s GitHub Action uses Wrangler to push to Pages; the admin Pages project does not need a deploy command unless you intentionally use `wrangler pages deploy` from CI (different command).

# Hosting Recommendations

## Best Hosting for Venezuela + International Availability

### 1 Cloudflare Pages (strongly recommended)

Cloudflare is the best choice specifically for Venezuela because their Anycast CDN has 300+ global Points of Presence, and Venezuelan users get routed through nearby nodes in Colombia, Brazil, and the Caribbean. No other free platform matches this Latin American coverage.

Free tier includes: unlimited bandwidth, unlimited sites, 500 builds/month, SSL, DDoS protection.

#### Ranked alternatives

| Service	| LatAm CDN Coverage	| Free Tier |
|-----------|-----------------------|-----------|
| Cloudflare Pages ⭐	| Best (Anycast, 300+ PoP)	| Unlimited BW |
| Vercel	| Good (São Paulo region)	| 100GB BW/mo |
| Netlify	| Good	| 100GB BW/mo |
| AWS S3 + CloudFront	| Good (São Paulo, Buenos Aires)	| 12mo free trial |


### Deploying to Cloudflare Pages (3 steps)

Your Astro site lives under `apps/static`, builds to `apps/static/dist/`, and requires no Astro config changes for hosting:

1. Push to GitHub (if not already there)

2. Connect at cloudflare.com → Workers & Pages → Create → Pages → Connect to Git

3. Build settings:
- **Root directory:** `apps/static`
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist`
- Node version env var: `NODE_VERSION=18` (or 20 to match `engines`)

Every push to main auto-deploys. You get a free *.pages.dev URL immediately, and can add a custom domain later.

## Styles

### Fonts

```
# one
font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
# two
font-family: 'Poppins', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### Pallete 

* terracota: #FF6B35
* brown: #9C8172
* mid-blue: #3996AE
* light-blue: #48A8C1
* dar-blue: #44808F
* pacificblue: #40575D
* cream: #F4F4ED

BDD0D5,3C707D,3C6F7B,DEEAED,518490
#### tailwind
Favorite: 40575D

{
  "dark-slate-grey": {
    "50": "#f0f4f5",
    "100": "#e1e8ea",
    "200": "#c3d2d5",
    "300": "#a5bbc0",
    "400": "#87a4ab",
    "500": "#698d96",
    "600": "#547178",
    "700": "#3f555a",
    "800": "#2a393c",
    "900": "#151c1e",
    "950": "#0f1415"
  }
}



🧩 Recommended Pairings
To keep things simple and modern:

**Option A** — Clean & Friendly
Headlines: Poppins SemiBold
Body: Inter Regular
UI Labels: Inter Medium

**Option B** — Sleek & Professional
- Headlines: Montserrat SemiBold
- Body: Inter Regular
- Buttons: Inter Medium

**Option C** — Ultra‑Lightweight (Lowest Bandwidth)
- Headlines: Segoe UI Bold
- Body: Segoe UI Regular
- No external font downloads needed