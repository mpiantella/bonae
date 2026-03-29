import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify(body),
  };
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.USER_POOL_ID!,
      tokenUse: 'id',
      clientId: process.env.USER_POOL_CLIENT_ID!,
    });
  }
  return verifier;
}

function parseBearer(event: APIGatewayProxyEventV2): string | null {
  const h =
    event.headers?.authorization ?? event.headers?.Authorization ?? event.headers?.AUTHORIZATION;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

async function verifyId(token: string) {
  return getVerifier().verify(token);
}

function isAdmin(payload: { 'cognito:groups'?: string | string[] }) {
  const g = payload['cognito:groups'];
  const admin = process.env.ADMIN_GROUP ?? 'administrators';
  if (Array.isArray(g)) return g.includes(admin);
  if (typeof g === 'string') return g.split(',').map((s) => s.trim()).includes(admin);
  return false;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors };
  }

  const rawPath = event.rawPath ?? '/';
  const path = rawPath.replace(/\/$/, '') || '/';

  const token = parseBearer(event);
  if (!token) {
    return json(401, { message: 'Missing or invalid Authorization header' });
  }

  let payload: Awaited<ReturnType<typeof verifyId>>;
  try {
    payload = await verifyId(token);
  } catch {
    return json(401, { message: 'Invalid token' });
  }

  const sub = payload.sub;
  if (!sub) {
    return json(401, { message: 'Token missing sub' });
  }

  const profilesTable = process.env.PROFILES_TABLE!;
  const contentTable = process.env.CONTENT_TABLE!;

  try {
    if (path === '/profile' && method === 'GET') {
      const r = await ddb.send(
        new GetCommand({ TableName: profilesTable, Key: { userId: sub } }),
      );
      return json(200, { profile: r.Item?.data ?? {} });
    }

    if (path === '/profile' && method === 'PUT') {
      let body: Record<string, unknown> = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body) as Record<string, unknown>;
        } catch {
          return json(400, { message: 'Invalid JSON body' });
        }
      }
      await ddb.send(
        new PutCommand({
          TableName: profilesTable,
          Item: { userId: sub, data: body, updatedAt: new Date().toISOString() },
        }),
      );
      return json(200, { ok: true });
    }

    if (!isAdmin(payload)) {
      return json(403, { message: 'Administrator role required' });
    }

    if (path === '/content' && method === 'GET') {
      const locale = event.queryStringParameters?.locale;
      const scope = event.queryStringParameters?.scope ?? 'draft';
      if (!locale) {
        return json(400, { message: 'locale query parameter required' });
      }
      const r = await ddb.send(
        new GetCommand({ TableName: contentTable, Key: { locale } }),
      );
      const item = r.Item as { draft?: string; published?: string } | undefined;
      if (scope === 'published') {
        const published = item?.published;
        return json(200, {
          locale,
          data: published ? JSON.parse(published) : {},
        });
      }
      const draft = item?.draft;
      return json(200, {
        locale,
        data: draft ? JSON.parse(draft) : {},
      });
    }

    if (path === '/content' && method === 'PUT') {
      const locale = event.queryStringParameters?.locale;
      if (!locale) {
        return json(400, { message: 'locale query parameter required' });
      }
      let body: Record<string, unknown> = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body) as Record<string, unknown>;
        } catch {
          return json(400, { message: 'Invalid JSON body' });
        }
      }
      const existing = await ddb.send(
        new GetCommand({ TableName: contentTable, Key: { locale } }),
      );
      const prev = existing.Item as { published?: string } | undefined;
      await ddb.send(
        new PutCommand({
          TableName: contentTable,
          Item: {
            locale,
            draft: JSON.stringify(body),
            published: prev?.published ?? '{}',
            updatedAt: new Date().toISOString(),
          },
        }),
      );
      return json(200, { ok: true });
    }

    if (path === '/publish' && method === 'POST') {
      const scan = await ddb.send(new ScanCommand({ TableName: contentTable }));
      const items = scan.Items ?? [];
      for (const row of items) {
        const loc = row.locale as string;
        const draft = row.draft as string | undefined;
        if (!draft) continue;
        await ddb.send(
          new PutCommand({
            TableName: contentTable,
            Item: {
              ...row,
              locale: loc,
              published: draft,
              updatedAt: new Date().toISOString(),
            },
          }),
        );
      }

      const arn = process.env.GITHUB_SECRET_ARN!;
      const sec = await secrets.send(
        new GetSecretValueCommand({ SecretId: arn }),
      );
      const raw = sec.SecretString;
      if (!raw) {
        return json(500, { message: 'GitHub secret empty' });
      }
      const { githubToken, repository } = JSON.parse(raw) as {
        githubToken: string;
        repository: string;
      };
      if (!githubToken?.trim() || !repository?.includes('/')) {
        return json(500, { message: 'Configure githubToken and repository in Secrets Manager' });
      }
      const [owner, repo] = repository.split('/').map((s: string) => s.trim());
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'publish-site',
          client_payload: {},
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return json(502, { message: 'GitHub dispatch failed', detail: text.slice(0, 500) });
      }
      return json(200, { ok: true, publishedLocales: items.length });
    }

    return json(404, { message: 'Not found', path: rawPath, method });
  } catch (e) {
    const err = e as Error;
    console.error(err);
    return json(500, { message: err.message ?? 'Server error' });
  }
}
