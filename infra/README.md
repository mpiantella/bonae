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
