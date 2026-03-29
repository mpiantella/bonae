import { useCallback, useEffect, useState } from 'react';
import type { CognitoUserSession } from 'amazon-cognito-identity-js';
import { getSession, signIn, signOut, getIdToken } from './auth';
import { apiFetch } from './api';

type Locale = 'es' | 'en';

type DraftShape = Record<string, unknown>;

type SaveFeedback = { text: string; variant: 'success' | 'error' };

/** Plain object sections from the draft API (excludes null, arrays, primitives). */
function asStringRecord(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, string>;
}

export default function App() {
  const [session, setSession] = useState<CognitoUserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [locale, setLocale] = useState<Locale>('es');
  const [draft, setDraft] = useState<DraftShape>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const token = session ? getIdToken(session) : '';

  const loadContent = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/admin/content/${locale}`, token);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as { draft: DraftShape };
      setDraft(data.draft && typeof data.draft === 'object' ? data.draft : {});
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [token, locale]);

  useEffect(() => {
    if (session) void loadContent();
  }, [session, loadContent]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const s = await signIn(email.trim(), password);
      setSession(s);
      setPassword('');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : String(err));
    }
  }

  function setHeroField(key: string, value: string) {
    setDraft((d) => ({
      ...d,
      hero: { ...(asStringRecord(d.hero) ?? {}), [key]: value },
    }));
  }

  function setContactField(key: string, value: string) {
    setDraft((d) => ({
      ...d,
      contact: { ...(asStringRecord(d.contact) ?? {}), [key]: value },
    }));
  }

  const hero = asStringRecord(draft.hero);
  const contact = asStringRecord(draft.contact);

  async function saveDraft() {
    if (!token) return;
    setSaveFeedback(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/admin/content/${locale}`, token, {
        method: 'PUT',
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(j.error ?? j.detail ?? res.statusText);
      }
      setSaveFeedback({ text: 'Borrador guardado.', variant: 'success' });
    } catch (e) {
      setSaveFeedback({
        text: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!token) return;
    setSaveFeedback(null);
    setBusy(true);
    try {
      const res = await apiFetch('/admin/publish', token, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const body = j as { error?: string; detail?: string };
        throw new Error(body.error ?? body.detail ?? res.statusText);
      }
      setSaveFeedback({
        text: (j as { githubDispatch?: boolean }).githubDispatch
          ? 'Publicado. Despliegue del sitio iniciado en GitHub.'
          : 'Contenido publicado en la base de datos. Configura el secreto de GitHub para despliegue automático.',
        variant: 'success',
      });
    } catch (e) {
      setSaveFeedback({
        text: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="app">
        <p>Cargando…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <h1>BONAE — Admin</h1>
        <p>Inicia sesión con tu cuenta de Cognito.</p>
        <form className="card" onSubmit={handleLogin}>
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {loginError ? <p className="error">{loginError}</p> : null}
          <div className="row" style={{ marginTop: '1rem' }}>
            <button type="submit">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>BONAE — Contenido</h1>
        <button
          type="button"
          onClick={() => {
            signOut();
            setSession(null);
          }}
        >
          Salir
        </button>
      </div>

      <div className="tabs row" style={{ marginBottom: '1rem' }}>
        <button type="button" className={locale === 'es' ? 'active' : ''} onClick={() => setLocale('es')}>
          Español
        </button>
        <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>
          English
        </button>
        <button type="button" disabled={busy} onClick={() => void loadContent()}>
          Recargar
        </button>
      </div>

      {loadError ? <p className="error">{loadError}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Hero</h2>
        <label htmlFor="badge">badge</label>
        <input
          id="badge"
          value={hero?.badge ?? ''}
          onChange={(e) => setHeroField('badge', e.target.value)}
        />
        <label htmlFor="headline">headline</label>
        <input
          id="headline"
          value={hero?.headline ?? ''}
          onChange={(e) => setHeroField('headline', e.target.value)}
        />
        <label htmlFor="subheadline">subheadline</label>
        <textarea
          id="subheadline"
          rows={4}
          value={hero?.subheadline ?? ''}
          onChange={(e) => setHeroField('subheadline', e.target.value)}
        />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Contacto (visible)</h2>
        <label htmlFor="emailc">email</label>
        <input
          id="emailc"
          type="text"
          value={contact?.email ?? ''}
          onChange={(e) => setContactField('email', e.target.value)}
        />
        <label htmlFor="phone">phone</label>
        <input
          id="phone"
          value={contact?.phone ?? ''}
          onChange={(e) => setContactField('phone', e.target.value)}
        />
      </div>

      <div className="row">
        <button type="button" disabled={busy} onClick={() => void saveDraft()}>
          Guardar borrador
        </button>
        <button type="button" disabled={busy} onClick={() => void publish()}>
          Publicar sitio
        </button>
      </div>
      {saveFeedback ? (
        <p className={saveFeedback.variant === 'error' ? 'error' : 'success'}>{saveFeedback.text}</p>
      ) : null}
    </div>
  );
}
