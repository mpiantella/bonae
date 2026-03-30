# BONAE AWS infrastructure (CDK)

Deploys a serverless API on API Gateway HTTP API + Lambda, Amazon Cognito (user pool + `administrators` group), DynamoDB tables for extended profiles and site content overrides, and a Secrets Manager secret for GitHub `repository_dispatch`.

## Prerequisites

- AWS account and [CDK bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) in the target Region
- Node.js 20+
- Dependencies declared in [`package.json`](package.json) at the root of this folder (not the website `package.json` at the repo root)

## CDK bootstrap (fixes “SSM parameter …/cdk-bootstrap/hnb659fds/version not found”)

CDK must be **[bootstrapped](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) once per AWS account and Region**. Until then, deploy fails looking for the SSM parameter above.

[`bin/bonae.ts`](bin/bonae.ts) defaults the stack Region to **`sa-east-1`** when `CDK_DEFAULT_REGION` is unset. Bootstrap **that** Region in the account you deploy to (or bootstrap whatever Region you set with `CDK_DEFAULT_REGION`).

With the same credentials / profile you use for deploy:

```bash
cd infra
npm install
```

**Easiest (uses `CDK_DEFAULT_REGION` or defaults to `sa-east-1`, account from `aws sts get-caller-identity`):**

```bash
npm run bootstrap
```

If you keep variables in **`infra/.env`** (see [`.env.example`](.env.example)), load them automatically:

```bash
npm run bootstrap:env
```

**Manual equivalent:**

```bash
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/sa-east-1
```

If your Region is not `sa-east-1`, set `CDK_DEFAULT_REGION` (and use the same value here and in `cdk deploy`). Explicit account + Region:

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=sa-east-1
npx cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
```

Then deploy:

```bash
npm run deploy
# or: npm run deploy:env   # if using infra/.env
```

**Credentials:** If you use **IAM Identity Center (SSO)**, run `aws sso login --profile <name>` before CDK; use `export AWS_PROFILE=<name>`. Warnings about assuming roles are normal for SSO/chained profiles as long as `aws sts get-caller-identity` succeeds.

## Install and deploy

From the repository root:

```bash
cd infra
npm install
npm run bootstrap    # first time only per account + Region (see above)
npm run deploy       # or: npm run deploy:env if you use infra/.env
```

`npm install` reads **`infra/package.json`** only. The Astro site at the repo root is a separate package.

The CDK app lives in this folder: [`cdk.json`](cdk.json) (entry: `bin/bonae.ts`), [`lib/bonae-stack.ts`](lib/bonae-stack.ts), and [`lambda/api/handler.ts`](lambda/api/handler.ts).

Note the stack outputs: `UserPoolId`, `UserPoolClientId`, `ApiUrl`, `ContentTableName`, `GitHubSecretArn`.

## Create users

Self-sign-up is disabled. Create users in the Cognito console (or CLI), then assign administrators:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password 'TempPassw0rd!Change' \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --group-name administrators
```

Users must set a new password on first sign-in (or use a permanent password via `admin-set-user-password`).

## GitHub publish integration

1. Create a **classic** PAT with the `repo` scope (or a fine-grained token with **Contents: Read and write** on the repo) so `repository_dispatch` can trigger Actions.
2. Update the Secrets Manager secret at `GitHubSecretArn` with JSON:

   ```json
   { "githubToken": "ghp_...", "repository": "owner/repo-name" }
   ```

3. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - `AWS_DEPLOY_ROLE_ARN` — IAM role for OIDC (see below)
   - `CONTENT_TABLE_NAME` — same as stack output `ContentTableName`
   - `CLOUDFLARE_API_TOKEN` — Pages deploy token with `Account:Cloudflare Pages:Edit`

4. Optional: `AWS_REGION` (repository variable) if not `sa-east-1`.

5. **Git-only overrides (Decap CMS):** If production copy comes only from committed `apps/static/i18n-overrides.json` and you do **not** want CI to pull DynamoDB, set repository variable `SKIP_FETCH_I18N` to `true` (see repo root `README.md`). Otherwise leave it unset so `deploy-site` runs `fetch:i18n` after publish from the AWS admin.

### IAM role for GitHub Actions (OIDC)

Create an IAM role trusted by `token.actions.githubusercontent.com` with `sub` like `repo:OWNER/REPO:ref:refs/heads/main` and attach a policy allowing `dynamodb:GetItem` (and `BatchGetItem` if you prefer) on the **SiteContent** table ARN.

## Admin SPA

The Vite app in `apps/admin` is a **standalone** npm package (see [`apps/admin/README.md`](../apps/admin/README.md)). It needs `VITE_*` variables (see `apps/admin/.env.example`). Create a **separate** Cloudflare Pages project (e.g. `admin` subdomain): root **`apps/admin`**, build **`npm ci && npm run build`**, output **`dist`**, set `VITE_*` in the project environment. **Leave the optional “Deploy command” blank** — `npx wrangler deploy` is for Workers only and will fail; Pages publishes `dist` after the build.

## CORS

The HTTP API allows `*` origins for API calls. For production you can tighten CORS in `lib/bonae-stack.ts` to your admin origin only.

## Full teardown and rollback (remove all backend resources)

Use this when you want to **fully remove** the AWS backend and stop automated publishes, or **roll back** to a static-site-only setup (marketing site in git + Cloudflare only).

### 1. Optional safeguards before AWS teardown

- **Revoke or rotate** the GitHub PAT stored in Secrets Manager (and remove it from the secret) so it cannot trigger workflows if something is mis-deleted out of order.
- **Export data** if you need a copy of DynamoDB content (e.g. `aws dynamodb scan` on the content table, or on-demand backup in the console).

### 2. Destroy the CDK stack

From this directory, with credentials for the same account/Region used at deploy time:

```bash
cd infra
npx cdk destroy BonaeStack
```

Confirm the prompt. This removes the **CloudFormation stack** and deletes resources that are **not** set to retain (for example API Gateway, Lambda, integrations, and most IAM roles attached to the stack).

### 3. Delete resources retained by CloudFormation

[`lib/bonae-stack.ts`](lib/bonae-stack.ts) sets **`RemovalPolicy.RETAIN`** on the **Cognito User Pool** and both **DynamoDB** tables so a stack delete does not wipe user or content data by accident. After `cdk destroy`, those resources **remain** in your account until you delete them manually.

In the **AWS Console** (same Region, e.g. `sa-east-1`):

| Resource | Where to delete |
|----------|-----------------|
| Cognito User Pool | Cognito → User pools → select pool → Delete |
| DynamoDB `ProfilesTable` / `SiteContentTable` | DynamoDB → Tables → delete each (or use CLI `aws dynamodb delete-table`) |

Also check **Secrets Manager** for the GitHub dispatch secret created by the stack (name from `GitHubSecretArn` output). If it still exists after destroy, **delete the secret** in the console (and schedule deletion if your org uses recovery windows).

### 4. GitHub repository

Not removed by CDK; clean up by hand if you no longer need automation:

- **Settings → Secrets and variables → Actions**: remove `AWS_DEPLOY_ROLE_ARN`, `CONTENT_TABLE_NAME`, `CLOUDFLARE_API_TOKEN`, and any others you added for this flow.
- **IAM (AWS account used for OIDC)**: delete the **OIDC federation role** and trust policy you created for GitHub Actions if it is only used for this deploy workflow.
- Optionally **delete or disable** [`.github/workflows/deploy-site.yml`](.github/workflows/deploy-site.yml) in a follow-up commit so `repository_dispatch` no longer runs (the workflow file alone does not incur AWS cost).

### 5. Cloudflare

CDK does not manage Cloudflare. If you deployed with Wrangler or the dashboard:

- **Marketing site** (`bonae-tech` or your project name): remove or pause the project if you want that site gone.
- **Admin app** (separate Pages project): delete that project if you no longer host the admin UI.

Revoke or rotate the **Cloudflare API token** used for deploys if you remove automation.

### 6. Local and team cleanup

- Remove or blank **`apps/admin/.env.local`** (and any copies of pool IDs, API URLs, or tokens).
- Update runbooks or DNS if `admin.` or API URLs pointed at removed endpoints.

### Summary

| Layer | Action |
|-------|--------|
| AWS app stack | `npx cdk destroy BonaeStack` |
| AWS retained data | Manually delete Cognito pool, DynamoDB tables, Secrets Manager secret |
| GitHub | Remove Actions secrets; optional IAM OIDC role cleanup |
| Cloudflare | Manage Pages projects and API tokens separately |
