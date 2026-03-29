/**
 * Writes i18n-overrides.json from DynamoDB publishedJson (for CI before merge:i18n).
 * Requires CONTENT_TABLE_NAME and AWS credentials (e.g. OIDC or env vars).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const table = process.env.CONTENT_TABLE_NAME;
if (!table) {
  console.error('CONTENT_TABLE_NAME is required');
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function main() {
  const [es, en] = await Promise.all([
    client.send(new GetCommand({ TableName: table, Key: { locale: 'es' } })),
    client.send(new GetCommand({ TableName: table, Key: { locale: 'en' } })),
  ]);
  const out = {
    es: es.Item?.publishedJson ? JSON.parse(String(es.Item.publishedJson)) : {},
    en: en.Item?.publishedJson ? JSON.parse(String(en.Item.publishedJson)) : {},
  };
  const path = join(process.cwd(), 'i18n-overrides.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
