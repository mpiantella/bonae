# BONAE AWS infrastructure (CDK)

Deploys a serverless API on API Gateway HTTP API + Lambda, Amazon Cognito (user pool + `administrators` group), DynamoDB tables for extended profiles and site content overrides, and a Secrets Manager secret for GitHub `repository_dispatch`.

## Prerequisites

- AWS account and [CDK bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) in the target Region
- Node.js 20+

## Install and deploy

```bash
cd infra
npm install
npx cdk deploy
```

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

4. Optional: `AWS_REGION` (repository variable) if not `us-east-1`.

### IAM role for GitHub Actions (OIDC)

Create an IAM role trusted by `token.actions.githubusercontent.com` with `sub` like `repo:OWNER/REPO:ref:refs/heads/main` and attach a policy allowing `dynamodb:GetItem` (and `BatchGetItem` if you prefer) on the **SiteContent** table ARN.

## Admin SPA

The Vite app in `apps/admin` needs `VITE_*` variables (see `apps/admin/.env.example`). Build with `npm run build` and deploy the `dist/` folder to Cloudflare Pages (separate project, e.g. `admin` subdomain).

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

In the **AWS Console** (same Region, e.g. `us-east-1`):

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
