export type OAuthTarget = {
  tokenHost: string;
  tokenPath: string;
  authorizePath: string;
};

export type OAuthConfig = {
  id: string;
  secret: string;
  target: OAuthTarget;
};

export class OAuthClient {
  private readonly clientConfig: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.clientConfig = config;
  }

  authorizeURL(options: { redirect_uri: string; scope: string; state: string }): string {
    const { clientConfig } = this;
    const { tokenHost, authorizePath } = clientConfig.target;
    const { redirect_uri, scope, state } = options;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientConfig.id,
      redirect_uri,
      scope,
      state,
    });
    return `${tokenHost}${authorizePath}?${params.toString()}`;
  }

  async getToken(options: { code: string; redirect_uri: string }): Promise<string> {
    const { clientConfig } = this;
    const { tokenHost, tokenPath } = clientConfig.target;
    const { code, redirect_uri } = options;

    const response = await fetch(`${tokenHost}${tokenPath}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientConfig.id,
        client_secret: clientConfig.secret,
        code,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const json = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || json.error) {
      const msg = json.error_description ?? json.error ?? `HTTP ${response.status}`;
      throw new Error(msg);
    }

    if (!json.access_token) {
      throw new Error('Missing access_token in GitHub response');
    }

    return json.access_token;
  }
}
