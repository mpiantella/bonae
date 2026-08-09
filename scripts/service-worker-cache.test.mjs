import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = resolve(import.meta.dirname, '..');

function loadServiceWorker(relativePath, { origin = 'https://admin.bonae.test' } = {}) {
  const listeners = new Map();
  const openedCaches = [];
  const cacheDeletes = [];
  const cacheMatches = [];
  const cachePuts = [];
  const fetches = [];

  const cacheStore = {
    addAll: async (assets) => {
      openedCaches.at(-1).assets = Array.from(assets);
    },
    put: async (request, response) => {
      cachePuts.push({ request, response });
    },
  };

  const context = vm.createContext({
    URL,
    self: {
      location: { origin },
      clients: { claim: () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (eventName, listener) => {
        listeners.set(eventName, listener);
      },
    },
    caches: {
      open: async (name) => {
        openedCaches.push({ name, assets: undefined });
        return cacheStore;
      },
      keys: async () => ['old-cache', openedCaches.at(-1)?.name].filter(Boolean),
      delete: async (name) => {
        cacheDeletes.push(name);
        return true;
      },
      match: async (request) => {
        cacheMatches.push(request);
        return undefined;
      },
    },
    fetch: async (request) => {
      fetches.push(request);
      return {
        status: 200,
        type: 'basic',
        clone() {
          return this;
        },
      };
    },
  });

  vm.runInContext(readFileSync(resolve(repoRoot, relativePath), 'utf8'), context, {
    filename: relativePath,
  });

  return { listeners, openedCaches, cacheDeletes, cacheMatches, cachePuts, fetches };
}

async function dispatchLifecycle(listener) {
  let work;
  listener({
    waitUntil(promise) {
      work = promise;
    },
  });
  await work;
}

async function dispatchFetch(listener, request) {
  let responsePromise;
  listener({
    request,
    respondWith(promise) {
      responsePromise = promise;
    },
  });
  return responsePromise;
}

test('admin service worker precaches the app shell with a build-scoped cache name', async () => {
  const worker = loadServiceWorker('apps/admin/public/sw.js');

  await dispatchLifecycle(worker.listeners.get('install'));

  assert.deepEqual(worker.openedCaches, [
    {
      name: 'bonae-admin-__BUILD_HASH__',
      assets: ['/'],
    },
  ]);
});

test('admin service worker does not intercept same-origin content API requests', async () => {
  const worker = loadServiceWorker('apps/admin/public/sw.js');

  const responsePromise = await dispatchFetch(worker.listeners.get('fetch'), {
    method: 'GET',
    mode: 'same-origin',
    url: 'https://admin.bonae.test/content/state',
  });

  assert.equal(responsePromise, undefined);
  assert.deepEqual(worker.fetches, []);
  assert.deepEqual(worker.cacheMatches, []);
  assert.deepEqual(worker.cachePuts, []);
});

test('admin service worker only bypasses content API paths on its own origin', async () => {
  const worker = loadServiceWorker('apps/admin/public/sw.js');
  const crossOriginRequest = {
    method: 'GET',
    mode: 'cors',
    url: 'https://api.example.test/content/state',
  };

  const responsePromise = await dispatchFetch(worker.listeners.get('fetch'), crossOriginRequest);
  const response = await responsePromise;

  assert.equal(response.status, 200);
  assert.deepEqual(worker.cacheMatches, [crossOriginRequest]);
  assert.deepEqual(worker.fetches, [crossOriginRequest]);
  assert.equal(worker.cachePuts.length, 1);
  assert.equal(worker.openedCaches.at(-1).name, 'bonae-admin-__BUILD_HASH__');
});

test('static service worker precaches localized shells with a build-scoped cache name', async () => {
  const worker = loadServiceWorker('apps/static/public/sw.js', {
    origin: 'https://bonaetech.com',
  });

  await dispatchLifecycle(worker.listeners.get('install'));

  assert.deepEqual(worker.openedCaches, [
    {
      name: 'bonae-tech-__BUILD_HASH__',
      assets: ['/', '/en/', '/manifest.webmanifest', '/favicon.svg'],
    },
  ]);
});
