import { OAuthClient } from './oauth';

export interface Env {
  GITHUB_OAUTH_ID: string;
  GITHUB_OAUTH_SECRET: string;
  /** Set to "1" if the CMS edits a private repo (uses `repo` scope). Default is public repo scopes. */
  GITHUB_REPO_PRIVATE?: string;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function createOAuth(env: Env): OAuthClient {
  return new OAuthClient({
    id: env.GITHUB_OAUTH_ID,
    secret: env.GITHUB_OAUTH_SECRET,
    target: {
      tokenHost: 'https://github.com',
      tokenPath: '/login/oauth/access_token',
      authorizePath: '/login/oauth/authorize',
    },
  });
}

function redirectUri(requestUrl: URL): string {
  return `${requestUrl.origin}/callback?provider=github`;
}

function defaultScope(env: Env): string {
  const repoIsPrivate = env.GITHUB_REPO_PRIVATE === '1' || env.GITHUB_REPO_PRIVATE === 'true';
  return repoIsPrivate ? 'repo,user' : 'public_repo,user';
}

/** Decap CMS `NetlifyAuthenticator` handshake + token delivery (see decap-cms-lib-auth). */
function successHtml(token: string): Response {
  const tokenLiteral = JSON.stringify(token);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Signing in</title></head>
<body>
<script>
(function () {
  var token = ${tokenLiteral};
  function receiveMessage() {
    window.opener.postMessage(
      'authorization:github:success:' + JSON.stringify({ token: token }),
      '*'
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
<p>Signing in… You can close this window.</p>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function errorHtml(message: string): Response {
  const msgLiteral = JSON.stringify(message);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Authorization failed</title></head>
<body>
<script>
(function () {
  var msg = ${msgLiteral};
  function receiveMessage() {
    window.opener.postMessage(
      'authorization:github:error:' + JSON.stringify({ message: msg }),
      '*'
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
<p>Authorization failed. You can close this window.</p>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleAuth(requestUrl: URL, env: Env): Promise<Response> {
  if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) {
    return new Response('Missing GITHUB_OAUTH_ID or GITHUB_OAUTH_SECRET', { status: 500 });
  }

  const provider = requestUrl.searchParams.get('provider');
  if (provider !== 'github') {
    return new Response('Invalid or missing provider (expected github)', { status: 400 });
  }

  const scopeParam = requestUrl.searchParams.get('scope');
  const scope = scopeParam && scopeParam.length > 0 ? scopeParam : defaultScope(env);
  const oauth2 = createOAuth(env);
  const state = randomHex(16);
  const authorizationUri = oauth2.authorizeURL({
    redirect_uri: redirectUri(requestUrl),
    scope,
    state,
  });

  return Response.redirect(authorizationUri, 302);
}

async function handleCallback(requestUrl: URL, env: Env): Promise<Response> {
  if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) {
    return new Response('Missing GITHUB_OAUTH_ID or GITHUB_OAUTH_SECRET', { status: 500 });
  }

  const provider = requestUrl.searchParams.get('provider');
  if (provider !== 'github') {
    return new Response('Invalid or missing provider (expected github)', { status: 400 });
  }

  const ghError = requestUrl.searchParams.get('error');
  const ghErrorDesc = requestUrl.searchParams.get('error_description');
  if (ghError) {
    return errorHtml(ghErrorDesc ?? ghError);
  }

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    return errorHtml('Missing authorization code');
  }

  try {
    const oauth2 = createOAuth(env);
    const accessToken = await oauth2.getToken({
      code,
      redirect_uri: redirectUri(requestUrl),
    });
    return successHtml(accessToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorHtml(msg);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/' || path === '') {
      return Response.json({
        service: 'decap-github-oauth',
        docs: 'https://decapcms.org/docs/authentication-backends/',
      });
    }

    if (path === '/auth') {
      return handleAuth(url, env);
    }

    if (path === '/callback') {
      return handleCallback(url, env);
    }

    return new Response('Not found', { status: 404 });
  },
};
