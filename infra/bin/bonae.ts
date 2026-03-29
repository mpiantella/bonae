#!/usr/bin/env node
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { BonaeStack } from '../lib/bonae-stack';

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Region for the stack: env wins, else sa-east-1 (not the default profile region). */
function resolveRegion(): string {
  return trimEnv('CDK_DEFAULT_REGION') ?? 'sa-east-1';
}

/**
 * CDK needs an explicit account when `env` is set; otherwise it infers account+region
 * from the credential chain and often ends up on the profile default (e.g. us-east-1).
 */
function resolveAccount(): string {
  let account = trimEnv('CDK_DEFAULT_ACCOUNT');
  if (account && /^\d{12}$/.test(account)) {
    return account;
  }
  try {
    account = execSync('aws sts get-caller-identity --query Account --output text', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    console.error(
      'Could not resolve AWS account. Set CDK_DEFAULT_ACCOUNT or run with credentials where `aws sts get-caller-identity` works.',
    );
    process.exit(1);
  }
  if (!/^\d{12}$/.test(account)) {
    console.error('Invalid account ID from STS:', account);
    process.exit(1);
  }
  return account;
}

const account = resolveAccount();
const region = resolveRegion();

const app = new cdk.App();

new BonaeStack(app, 'BonaeStack', {
  env: { account, region },
  description: 'BONAE TECH — Cognito, API, DynamoDB for admin and profiles',
});
