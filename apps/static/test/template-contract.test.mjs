import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(here, '..');
const repoRoot = path.resolve(staticRoot, '../..');
const publishedRoot = path.join(staticRoot, 'content/published');
const sourceRoot = path.join(staticRoot, 'src');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    return [fullPath];
  });
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon && item.slug.trim());
}

test('static source does not ship debug ingest instrumentation', () => {
  const forbiddenPatterns = [
    /#region agent log/,
    /127\.0\.0\.1:7408\/ingest/,
    /X-Debug-Session-Id/,
    /hypothesisId/,
  ];
  const sourceFiles = walkFiles(sourceRoot).filter((filePath) =>
    /\.(astro|[cm]?[jt]sx?)$/.test(filePath),
  );

  for (const filePath of sourceFiles) {
    const source = readFileSync(filePath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(
        source,
        pattern,
        `${path.relative(repoRoot, filePath)} contains ${pattern}`,
      );
    }
  }
});

test('published live templates have localized routes and production assets', () => {
  const docs = {
    es: readJson(path.join(publishedRoot, 'es.json')),
    en: readJson(path.join(publishedRoot, 'en.json')),
  };

  const esLive = liveTemplates(docs.es);
  const enLive = liveTemplates(docs.en);
  assert.deepEqual(
    enLive.map((item) => item.slug),
    esLive.map((item) => item.slug),
    'ES and EN live template slugs must stay aligned',
  );

  const routeFiles = {
    es: path.join(sourceRoot, 'pages/plantillas/[slug].astro'),
    en: path.join(sourceRoot, 'pages/en/templates/[slug].astro'),
  };

  for (const [locale, doc] of Object.entries(docs)) {
    assert.equal(doc.templates.viewAllHref, '#plantillas');
    assert.ok(existsSync(routeFiles[locale]), `${locale} template detail route is missing`);

    for (const item of liveTemplates(doc)) {
      assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(item.price > 0, `${locale}/${item.slug} must have a positive price`);
      assert.ok(item.features.length > 0, `${locale}/${item.slug} must list technical details`);

      const demo = new URL(item.demoUrl);
      assert.match(demo.protocol, /^https?:$/);

      assert.ok(
        item.imageSrc.startsWith('/'),
        `${locale}/${item.slug} imageSrc must be a public absolute path`,
      );
      const imagePath = path.join(staticRoot, 'public', item.imageSrc);
      assert.ok(existsSync(imagePath), `${locale}/${item.slug} image is missing: ${item.imageSrc}`);
      assert.ok(statSync(imagePath).isFile(), `${locale}/${item.slug} image is not a file`);
    }
  }
});
