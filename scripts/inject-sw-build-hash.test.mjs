import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(repoRoot, 'scripts', 'inject-sw-build-hash.mjs');
const placeholder = '__BUILD_HASH__';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'bonae-sw-hash-'));
}

function runInjector(args, { cwd = repoRoot, env = {}, trimEnv = true } = {}) {
  const childEnv = trimEnv ? { PATH: process.env.PATH, ...env } : { ...process.env, ...env };
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    env: childEnv,
    encoding: 'utf8',
  });
}

function writeServiceWorker(distDir, source = `const CACHE_NAME = 'site-${placeholder}';\nself.version = '${placeholder}';\n`) {
  writeFileSync(join(distDir, 'sw.js'), source);
}

test('injects trimmed BUILD_HASH into every service worker placeholder', async (t) => {
  const tempDir = makeTempDir();
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const distDir = join(tempDir, 'dist');
  await mkdir(distDir, { recursive: true });
  writeServiceWorker(distDir);

  const result = runInjector([distDir], {
    env: { BUILD_HASH: '  abcdef1234567890  ' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Injected SW build hash abcdef1 into /);
  const output = readFileSync(join(distDir, 'sw.js'), 'utf8');
  assert.equal(output, "const CACHE_NAME = 'site-abcdef1';\nself.version = 'abcdef1';\n");
});

test('resolves dist paths relative to the caller cwd', async (t) => {
  const appDir = makeTempDir();
  t.after(() => rmSync(appDir, { recursive: true, force: true }));
  const distDir = join(appDir, 'dist');
  await mkdir(distDir, { recursive: true });
  writeServiceWorker(distDir, `const CACHE_NAME = 'admin-${placeholder}';\n`);

  const result = runInjector(['dist'], {
    cwd: appDir,
    env: { BUILD_HASH: '1234567890' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(distDir, 'sw.js'), 'utf8'), "const CACHE_NAME = 'admin-1234567';\n");
});

test('falls back to the current git revision when BUILD_HASH is empty', async (t) => {
  const tempDir = makeTempDir();
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const distDir = join(tempDir, 'dist');
  await mkdir(distDir, { recursive: true });
  writeServiceWorker(distDir);
  const gitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  const result = runInjector([distDir], {
    cwd: repoRoot,
    env: { BUILD_HASH: '   ' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Injected SW build hash ${gitHash} into `));
  assert.equal(readFileSync(join(distDir, 'sw.js'), 'utf8'), `const CACHE_NAME = 'site-${gitHash}';\nself.version = '${gitHash}';\n`);
});

test('fails with usage guidance when the dist path argument is missing', () => {
  const result = runInjector([]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: node scripts\/inject-sw-build-hash\.mjs <path-to-dist>/);
});

test('fails when the built service worker is missing', async (t) => {
  const tempDir = makeTempDir();
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const distDir = join(tempDir, 'dist');
  await mkdir(distDir, { recursive: true });

  const result = runInjector([distDir], {
    env: { BUILD_HASH: 'abcdef123456' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing .*sw\.js\. Run the site build before injecting the SW build hash\./);
});

test('fails instead of deploying a service worker without the placeholder', async (t) => {
  const tempDir = makeTempDir();
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const distDir = join(tempDir, 'dist');
  await mkdir(distDir, { recursive: true });
  writeServiceWorker(distDir, "const CACHE_NAME = 'site-static';\n");

  const result = runInjector([distDir], {
    env: { BUILD_HASH: 'abcdef123456' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Placeholder __BUILD_HASH__ not found in .*sw\.js\./);
  assert.equal(readFileSync(join(distDir, 'sw.js'), 'utf8'), "const CACHE_NAME = 'site-static';\n");
});
