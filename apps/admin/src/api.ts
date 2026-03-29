import { getApiBaseUrl } from './config';

export async function apiFetch(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith('http')
    ? path
    : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...headers,
    },
  });
}
