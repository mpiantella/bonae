# Decap CMS — GitHub OAuth proxy (Cloudflare Worker)

Small Worker that completes the GitHub OAuth flow for [Decap CMS](https://decapcms.org/docs/authentication-backends/) when using the `github` backend (no Netlify).

## Deploy

```bash
cd workers/decap-github-oauth
npm ci
npx wrangler deploy
```

## Secrets

```bash
npx wrangler secret put GITHUB_OAUTH_ID
npx wrangler secret put GITHUB_OAUTH_SECRET
```

Use the **Client ID** and **Client secret** from a [GitHub OAuth App](https://github.com/settings/developers).

**Authorization callback URL** (must match this Worker):

`https://<your-worker-host>/callback?provider=github`

For a `*.workers.dev` host, that is `https://decap-github-oauth.<your-subdomain>.workers.dev/callback?provider=github` (see `wrangler.toml` `name`).

**Homepage URL:** your marketing site or `https://bonaetech.com` (GitHub requires a URL).

## Private repository

If the CMS commits to a **private** repo, set:

```bash
npx wrangler secret put GITHUB_REPO_PRIVATE
# value: 1
```

## Wire Decap

In [`apps/static/public/decap/config.yml`](../../apps/static/public/decap/config.yml), set `backend.base_url` to this Worker’s origin (no trailing slash), and `backend.repo` / `branch` to your GitHub repository.

## Local development

```bash
npx wrangler dev
```

Use the dev URL as `base_url` in a local `config.yml` copy, or use Decap’s [local backend](https://decapcms.org/docs/working-with-a-local-git-repository/) for offline editing.
