import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const staticRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(staticRoot, 'src');
const publicRoot = path.join(staticRoot, 'public');
const publishedRoot = path.join(staticRoot, 'content', 'published');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listSourceFiles(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      return listSourceFiles(entryPath);
    }
    return /\.(astro|[cm]?[jt]sx?)$/.test(entryPath) ? [entryPath] : [];
  });
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon);
}

describe('template production contract', () => {
  it('does not ship debug instrumentation in static source', () => {
    const forbiddenMarkers = [
      '#region agent log',
      '127.0.0.1:7408/ingest',
      'X-Debug-Session-Id',
      'hypothesisId',
    ];
    const violations = [];

    for (const filePath of listSourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const marker of forbiddenMarkers) {
        if (source.includes(marker)) {
          violations.push(`${path.relative(staticRoot, filePath)} contains ${marker}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });

  it('keeps published live template detail pages deployable', () => {
    const es = readJson(path.join(publishedRoot, 'es.json'));
    const en = readJson(path.join(publishedRoot, 'en.json'));
    const esLiveTemplates = liveTemplates(es);
    const enLiveTemplates = liveTemplates(en);

    assert.ok(existsSync(path.join(sourceRoot, 'pages', 'plantillas', '[slug].astro')));
    assert.ok(existsSync(path.join(sourceRoot, 'pages', 'en', 'templates', '[slug].astro')));
    assert.deepEqual(
      esLiveTemplates.map((item) => item.slug),
      enLiveTemplates.map((item) => item.slug),
      'live template slugs must stay localized to the same routes',
    );

    for (const item of [...esLiveTemplates, ...enLiveTemplates]) {
      assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(item.detailDescription.trim(), `${item.slug} must have detail copy`);
      assert.ok(item.price > 0, `${item.slug} must have a positive price`);
      assert.match(item.demoUrl, /^https?:\/\/.+/i, `${item.slug} demo URL must be absolute`);
      assert.ok(item.imageSrc.startsWith('/'), `${item.slug} image must use a public path`);

      const assetPath = path.join(publicRoot, item.imageSrc);
      assert.ok(existsSync(assetPath), `${item.slug} image asset is missing: ${item.imageSrc}`);
    }
  });
});
