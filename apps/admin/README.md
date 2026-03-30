# BONAE admin

Standalone Vite + React SPA for editing site content (Cognito sign-in, AWS HTTP API). It does **not** depend on the monorepo root `package.json` or Astro toolchain.

## Prerequisites

- Node.js 20+

## Setup

```bash
cd apps/admin
npm ci
```

Copy `.env.example` to `.env` and set `VITE_*` values (see also repo `infra/README.md`).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server (default: http://localhost:5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` / `npm start` | Serve `dist/` locally (after `build`) |

## Deploy (Cloudflare Pages)

Use a **Pages** project with:

- **Root directory:** `apps/admin` (or this folder if the repo is admin-only)
- **Build command:** `npm ci && npm run build`
- **Build output:** `dist` (see [`wrangler.toml`](wrangler.toml): `pages_build_output_dir` and **`name`** must match your **Pages project name** in Cloudflare)
- **Deploy command:** leave empty (do not run `vite` or `wrangler deploy` here)

Set `VITE_*` environment variables in the Pages project for production builds.

## Repo layout

When this app lives inside the full BONAE monorepo, treat it as a separate package: run all npm commands from `apps/admin` using this directory’s `package-lock.json`.
