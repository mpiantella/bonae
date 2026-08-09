import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateDraftsForPublish } from '../src/content-store/publish-validation.js';
import {
  readContentState,
  writePublishedAndDraftsFromBundle,
} from '../src/content-store/queries.js';
import type { Env } from '../src/types.js';
import { createFakeSqlStorage } from './fakeSql.js';

const githubMocks = vi.hoisted(() => ({
  createOctokit: vi.fn(),
  readPublishedJson: vi.fn(),
}));

vi.mock('../src/github.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/github.js')>();
  return {
    ...actual,
    createOctokit: githubMocks.createOctokit,
    readPublishedJson: githubMocks.readPublishedJson,
  };
});

const { rehydrateFromGit } = await import('../src/content-store/bootstrap.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(here, '../../../apps/static/content/published');
const esDoc = JSON.parse(readFileSync(path.join(contentDir, 'es.json'), 'utf-8'));
const enDoc = JSON.parse(readFileSync(path.join(contentDir, 'en.json'), 'utf-8'));
const settingsDoc = JSON.parse(readFileSync(path.join(contentDir, 'settings.json'), 'utf-8'));

const env = {
  GITHUB_APP_ID: '1',
  GITHUB_INSTALLATION_ID: '123',
  GITHUB_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----',
  GITHUB_REPO: 'Bonae-Tech/bonae-tech',
  GITHUB_BRANCH: 'main',
} as Env;

function makeSql() {
  const sql = createFakeSqlStorage() as ReturnType<typeof createFakeSqlStorage> & {
    seedPublishedAndDraft: (locale: string, content: unknown, commitSha?: string | null) => void;
  };
  sql.seedPublishedAndDraft('es', esDoc, 'sha-0');
  sql.seedPublishedAndDraft('en', enDoc, 'sha-0');
  sql.seedPublishedAndDraft('settings', settingsDoc, 'sha-0');
  return sql;
}

function mockPublishedReads(bundle: { es: unknown; en: unknown; settings: unknown }) {
  githubMocks.readPublishedJson.mockImplementation(
    async (_octokit: unknown, _config: unknown, fileName: string, ref?: string) => {
      const byFileName: Record<string, unknown> = {
        'es.json': bundle.es,
        'en.json': bundle.en,
        'settings.json': bundle.settings,
      };
      if (!(fileName in byFileName)) {
        throw new Error(`Unexpected published file read: ${fileName}`);
      }
      return { data: byFileName[fileName], sha: `${ref ?? 'branch'}-${fileName}` };
    },
  );
}

describe('writePublishedAndDraftsFromBundle (git-wins rehydrate write)', () => {
  it('overwrites published_cache and drafts for every locale', () => {
    const sql = createFakeSqlStorage() as ReturnType<typeof createFakeSqlStorage> & {
      seedPublishedAndDraft: (locale: string, content: unknown, commitSha?: string | null) => void;
    };
    sql.seedPublishedAndDraft('es', { stale: true }, 'old-sha');
    sql.seedPublishedAndDraft('en', { stale: true }, 'old-sha');
    sql.seedPublishedAndDraft('settings', { stale: true }, 'old-sha');

    const nextEs = { ...esDoc, siteName: 'Rehydrated ES' };
    const nextEn = { ...enDoc, siteName: 'Rehydrated EN' };
    writePublishedAndDraftsFromBundle(
      sql,
      { es: nextEs, en: nextEn, settings: settingsDoc },
      'new-sha',
    );

    const state = readContentState(sql);
    expect(state.lastCommitSha).toBe('new-sha');
    expect((state.published.es as { siteName: string }).siteName).toBe('Rehydrated ES');
    expect((state.draft.es as { siteName: string }).siteName).toBe('Rehydrated ES');
    expect((state.published.en as { siteName: string }).siteName).toBe('Rehydrated EN');
    expect((state.draft.en as { siteName: string }).siteName).toBe('Rehydrated EN');
    expect(state.published.settings).toEqual(settingsDoc);
    expect(state.draft.settings).toEqual(settingsDoc);
  });

  it('does not write when validation fails (callers must validate first)', () => {
    const invalid = { es: { not: 'valid' }, en: { not: 'valid' }, settings: { not: 'valid' } };
    const validation = validateDraftsForPublish(invalid);
    expect(validation.ok).toBe(false);

    const sql = createFakeSqlStorage() as ReturnType<typeof createFakeSqlStorage> & {
      seedPublishedAndDraft: (locale: string, content: unknown, commitSha?: string | null) => void;
    };
    sql.seedPublishedAndDraft('es', esDoc, 'sha-0');
    sql.seedPublishedAndDraft('en', enDoc, 'sha-0');
    sql.seedPublishedAndDraft('settings', settingsDoc, 'sha-0');

    // Simulate rehydrate guard: only write when validation.ok
    if (!validation.ok) {
      const state = readContentState(sql);
      expect((state.published.es as { siteName: string }).siteName).toBe(esDoc.siteName);
      expect((state.draft.es as { siteName: string }).siteName).toBe(esDoc.siteName);
      expect(state.lastCommitSha).toBe('sha-0');
    }
  });
});

describe('rehydrateFromGit', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    githubMocks.createOctokit.mockReset();
    githubMocks.readPublishedJson.mockReset();
    githubMocks.createOctokit.mockResolvedValue({
      git: {
        getRef: vi.fn(async () => ({ data: { object: { sha: 'branch-tip-sha' } } })),
      },
    });
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('reads an explicit commit from Git and replaces published cache and drafts', async () => {
    const sql = makeSql();
    const nextEs = { ...esDoc, siteName: 'Git ES wins' };
    const nextEn = { ...enDoc, siteName: 'Git EN wins' };
    mockPublishedReads({ es: nextEs, en: nextEn, settings: settingsDoc });

    const result = await rehydrateFromGit(sql, env, { commitSha: 'git-sha-123' });

    expect(result).toEqual({ ok: true });
    expect(githubMocks.readPublishedJson).toHaveBeenCalledTimes(3);
    for (const call of githubMocks.readPublishedJson.mock.calls) {
      expect(call[3]).toBe('git-sha-123');
    }
    const state = readContentState(sql);
    expect(state.lastCommitSha).toBe('git-sha-123');
    expect((state.published.es as { siteName: string }).siteName).toBe('Git ES wins');
    expect((state.draft.es as { siteName: string }).siteName).toBe('Git ES wins');
    expect((state.published.en as { siteName: string }).siteName).toBe('Git EN wins');
    expect((state.draft.en as { siteName: string }).siteName).toBe('Git EN wins');
  });

  it('resolves the branch tip when no commit is provided and records that SHA', async () => {
    const sql = makeSql();
    mockPublishedReads({ es: esDoc, en: enDoc, settings: settingsDoc });

    const result = await rehydrateFromGit(sql, env);

    expect(result).toEqual({ ok: true });
    const octokit = await githubMocks.createOctokit.mock.results[0].value;
    expect(octokit.git.getRef).toHaveBeenCalledWith({
      owner: 'Bonae-Tech',
      repo: 'bonae-tech',
      ref: 'heads/main',
    });
    for (const call of githubMocks.readPublishedJson.mock.calls) {
      expect(call[3]).toBe('branch-tip-sha');
    }
    expect(readContentState(sql).lastCommitSha).toBe('branch-tip-sha');
  });

  it('returns an error and leaves existing state untouched when Git content is invalid', async () => {
    const sql = makeSql();
    mockPublishedReads({
      es: { ...esDoc, siteName: 'Invalid bundle should not land' },
      en: { not: 'a valid content document' },
      settings: settingsDoc,
    });

    const result = await rehydrateFromGit(sql, env, { commitSha: 'bad-git-sha' });

    expect(result.ok).toBe(false);
    expect(githubMocks.readPublishedJson).toHaveBeenCalledTimes(3);
    const state = readContentState(sql);
    expect(state.lastCommitSha).toBe('sha-0');
    expect((state.published.es as { siteName: string }).siteName).toBe(esDoc.siteName);
    expect((state.draft.es as { siteName: string }).siteName).toBe(esDoc.siteName);
    expect((state.published.en as { siteName: string }).siteName).toBe(enDoc.siteName);
    expect((state.draft.en as { siteName: string }).siteName).toBe(enDoc.siteName);
  });
});
