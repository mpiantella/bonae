import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const staticRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const publishedRoot = path.join(staticRoot, 'content/published');
const publicRoot = path.join(staticRoot, 'public');
const srcRoot = path.join(staticRoot, 'src');

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(publishedRoot, fileName), 'utf8'));
}

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(fullPath);
      }
      if (entry.isFile() && /\.(astro|js|ts|tsx)$/.test(entry.name)) {
        return [fullPath];
      }
      return [];
    }),
  );
  return files.flat();
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon);
}

describe('template static contracts', () => {
  it('keeps debug instrumentation out of shipped source files', async () => {
    const forbidden = [
      /127\.0\.0\.1:7408/,
      /X-Debug-Session-Id/,
      /#region agent log/,
      /\/ingest\/[0-9a-f-]{36}/i,
    ];

    for (const filePath of await sourceFiles(srcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern, `${path.relative(staticRoot, filePath)} contains debug code`);
      }
    }
  });

  it('publishes live templates with matching slugs, existing images, and absolute demo URLs', () => {
    const es = readJson('es.json');
    const en = readJson('en.json');
    const esLive = liveTemplates(es);
    const enLive = liveTemplates(en);

    assert.deepEqual(
      enLive.map((item) => item.slug),
      esLive.map((item) => item.slug),
      'ES and EN live template detail routes must stay aligned',
    );

    for (const [locale, items] of [
      ['es', esLive],
      ['en', enLive],
    ]) {
      assert.ok(items.length > 0, `${locale} should publish at least one live template`);

      for (const item of items) {
        assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${locale} ${item.title} slug`);
        assert.ok(item.detailDescription.trim(), `${locale} ${item.slug} detail description`);
        assert.ok(item.price > 0, `${locale} ${item.slug} price`);
        assert.ok(item.features.length > 0, `${locale} ${item.slug} features`);

        const demoUrl = new URL(item.demoUrl);
        assert.match(demoUrl.protocol, /^https?:$/, `${locale} ${item.slug} demo URL protocol`);

        const assetPath = path.join(publicRoot, item.imageSrc.replace(/^\//, ''));
        assert.ok(existsSync(assetPath), `${locale} ${item.slug} image asset exists`);
      }
    }
  });
});
