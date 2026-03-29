import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});

const PROFILES_TABLE = process.env.PROFILES_TABLE!;
const CONTENT_TABLE = process.env.CONTENT_TABLE!;
const ADMIN_GROUP = process.env.ADMIN_GROUP ?? 'administrators';
const GITHUB_SECRET_ARN = process.env.GITHUB_SECRET_ARN!;

const headers = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseGroups(claims: Record<string, string | undefined> | undefined): string[] {
  if (!claims) return [];
  const raw = claims['cognito:groups'];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    /* ignore */
  }
  return raw.split(',').map((s) => s.trim());
}

function isAdmin(claims: Record<string, string | undefined> | undefined): boolean {
  return parseGroups(claims).includes(ADMIN_GROUP);
}

function getClaims(event: APIGatewayProxyEventV2): Record<string, string | undefined> | undefined {
  const jwt = event.requestContext.authorizer?.jwt;
  if (!jwt?.claims) return undefined;
  return jwt.claims as Record<string, string | undefined>;
}

async function getGithubConfig(): Promise<{ githubToken: string; repository: string }> {
  const out = await secrets.send(
    new GetSecretValueCommand({ SecretId: GITHUB_SECRET_ARN }),
  );
  const str = out.SecretString ?? '{}';
  const o = JSON.parse(str) as { githubToken?: string; repository?: string };
  return {
    githubToken: o.githubToken ?? '',
    repository: o.repository ?? '',
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    if (method === 'GET' && path === '/health') {
      return json(200, { ok: true, service: 'bonae-api' });
    }

    const claims = getClaims(event);
    const sub = claims?.sub;

    if ((path === '/me/profile' || path.startsWith('/me/profile')) && method === 'GET') {
      if (!sub) return json(401, { error: 'Unauthorized' });
      const res = await ddb.send(
        new GetCommand({ TableName: PROFILES_TABLE, Key: { userId: sub } }),
      );
      return json(200, { profile: res.Item ?? { userId: sub } });
    }

    if ((path === '/me/profile' || path.startsWith('/me/profile')) && method === 'PUT') {
      if (!sub) return json(401, { error: 'Unauthorized' });
      const body = event.body ? JSON.parse(event.body) : {};
      const { phone, locale, company } = body as {
        phone?: string;
        locale?: string;
        company?: string;
      };
      const item = {
        userId: sub,
        phone: phone ?? '',
        locale: locale ?? '',
        company: company ?? '',
        updatedAt: new Date().toISOString(),
      };
      await ddb.send(new PutCommand({ TableName: PROFILES_TABLE, Item: item }));
      return json(200, { profile: item });
    }

    const localeParam = event.pathParameters?.locale;
    if (path.startsWith('/admin/content/') && localeParam) {
      if (!isAdmin(claims)) {
        return json(403, { error: 'Forbidden', detail: 'administrators group required' });
      }
      const locale = localeParam.toLowerCase();
      if (locale !== 'es' && locale !== 'en') {
        return json(400, { error: 'Invalid locale' });
      }

      if (method === 'GET') {
        const res = await ddb.send(
          new GetCommand({ TableName: CONTENT_TABLE, Key: { locale } }),
        );
        const draft = res.Item?.draftJson ? JSON.parse(String(res.Item.draftJson)) : {};
        const published = res.Item?.publishedJson
          ? JSON.parse(String(res.Item.publishedJson))
          : {};
        return json(200, {
          locale,
          draft,
          published,
          updatedAt: res.Item?.updatedAt ?? null,
        });
      }

      if (method === 'PUT') {
        const body = event.body ? JSON.parse(event.body) : {};
        const draft = (body as { draft?: unknown }).draft;
        if (draft === undefined || typeof draft !== 'object' || draft === null) {
          return json(400, { error: 'Body must include draft object' });
        }
        const now = new Date().toISOString();
        await ddb.send(
          new UpdateCommand({
            TableName: CONTENT_TABLE,
            Key: { locale },
            UpdateExpression: 'SET draftJson = :d, updatedAt = :u',
            ExpressionAttributeValues: {
              ':d': JSON.stringify(draft),
              ':u': now,
            },
          }),
        );
        return json(200, { ok: true, locale, updatedAt: now });
      }
    }

    if (path === '/admin/publish' && method === 'POST') {
      if (!isAdmin(claims)) {
        return json(403, { error: 'Forbidden', detail: 'administrators group required' });
      }

      for (const loc of ['es', 'en'] as const) {
        const res = await ddb.send(
          new GetCommand({ TableName: CONTENT_TABLE, Key: { locale: loc } }),
        );
        const draftStr = res.Item?.draftJson;
        if (!draftStr) continue;
        const draft = JSON.parse(String(draftStr));
        await ddb.send(
          new UpdateCommand({
            TableName: CONTENT_TABLE,
            Key: { locale: loc },
            UpdateExpression: 'SET publishedJson = :p, updatedAt = :u',
            ExpressionAttributeValues: {
              ':p': JSON.stringify(draft),
              ':u': new Date().toISOString(),
            },
          }),
        );
      }

      const { githubToken, repository } = await getGithubConfig();
      if (githubToken && repository) {
        const [owner, repo] = repository.split('/');
        if (owner && repo) {
          const dispatchRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/dispatches`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${githubToken}`,
                'X-GitHub-Api-Version': '2022-11-28',
              },
              body: JSON.stringify({
                event_type: 'publish-site',
                client_payload: { source: 'bonae-api' },
              }),
            },
          );
          if (!dispatchRes.ok) {
            const text = await dispatchRes.text();
            return json(502, {
              error: 'Publish stored; GitHub dispatch failed',
              status: dispatchRes.status,
              detail: text.slice(0, 500),
            });
          }
        }
      }

      return json(200, { ok: true, published: true, githubDispatch: Boolean(githubToken && repository) });
    }

    return json(404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(e);
    return json(500, { error: 'Internal error', detail: msg });
  }
}
