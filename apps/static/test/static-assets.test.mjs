import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);

async function readManifest() {
  return JSON.parse(await readFile(new URL('manifest.webmanifest', publicRoot), 'utf8'));
}

function publicAssetUrl(src) {
  assert.match(src, /^\//, 'public asset references must be absolute paths');
  return new URL(`.${src}`, publicRoot);
}

async function assertPublicFileExists(src) {
  const asset = await stat(publicAssetUrl(src));
  assert.equal(asset.isFile(), true, `${src} should resolve to a public file`);
}

async function readServiceWorkerInstallAssets() {
  const script = await readFile(new URL('sw.js', publicRoot), 'utf8');
  const eventHandlers = new Map();
  let precacheAssets;

  const context = {
    self: {
      addEventListener(type, handler) {
        eventHandlers.set(type, handler);
      },
      skipWaiting() {},
      clients: {
        claim() {},
      },
    },
    caches: {
      async open() {
        return {
          async addAll(assets) {
            precacheAssets = assets;
          },
          async put() {},
        };
      },
      async keys() {
        return [];
      },
      async delete() {
        return true;
      },
      async match() {
        return undefined;
      },
    },
    async fetch() {
      return {
        status: 200,
        type: 'basic',
        clone() {
          return this;
        },
      };
    },
    Promise,
  };

  vm.runInNewContext(script, context, { filename: 'sw.js' });

  const installHandler = eventHandlers.get('install');
  assert.equal(typeof installHandler, 'function', 'service worker should register an install handler');

  const installPromises = [];
  installHandler({
    waitUntil(promise) {
      installPromises.push(promise);
    },
  });
  await Promise.all(installPromises);

  assert.ok(Array.isArray(precacheAssets), 'install handler should precache an asset list');
  return precacheAssets;
}

test('web app manifest references the shipped PNG favicon', async () => {
  const manifest = await readManifest();

  assert.deepEqual(manifest.icons, [
    {
      src: '/favicon.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ]);
  await assertPublicFileExists(manifest.icons[0].src);
});

test('document head icon links stay aligned with the manifest icon asset', async () => {
  const manifest = await readManifest();
  const layout = await readFile(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');

  for (const icon of manifest.icons) {
    assert.match(layout, new RegExp(`<link rel="icon" type="${icon.type}" href="${icon.src}" />`));
    assert.match(layout, new RegExp(`<link rel="apple-touch-icon" href="${icon.src}" />`));
  }
  assert.doesNotMatch(layout, /favicon\.svg/);
});

test('service worker precaches manifest icons that resolve to public files', async () => {
  const manifest = await readManifest();
  const precacheAssets = await readServiceWorkerInstallAssets();

  assert.ok(precacheAssets.includes('/manifest.webmanifest'));
  for (const icon of manifest.icons) {
    assert.ok(precacheAssets.includes(icon.src), `${icon.src} should be precached`);
  }
  assert.equal(precacheAssets.includes('/favicon.svg'), false);

  for (const asset of precacheAssets) {
    if (path.extname(new URL(asset, 'https://bonaetech.com').pathname) === '') {
      continue;
    }
    await assertPublicFileExists(asset);
  }
});
