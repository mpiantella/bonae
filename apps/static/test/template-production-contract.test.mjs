import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const staticRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = path.join(staticRoot, 'src');
const publicRoot = path.join(staticRoot, 'public');
const publishedRoot = path.join(staticRoot, 'content', 'published');

const sourceExtensions = new Set(['.astro', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const debugMarkers = [
  '#region agent log',
  '127.0.0.1:7408/ingest',
  'X-Debug-Session-Id',
  'hypothesisId',
];

function walkSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkSourceFiles(fullPath);
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function loadPublished(locale) {
  return JSON.parse(readFileSync(path.join(publishedRoot, `${locale}.json`), 'utf8'));
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon);
}

test('static template source does not ship debug instrumentation', () => {
  const offenders = [];

  for (const filePath of walkSourceFiles(sourceRoot)) {
    const source = readFileSync(filePath, 'utf8');
    for (const marker of debugMarkers) {
      if (source.includes(marker)) {
        offenders.push(`${path.relative(staticRoot, filePath)} contains ${marker}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test('published live templates have production route, asset, and demo contracts', () => {
  const es = loadPublished('es');
  const en = loadPublished('en');
  const esLiveTemplates = liveTemplates(es);
  const enLiveTemplates = liveTemplates(en);

  assert.ok(esLiveTemplates.length > 0, 'expected at least one live ES template');
  assert.equal(enLiveTemplates.length, esLiveTemplates.length, 'ES/EN live template counts must match');
  assert.ok(
    existsSync(path.join(sourceRoot, 'pages', 'plantillas', '[slug].astro')),
    'Spanish template detail route is missing',
  );
  assert.ok(
    existsSync(path.join(sourceRoot, 'pages', 'en', 'templates', '[slug].astro')),
    'English template detail route is missing',
  );

  esLiveTemplates.forEach((esItem, index) => {
    const enItem = enLiveTemplates[index];

    assert.equal(enItem.slug, esItem.slug, `template ${index + 1} slug must match across locales`);
    assert.match(esItem.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${esItem.title} slug must be kebab-case`);

    for (const [locale, item] of [
      ['ES', esItem],
      ['EN', enItem],
    ]) {
      assert.ok(item.title.trim(), `${locale} ${esItem.slug} title is required`);
      assert.ok(item.detailDescription.trim(), `${locale} ${esItem.slug} detail description is required`);
      assert.ok(item.features.length > 0, `${locale} ${esItem.slug} needs detail-page features`);
      assert.ok(item.price > 0, `${locale} ${esItem.slug} needs a positive price`);
      assert.match(item.demoUrl, /^https?:\/\/.+/i, `${locale} ${esItem.slug} demo URL must be absolute http(s)`);
      assert.ok(
        item.imageSrc.startsWith('/images/templates/'),
        `${locale} ${esItem.slug} image must stay under /images/templates/`,
      );
      assert.ok(
        existsSync(path.join(publicRoot, item.imageSrc.replace(/^\//, ''))),
        `${locale} ${esItem.slug} image asset is missing`,
      );
    }
  });
});
