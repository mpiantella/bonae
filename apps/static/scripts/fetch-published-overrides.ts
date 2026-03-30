/**
 * Writes i18n-overrides.json from DynamoDB published content (for CI before merge:i18n).
 * Requires CONTENT_TABLE_NAME and AWS credentials (e.g. OIDC or env vars).
 * Normalizes the AWS admin shape `{ draft: Partial<Translations> }` to top-level overrides for merge-deep.
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

function publishedToOverrides(publishedRaw: string | undefined): Record<string, unknown> {
  if (!publishedRaw?.trim()) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(publishedRaw);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  // Lambda stores the AWS admin PUT body, which wraps content in `draft`.
  if ('draft' in o && o.draft && typeof o.draft === 'object' && !Array.isArray(o.draft)) {
    return o.draft as Record<string, unknown>;
  }
  return o;
}

async function main() {
  const [es, en] = await Promise.all([
    client.send(new GetCommand({ TableName: table, Key: { locale: 'es' } })),
    client.send(new GetCommand({ TableName: table, Key: { locale: 'en' } })),
  ]);
  const esItem = es.Item as { published?: string } | undefined;
  const enItem = en.Item as { published?: string } | undefined;
  const out = {
    es: publishedToOverrides(esItem?.published),
    en: publishedToOverrides(enItem?.published),
  };
  const path = join(process.cwd(), 'i18n-overrides.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
