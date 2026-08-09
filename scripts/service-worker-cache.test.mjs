import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { setImmediate as tick } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

class MockResponse {
  constructor(body, { status = 200, type = 'basic' } = {}) {
    this.body = body;
    this.status = status;
    this.type = type;
  }

  clone() {
    return new MockResponse(this.body, { status: this.status, type: this.type });
  }
}

function request(url, { method = 'GET', mode = 'same-origin' } = {}) {
  return { url, method, mode };
}

function cacheKey(value) {
  return typeof value === 'string' ? value : value.url;
}

async function flushAsyncCacheWrites() {
  await tick();
}

async function loadServiceWorker(relativePath, { origin = 'https://www.bonae.test' } = {}) {
  const source = await readFile(join(repoRoot, relativePath), 'utf8');
  const listeners = new Map();
  const cacheStores = new Map();
  const fetchCalls = [];
  let fetchImplementation = async () => new MockResponse('network');
  let skipWaitingCalled = false;
  let clientsClaimCalled = false;

  const caches = {
    async open(name) {
      if (!cacheStores.has(name)) {
        cacheStores.set(name, new Map());
      }
      const store = cacheStores.get(name);
      return {
        async addAll(assets) {
          for (const asset of assets) {
            store.set(asset, new MockResponse(`precache:${asset}`));
          }
        },
        async put(cacheRequest, response) {
          store.set(cacheKey(cacheRequest), response);
        },
      };
    },
    async keys() {
      return [...cacheStores.keys()];
    },
    async delete(name) {
      return cacheStores.delete(name);
    },
    async match(cacheRequest) {
      const key = cacheKey(cacheRequest);
      for (const store of cacheStores.values()) {
        if (store.has(key)) {
          return store.get(key);
        }
      }
      return undefined;
    },
  };

  const context = {
    URL,
    caches,
    fetch: async (fetchRequest) => {
      fetchCalls.push(fetchRequest);
      return fetchImplementation(fetchRequest);
    },
    self: {
      location: { origin },
      clients: {
        claim() {
          clientsClaimCalled = true;
        },
      },
      skipWaiting() {
        skipWaitingCalled = true;
      },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    },
  };
  context.globalThis = context;

  vm.runInNewContext(source, context, { filename: relativePath });

  async function dispatchLifecycle(type) {
    const waitUntilPromises = [];
    listeners.get(type)?.({
      waitUntil(promise) {
        waitUntilPromises.push(Promise.resolve(promise));
      },
    });
    await Promise.all(waitUntilPromises);
  }

  async function dispatchFetch(fetchRequest) {
    let responsePromise;
    listeners.get('fetch')?.({
      request: fetchRequest,
      respondWith(promise) {
        responsePromise = Promise.resolve(promise);
      },
    });
    return responsePromise;
  }

  return {
    caches,
    cacheStores,
    dispatchFetch,
    dispatchLifecycle,
    fetchCalls,
    setFetchImplementation(nextFetchImplementation) {
      fetchImplementation = nextFetchImplementation;
    },
    get clientsClaimCalled() {
      return clientsClaimCalled;
    },
    get skipWaitingCalled() {
      return skipWaitingCalled;
    },
  };
}

test('admin service worker does not intercept same-origin content API requests', async () => {
  const sw = await loadServiceWorker('apps/admin/public/sw.js');

  const response = await sw.dispatchFetch(
    request('https://www.bonae.test/content/documents/home', { mode: 'cors' }),
  );

  assert.equal(response, undefined);
  assert.equal(sw.fetchCalls.length, 0);
});

test('service workers precache navigation fallback and remove old cache versions on activation', async () => {
  const sw = await loadServiceWorker('apps/static/public/sw.js');
  const oldCache = await sw.caches.open('bonae-tech-old-build');
  await oldCache.put('/stale.js', new MockResponse('stale'));

  await sw.dispatchLifecycle('install');
  await sw.dispatchLifecycle('activate');

  assert.equal(sw.skipWaitingCalled, true);
  assert.equal(sw.clientsClaimCalled, true);
  assert.deepEqual(await sw.caches.keys(), ['bonae-tech-__BUILD_HASH__']);

  sw.setFetchImplementation(async () => {
    throw new Error('offline');
  });

  const fallback = await sw.dispatchFetch(
    request('https://www.bonae.test/en/about', { mode: 'navigate' }),
  );

  assert.equal(fallback.body, 'precache:/');
});

test('service workers cache successful same-origin GET responses and reuse them', async () => {
  const sw = await loadServiceWorker('apps/admin/public/sw.js');
  sw.setFetchImplementation(async () => new MockResponse('network:/assets/app.js'));

  const first = await sw.dispatchFetch(request('https://www.bonae.test/assets/app.js'));
  await flushAsyncCacheWrites();
  const second = await sw.dispatchFetch(request('https://www.bonae.test/assets/app.js'));

  assert.equal(first.body, 'network:/assets/app.js');
  assert.equal(second.body, 'network:/assets/app.js');
  assert.equal(sw.fetchCalls.length, 1);
});

test('service workers do not cache non-basic or unsuccessful responses', async () => {
  const sw = await loadServiceWorker('apps/static/public/sw.js');
  sw.setFetchImplementation(async () => new MockResponse('opaque redirect', { type: 'opaque' }));

  await sw.dispatchFetch(request('https://www.bonae.test/assets/font.woff2'));
  await flushAsyncCacheWrites();
  assert.equal(await sw.caches.match(request('https://www.bonae.test/assets/font.woff2')), undefined);

  sw.setFetchImplementation(async () => new MockResponse('server error', { status: 500 }));

  await sw.dispatchFetch(request('https://www.bonae.test/assets/app.js'));
  await flushAsyncCacheWrites();
  assert.equal(await sw.caches.match(request('https://www.bonae.test/assets/app.js')), undefined);
});
