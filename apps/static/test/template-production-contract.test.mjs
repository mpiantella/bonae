import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcRoot = path.join(appRoot, 'src');
const publishedRoot = path.join(appRoot, 'content', 'published');
const publicRoot = path.join(appRoot, 'public');

const sourceExtensions = new Set(['.astro', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const forbiddenDebugMarkers = [
  '#region agent log',
  '127.0.0.1:7408/ingest',
  'X-Debug-Session-Id',
  'hypothesisId',
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function collectSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon && item.slug.trim());
}

test('static source does not ship debug ingest instrumentation', () => {
  const offenders = [];

  for (const filePath of collectSourceFiles(srcRoot)) {
    const source = readFileSync(filePath, 'utf8');
    const markers = forbiddenDebugMarkers.filter((marker) => source.includes(marker));

    if (markers.length > 0) {
      offenders.push(`${path.relative(appRoot, filePath)}: ${markers.join(', ')}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('live template details have localized routes and public production assets', () => {
  const es = readJson(path.join(publishedRoot, 'es.json'));
  const en = readJson(path.join(publishedRoot, 'en.json'));
  const esTemplates = liveTemplates(es);
  const enTemplates = liveTemplates(en);

  assert.ok(existsSync(path.join(srcRoot, 'pages', 'plantillas', '[slug].astro')));
  assert.ok(existsSync(path.join(srcRoot, 'pages', 'en', 'templates', '[slug].astro')));
  assert.deepEqual(
    enTemplates.map((item) => item.slug),
    esTemplates.map((item) => item.slug),
  );

  for (const [locale, items] of [
    ['es', esTemplates],
    ['en', enTemplates],
  ]) {
    assert.ok(items.length > 0, `${locale} should publish at least one live template`);

    for (const item of items) {
      assert.equal(item.slug, item.slug.trim(), `${locale} template slug should be trimmed`);
      assert.notEqual(item.detailDescription.trim(), '', `${locale}/${item.slug} needs detail copy`);
      assert.ok(
        item.imageSrc.startsWith('/images/templates/'),
        `${locale}/${item.slug} image should use the public template asset directory`,
      );
      assert.ok(
        existsSync(path.join(publicRoot, item.imageSrc)),
        `${locale}/${item.slug} image asset is missing: ${item.imageSrc}`,
      );
      assert.match(
        new URL(item.demoUrl).protocol,
        /^https?:$/,
        `${locale}/${item.slug} demo URL must be HTTP(S)`,
      );
      assert.ok(item.price > 0, `${locale}/${item.slug} should have a positive price`);
      assert.ok(item.features.length > 0, `${locale}/${item.slug} should list detail features`);
      assert.ok(
        item.features.every((feature) => feature.trim().length > 0),
        `${locale}/${item.slug} should not include blank detail features`,
      );
    }
  }
});
