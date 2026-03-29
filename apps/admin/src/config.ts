/**
 * Central place for Vite env validation. Avoids calling .replace on undefined
 * and gives callers a single check for the admin shell.
 */
export type AdminEnvConfig = {
  apiBaseUrl: string;
  userPoolId: string;
  clientId: string;
  /** Documented in .env.example; not passed to CognitoUserPool but useful for support text */
  awsRegion: string;
};

export type AdminEnvResult =
  | { ok: true; config: AdminEnvConfig }
  | { ok: false; missing: string[] };

const REQUIRED_KEYS = [
  ['VITE_API_URL', () => import.meta.env.VITE_API_URL],
  ['VITE_USER_POOL_ID', () => import.meta.env.VITE_USER_POOL_ID],
  ['VITE_USER_POOL_CLIENT_ID', () => import.meta.env.VITE_USER_POOL_CLIENT_ID],
] as const;

export function readAdminEnv(): AdminEnvResult {
  const missing: string[] = [];
  for (const [name, get] of REQUIRED_KEYS) {
    const v = get();
    if (typeof v !== 'string' || !v.trim()) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const apiUrl = import.meta.env.VITE_API_URL!.trim();
  const userPoolId = import.meta.env.VITE_USER_POOL_ID!.trim();
  const clientId = import.meta.env.VITE_USER_POOL_CLIENT_ID!.trim();
  const awsRegion =
    typeof import.meta.env.VITE_AWS_REGION === 'string' && import.meta.env.VITE_AWS_REGION.trim()
      ? import.meta.env.VITE_AWS_REGION.trim()
      : '';

  return {
    ok: true,
    config: {
      apiBaseUrl: apiUrl.replace(/\/$/, ''),
      userPoolId,
      clientId,
      awsRegion,
    },
  };
}

let cachedBaseUrl: string | null = null;

/** Call only when `readAdminEnv().ok === true` (e.g. inside App after gate). */
export function getApiBaseUrl(): string {
  const r = readAdminEnv();
  if (!r.ok) {
    throw new Error(
      `Admin configuration incomplete. Missing: ${r.missing.join(', ')}. See apps/admin/.env.example.`,
    );
  }
  if (cachedBaseUrl === null) {
    cachedBaseUrl = r.config.apiBaseUrl;
  }
  return cachedBaseUrl;
}
