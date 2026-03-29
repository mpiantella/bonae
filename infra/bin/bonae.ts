#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BonaeStack } from '../lib/bonae-stack';

const app = new cdk.App();

new BonaeStack(app, 'BonaeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'BONAE TECH — Cognito, API, DynamoDB for admin and profiles',
});
