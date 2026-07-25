import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const staticRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(staticRoot, 'public');
const sourceRoot = join(staticRoot, 'src');
const publishedRoot = join(staticRoot, 'content', 'published');

const documents = {
  es: readJson(join(publishedRoot, 'es.json')),
  en: readJson(join(publishedRoot, 'en.json')),
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function liveTemplates(document) {
  return document.templates.items.filter((item) => !item.comingSoon && item.slug.trim());
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(?:astro|[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
  });
}

test('published live template routes stay localized and aligned', () => {
  const esTemplates = liveTemplates(documents.es);
  const enTemplates = liveTemplates(documents.en);
  const enBySlug = new Map(enTemplates.map((item) => [item.slug, item]));

  assert.equal(esTemplates.length, enTemplates.length, 'ES and EN expose the same number of live templates');
  assert.ok(existsSync(join(sourceRoot, 'pages', 'plantillas', '[slug].astro')));
  assert.ok(existsSync(join(sourceRoot, 'pages', 'en', 'templates', '[slug].astro')));

  for (const esItem of esTemplates) {
    const enItem = enBySlug.get(esItem.slug);
    assert.ok(enItem, `Missing EN template for slug ${esItem.slug}`);
    assert.equal(
      enItem.features.length,
      esItem.features.length,
      `Feature count must match for ${esItem.slug}`,
    );
  }
});

test('live template cards have public assets and absolute demo URLs', () => {
  for (const [locale, document] of Object.entries(documents)) {
    for (const item of liveTemplates(document)) {
      assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${locale}/${item.slug} has a route-safe slug`);
      assert.ok(item.detailDescription.trim(), `${locale}/${item.slug} has detail-page copy`);
      assert.ok(item.price > 0, `${locale}/${item.slug} has a publishable price`);

      assert.doesNotThrow(() => new URL(item.demoUrl), `${locale}/${item.slug} has a valid demo URL`);
      assert.match(item.demoUrl, /^https?:\/\//, `${locale}/${item.slug} demo URL is absolute http(s)`);

      assert.ok(item.imageSrc.startsWith('/images/templates/'), `${locale}/${item.slug} uses a template image path`);
      assert.equal(item.imageSrc.includes('..'), false, `${locale}/${item.slug} image path must not traverse`);
      assert.ok(
        existsSync(join(publicRoot, item.imageSrc.slice(1))),
        `${locale}/${item.slug} image exists at ${item.imageSrc}`,
      );
    }
  }
});

test('live template marketing copy does not expose internal model identifiers', () => {
  const internalIdentifier = /\b(?:model|modelo)-\d+\b|\bmodel\s+\d+\s*-/i;

  for (const [locale, document] of Object.entries(documents)) {
    for (const item of liveTemplates(document)) {
      for (const field of ['category', 'title', 'description', 'detailDescription']) {
        assert.doesNotMatch(
          item[field],
          internalIdentifier,
          `${locale}/${item.slug} ${field} should be customer-facing copy`,
        );
      }
    }
  }
});

test('template detail source ships without local debug instrumentation', () => {
  const forbidden = [
    { label: 'agent log marker', pattern: /#region agent log/ },
    { label: 'local ingest endpoint', pattern: /127\.0\.0\.1:7408\/ingest/ },
    { label: 'debug session header', pattern: /X-Debug-Session-Id/ },
  ];

  for (const path of sourceFiles(sourceRoot)) {
    const source = readFileSync(path, 'utf8');
    const displayPath = relative(staticRoot, path);

    for (const { label, pattern } of forbidden) {
      assert.doesNotMatch(source, pattern, `${displayPath} contains ${label}`);
    }
  }
});
