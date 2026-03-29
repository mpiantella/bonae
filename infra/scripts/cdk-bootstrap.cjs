#!/usr/bin/env node
const { execSync } = require('child_process');

const region = process.env.CDK_DEFAULT_REGION?.trim() || 'sa-east-1';
let account = process.env.CDK_DEFAULT_ACCOUNT?.trim();

if (!account || !/^\d{12}$/.test(account)) {
  try {
    account = execSync('aws sts get-caller-identity --query Account --output text', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }).trim();
  } catch {
    console.error(
      'Could not resolve AWS account. Set CDK_DEFAULT_ACCOUNT or run with working AWS credentials (e.g. aws sts get-caller-identity).',
    );
    process.exit(1);
  }
}

if (!/^\d{12}$/.test(account)) {
  console.error('Invalid account ID:', account);
  process.exit(1);
}

const envUri = `aws://${account}/${region}`;
console.error(`Bootstrapping ${envUri} ...`);
execSync(`npx cdk bootstrap "${envUri}"`, { stdio: 'inherit', env: process.env });
