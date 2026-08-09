import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(repoRoot, 'scripts', 'inject-sw-build-hash.mjs');

async function createDist(source) {
  const dir = await mkdtemp(join(tmpdir(), 'bonae-sw-inject-'));
  const distDir = join(dir, 'dist');
  await mkdir(distDir);
  await writeFile(join(distDir, 'sw.js'), source);
  return { distDir, swPath: join(distDir, 'sw.js') };
}

test('injects the first seven BUILD_HASH characters into every service-worker placeholder', async () => {
  const { swPath, distDir } = await createDist(
    "const cache = 'site-__BUILD_HASH__';\nconst asset = '/app.__BUILD_HASH__.js';\n",
  );

  await execFileAsync(process.execPath, [scriptPath, distDir], {
    env: { ...process.env, BUILD_HASH: 'abcdef1234567890' },
  });

  assert.equal(
    await readFile(swPath, 'utf8'),
    "const cache = 'site-abcdef1';\nconst asset = '/app.abcdef1.js';\n",
  );
});

test('fails when the built service worker does not contain the build-hash placeholder', async () => {
  const { distDir } = await createDist("const cache = 'site-static';\n");

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath, distDir], {
      env: { ...process.env, BUILD_HASH: 'abcdef1234567890' },
    }),
    /Placeholder __BUILD_HASH__ not found/,
  );
});
