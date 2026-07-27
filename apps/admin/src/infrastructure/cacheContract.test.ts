import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(adminRoot, '../..');

function readAdminFile(relativePath: string): string {
  return readFileSync(path.join(adminRoot, relativePath), 'utf8');
}

function headerBlock(headers: string, route: string): string {
  const block = headers
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${route}\n`));

  if (!block) {
    throw new Error(`Missing headers block for ${route}`);
  }

  return block;
}

describe('admin service worker cache contract', () => {
  it('bypasses same-origin content API requests before installing any cache response handler', () => {
    const serviceWorker = readAdminFile('public/sw.js');

    expect(serviceWorker).toContain("url.pathname.startsWith('/content/')");
    expect(serviceWorker).toContain('url.origin === self.location.origin');

    const bypassCheckIndex = serviceWorker.indexOf('isApiRequest(url)');
    const bypassReturnIndex = serviceWorker.indexOf('return;', bypassCheckIndex);
    const firstRespondWithIndex = serviceWorker.indexOf('event.respondWith');

    expect(bypassCheckIndex).toBeGreaterThan(-1);
    expect(bypassReturnIndex).toBeGreaterThan(bypassCheckIndex);
    expect(bypassReturnIndex).toBeLessThan(firstRespondWithIndex);
  });

  it('pre-caches only the admin shell, never content API paths', () => {
    const serviceWorker = readAdminFile('public/sw.js');
    const assetsMatch = serviceWorker.match(/const PRECACHE_ASSETS = \[([\s\S]*?)\];/);

    expect(assetsMatch).not.toBeNull();
    const assets = Array.from(assetsMatch?.[1].matchAll(/'([^']+)'/g) ?? []).map((match) => match[1]);

    expect(assets).toEqual(['/']);
    expect(assets.some((asset) => asset.startsWith('/content/'))).toBe(false);
  });

  it('keeps service worker registration and Pages cache headers aligned', () => {
    const indexHtml = readAdminFile('index.html');
    const headers = readAdminFile('public/_headers');

    expect(indexHtml).toMatch(/navigator\.serviceWorker\.register\('\/sw\.js'\)/);
    expect(headerBlock(headers, '/sw.js')).toContain('Cache-Control: no-store');
    expect(headerBlock(headers, '/assets/*')).toContain(
      'Cache-Control: public, max-age=31536000, immutable',
    );
    expect(headerBlock(headers, '/*')).toContain(
      'Cache-Control: public, max-age=60, must-revalidate',
    );
  });

  it('injects the deployment build hash into the service worker cache name', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'bonae-admin-sw-'));
    try {
      writeFileSync(path.join(tempDir, 'sw.js'), readAdminFile('public/sw.js'));

      execFileSync(
        process.execPath,
        [path.join(repoRoot, 'scripts/inject-sw-build-hash.mjs'), tempDir],
        {
          cwd: repoRoot,
          env: { ...process.env, BUILD_HASH: 'abcdef1234567890' },
        },
      );

      const injectedServiceWorker = readFileSync(path.join(tempDir, 'sw.js'), 'utf8');
      expect(injectedServiceWorker).not.toContain('__BUILD_HASH__');
      expect(injectedServiceWorker).toContain("const CACHE_NAME = 'bonae-admin-abcdef1';");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
