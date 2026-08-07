import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcRoot = path.join(appRoot, 'src');
const publishedRoot = path.join(appRoot, 'content', 'published');
const publicRoot = path.join(appRoot, 'public');

const sourceExtensions = new Set(['.astro', '.js', '.mjs', '.ts', '.tsx']);
const debugMarkers = [
  '127.0.0.1:7408/ingest',
  'X-Debug-Session-Id',
  '#region agent log',
  'hypothesisId',
];

function collectSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function readPublished(locale) {
  return JSON.parse(readFileSync(path.join(publishedRoot, `${locale}.json`), 'utf8'));
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon);
}

function assertAbsoluteHttpUrl(value, message) {
  assert.notEqual(value.trim(), '', message);
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' || url.protocol === 'https:', message);
}

test('static source does not ship debug instrumentation', () => {
  const leaks = [];

  for (const file of collectSourceFiles(srcRoot)) {
    const source = readFileSync(file, 'utf8');
    for (const marker of debugMarkers) {
      if (source.includes(marker)) {
        leaks.push(`${path.relative(appRoot, file)} contains ${marker}`);
      }
    }
  }

  assert.deepEqual(leaks, []);
});

test('published live templates can generate safe detail pages', () => {
  const es = readPublished('es');
  const en = readPublished('en');

  assert.ok(
    existsSync(path.join(srcRoot, 'pages', 'plantillas', '[slug].astro')),
    'Spanish template detail route is required',
  );
  assert.ok(
    existsSync(path.join(srcRoot, 'pages', 'en', 'templates', '[slug].astro')),
    'English template detail route is required',
  );
  assert.equal(
    es.templates.items.length,
    en.templates.items.length,
    'ES/EN template lists must stay index-aligned',
  );

  for (const [index, esItem] of es.templates.items.entries()) {
    const enItem = en.templates.items[index];
    assert.equal(esItem.slug, enItem.slug, `Template slug mismatch at index ${index}`);
    assert.equal(
      esItem.features.length,
      enItem.features.length,
      `Template feature count mismatch for ${esItem.slug || `index ${index}`}`,
    );
  }

  for (const [locale, doc] of [
    ['es', es],
    ['en', en],
  ]) {
    for (const item of liveTemplates(doc)) {
      assert.match(
        item.slug,
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `${locale} live template "${item.title}" needs a route-safe slug`,
      );
      assert.ok(item.detailDescription.trim(), `${locale} live template "${item.slug}" needs detail copy`);
      assert.ok(Number.isInteger(item.price) && item.price > 0, `${locale} live template "${item.slug}" needs a price`);
      assertAbsoluteHttpUrl(item.demoUrl, `${locale} live template "${item.slug}" needs an absolute demo URL`);

      const assetPath = path.join(publicRoot, item.imageSrc.replace(/^\/+/, ''));
      assert.ok(existsSync(assetPath), `${locale} live template "${item.slug}" image is missing: ${item.imageSrc}`);
    }
  }
});
