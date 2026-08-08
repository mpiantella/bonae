import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const staticRoot = new URL('..', import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);

function readText(pathname) {
  return readFileSync(new URL(pathname, staticRoot), 'utf8');
}

function readJson(pathname) {
  return JSON.parse(readText(pathname));
}

const es = readJson('content/published/es.json');
const en = readJson('content/published/en.json');
const routeFiles = [
  'src/pages/plantillas/[slug].astro',
  'src/pages/en/templates/[slug].astro',
];

test('static source does not ship debug ingestion markers', () => {
  const markers = [
    '#region agent log',
    '127.0.0.1:7408/ingest',
    'X-Debug-Session-Id',
    'hypothesisId',
  ];
  const sourceFiles = [
    ...routeFiles,
    'src/components/TemplateDetail.astro',
    'src/components/Templates.astro',
  ];

  for (const file of sourceFiles) {
    const source = readText(file);
    for (const marker of markers) {
      assert.equal(source.includes(marker), false, `${file} must not contain ${marker}`);
    }
  }
});

test('live template slugs are localized route-compatible and aligned', () => {
  const liveEs = es.templates.items.filter((item) => !item.comingSoon);
  const liveEn = en.templates.items.filter((item) => !item.comingSoon);

  assert.ok(liveEs.length > 0, 'Spanish content should publish at least one live template');
  assert.deepEqual(
    liveEn.map((item) => item.slug),
    liveEs.map((item) => item.slug),
    'Spanish and English live template slugs should match so detail URLs resolve in both locales',
  );

  for (const routeFile of routeFiles) {
    const source = readText(routeFile);
    assert.match(source, /liveTemplates\(/, `${routeFile} should generate pages only for live templates`);
    assert.match(source, /findTemplateBySlug\(/, `${routeFile} should resolve detail content by slug`);
  }

  for (const item of liveEs) {
    assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${item.title} has a route-safe slug`);
  }
});

test('live templates have public assets, prices, details, and absolute demo URLs', () => {
  for (const [locale, doc] of [
    ['es', es],
    ['en', en],
  ]) {
    for (const item of doc.templates.items.filter((template) => !template.comingSoon)) {
      assert.ok(item.detailDescription.trim(), `${locale}/${item.slug} needs detail-page copy`);
      assert.ok(item.features.length > 0, `${locale}/${item.slug} should show technical details`);
      assert.ok(item.price > 0, `${locale}/${item.slug} should publish a positive price`);
      assert.match(item.demoUrl, /^https?:\/\/.+/i, `${locale}/${item.slug} demo URL must be absolute`);
      assert.ok(item.imageSrc.startsWith('/'), `${locale}/${item.slug} image path should be root-relative`);
      assert.ok(
        existsSync(new URL(`.${item.imageSrc}`, publicRoot)),
        `${locale}/${item.slug} image asset ${item.imageSrc} should exist`,
      );
    }
  }
});

test('template customer-facing copy does not leak internal model identifiers', () => {
  const textFields = ['category', 'title', 'description', 'detailDescription', 'features'];

  for (const [locale, doc] of [
    ['es', es],
    ['en', en],
  ]) {
    for (const item of doc.templates.items) {
      const copy = textFields
        .flatMap((field) => {
          const value = item[field];
          return Array.isArray(value) ? value : [value];
        })
        .join(' ');
      assert.doesNotMatch(copy, /\bmodel-\d+\b/i, `${locale}/${item.slug} copy leaks an internal model id`);
    }
  }
});
