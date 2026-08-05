import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkLocaleParity,
  contentDocumentSchema,
  parseContentDocument,
} from '../dist/index.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../apps/static/content/published',
);

function loadPublished(locale) {
  return JSON.parse(readFileSync(path.join(publishedRoot, `${locale}.json`), 'utf8'));
}

function issuePaths(result) {
  return result.error.issues.map((issue) => issue.path.join('.'));
}

test('published locale documents satisfy the shared content schema', () => {
  assert.equal(parseContentDocument(loadPublished('es')).lang, 'es');
  assert.equal(parseContentDocument(loadPublished('en')).lang, 'en');
});

test('live templates require publishable route, detail, image, price, and demo URL fields', () => {
  const document = loadPublished('es');
  Object.assign(document.templates.items[0], {
    slug: 'Modelo 1',
    imageSrc: '   ',
    detailDescription: '',
    demoUrl: '/plantillas/modelo-1',
    price: 0,
    comingSoon: false,
  });

  const result = contentDocumentSchema.safeParse(document);

  assert.equal(result.success, false);
  assert.deepEqual(issuePaths(result), [
    'templates.items.0.slug',
    'templates.items.0.imageSrc',
    'templates.items.0.detailDescription',
    'templates.items.0.price',
    'templates.items.0.demoUrl',
  ]);
});

test('coming-soon templates may remain incomplete without blocking content parsing', () => {
  const document = loadPublished('es');
  Object.assign(document.templates.items[0], {
    slug: '',
    imageSrc: '',
    detailDescription: '',
    demoUrl: '',
    price: 0,
    comingSoon: true,
  });

  assert.equal(contentDocumentSchema.safeParse(document).success, true);
});

test('locale parity catches template slug and feature-count drift', () => {
  const es = parseContentDocument(loadPublished('es'));
  const en = parseContentDocument(loadPublished('en'));
  es.templates.items[0].slug = 'plantilla-es';
  en.templates.items[0].slug = 'template-en';
  en.templates.items[0].features = en.templates.items[0].features.slice(1);

  const issues = checkLocaleParity(es, en);

  assert.deepEqual(
    issues
      .filter((issue) => issue.path.startsWith('templates.items[0]'))
      .map((issue) => issue.path)
      .sort(),
    ['templates.items[0].features', 'templates.items[0].slug'],
  );
});
