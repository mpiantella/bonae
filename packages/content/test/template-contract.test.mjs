import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLocaleParity,
  checkLocaleParity,
  contentDocumentSchema,
  parseContentDocument,
  parseSiteSettings,
} from '../dist/index.js';

const publishedRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/static/content/published',
);

function loadPublished(name) {
  return JSON.parse(readFileSync(path.join(publishedRoot, name), 'utf8'));
}

function loadPublishedBundle() {
  return {
    es: loadPublished('es.json'),
    en: loadPublished('en.json'),
    settings: loadPublished('settings.json'),
  };
}

function validationIssuesFor(document) {
  const result = contentDocumentSchema.safeParse(document);
  assert.equal(result.success, false, 'expected document to fail schema validation');
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

test('published template fixtures satisfy schema and locale parity', () => {
  const published = loadPublishedBundle();

  const es = parseContentDocument(published.es);
  const en = parseContentDocument(published.en);
  parseSiteSettings(published.settings);

  assert.deepEqual(checkLocaleParity(es, en), []);
  assert.doesNotThrow(() => assertLocaleParity(es, en));
});

test('live templates require routable detail-page fields', () => {
  const { es } = loadPublishedBundle();
  const draft = structuredClone(es);
  Object.assign(draft.templates.items[0], {
    slug: 'Modelo Empresarial',
    imageSrc: '',
    detailDescription: '',
  });

  const issues = validationIssuesFor(draft);

  assert.deepEqual(
    issues.filter((issue) => issue.path === 'templates.items.0.slug'),
    [{ path: 'templates.items.0.slug', message: 'Slug must be lowercase kebab-case' }],
  );
  assert.deepEqual(
    issues.filter((issue) => issue.path === 'templates.items.0.imageSrc'),
    [{ path: 'templates.items.0.imageSrc', message: 'Image is required for live templates' }],
  );
  assert.deepEqual(
    issues.filter((issue) => issue.path === 'templates.items.0.detailDescription'),
    [
      {
        path: 'templates.items.0.detailDescription',
        message: 'Detail description is required for live templates',
      },
    ],
  );
});

test('coming-soon templates may omit detail-page routing fields', () => {
  const { es } = loadPublishedBundle();
  const draft = structuredClone(es);
  Object.assign(draft.templates.items[0], {
    slug: '',
    imageSrc: '',
    detailDescription: '',
    features: [],
    comingSoon: true,
  });

  assert.doesNotThrow(() => parseContentDocument(draft));
});

test('template locale parity detects slug and feature-count drift', () => {
  const published = loadPublishedBundle();
  const es = parseContentDocument(published.es);
  const en = parseContentDocument(published.en);
  en.templates.items[0].slug = 'business-model';
  en.templates.items[0].features.push('Extra unmatched feature');

  const issues = checkLocaleParity(es, en);

  assert.deepEqual(
    issues.filter((issue) => issue.path.startsWith('templates.items[0]')),
    [
      {
        path: 'templates.items[0].features',
        message: 'Feature count mismatch: es=4, en=5',
      },
      {
        path: 'templates.items[0].slug',
        message: 'Slug mismatch: es=modelo-empresarial, en=business-model',
      },
    ],
  );
  assert.throws(
    () => assertLocaleParity(es, en),
    /templates\.items\[0\]\.features[\s\S]*templates\.items\[0\]\.slug/,
  );
});
