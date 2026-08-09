import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDir, '..');
const repoRoot = path.resolve(appRoot, '../..');
const publishedRoot = path.join(appRoot, 'content/published');
const staticSourceRoot = path.join(appRoot, 'src');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function walkFiles(dir, extensions) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(entryPath, extensions);
    }
    return extensions.includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon);
}

function assertAbsoluteHttpUrl(value, message) {
  let url;
  assert.doesNotThrow(() => {
    url = new URL(value);
  }, message);
  assert.ok(url.protocol === 'http:' || url.protocol === 'https:', message);
}

const es = readJson(path.join(publishedRoot, 'es.json'));
const en = readJson(path.join(publishedRoot, 'en.json'));

test('static source does not ship debug instrumentation', () => {
  const forbiddenPatterns = [
    /127\.0\.0\.1:7408\/ingest/,
    /X-Debug-Session-Id/,
    /\bhypothesisId\b/,
    /#region agent log/,
  ];

  for (const filePath of walkFiles(staticSourceRoot, ['.astro', '.js', '.mjs', '.ts'])) {
    const relativePath = path.relative(repoRoot, filePath);
    const source = readFileSync(filePath, 'utf8');

    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(source, pattern, `${relativePath} contains debug instrumentation: ${pattern}`);
    }
  }
});

test('published live templates have localized routes and production-safe metadata', () => {
  const esLiveTemplates = liveTemplates(es);
  const enLiveTemplates = liveTemplates(en);

  assert.ok(esLiveTemplates.length > 0, 'Spanish content should publish at least one live template');
  assert.deepEqual(
    enLiveTemplates.map((item) => item.slug),
    esLiveTemplates.map((item) => item.slug),
    'English live template slugs should match Spanish live template slugs in order',
  );

  assert.ok(
    existsSync(path.join(staticSourceRoot, 'pages/plantillas/[slug].astro')),
    'Spanish template detail route must exist',
  );
  assert.ok(
    existsSync(path.join(staticSourceRoot, 'pages/en/templates/[slug].astro')),
    'English template detail route must exist',
  );

  for (const [locale, items] of [
    ['es', esLiveTemplates],
    ['en', enLiveTemplates],
  ]) {
    for (const item of items) {
      const label = `${locale} template ${item.slug || item.title}`;
      assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${label} must use a route-safe slug`);
      assert.ok(item.detailDescription.trim(), `${label} must have detail copy for the detail page`);
      assert.ok(item.price > 0, `${label} must have a customer-visible positive price`);
      assert.ok(item.features.length > 0, `${label} must have detail-page feature bullets`);
      assertAbsoluteHttpUrl(item.demoUrl, `${label} must link to an absolute http(s) demo URL`);

      const imagePath = path.join(appRoot, 'public', item.imageSrc.replace(/^\//, ''));
      assert.ok(existsSync(imagePath), `${label} image asset is missing: ${item.imageSrc}`);

      const customerCopy = [
        item.category,
        item.title,
        item.description,
        item.detailDescription,
        ...item.features,
      ].join('\n');
      assert.doesNotMatch(customerCopy, /\bmodel-\d+\b/i, `${label} exposes an internal model id`);
    }
  }
});
