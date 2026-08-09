import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLocaleParity,
  contentDocumentSchema,
  loadPublishedFromDir,
  parseContentDocument,
} from '../dist/index.js';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const publishedRoot = path.join(repoRoot, 'apps/static/content/published');

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(publishedRoot, fileName), 'utf8'));
}

function loadPublishedFixture() {
  return {
    es: readJson('es.json'),
    en: readJson('en.json'),
  };
}

test('published template content validates the same contract used by static builds', () => {
  assert.doesNotThrow(() => {
    loadPublishedFromDir(path.join(repoRoot, 'apps/static/content'));
  });
});

test('live templates require route-safe slugs and detail-page copy/assets', () => {
  const { es } = loadPublishedFixture();
  const draft = structuredClone(es);
  const liveTemplate = draft.templates.items.find((item) => !item.comingSoon);

  assert.ok(liveTemplate, 'fixture should include at least one live template');
  liveTemplate.slug = 'Modelo Empresarial';
  liveTemplate.imageSrc = ' ';
  liveTemplate.detailDescription = '';

  const result = contentDocumentSchema.safeParse(draft);

  assert.equal(result.success, false);
  assert.match(result.error.message, /Slug must be lowercase kebab-case/);
  assert.match(result.error.message, /Image is required for live templates/);
  assert.match(result.error.message, /Detail description is required for live templates/);
});

test('coming-soon templates may remain unroutable placeholders', () => {
  const { es } = loadPublishedFixture();
  const draft = structuredClone(es);
  const comingSoonTemplate = draft.templates.items.find((item) => item.comingSoon);

  assert.ok(comingSoonTemplate, 'fixture should include a coming-soon placeholder');
  comingSoonTemplate.slug = '';
  comingSoonTemplate.imageSrc = '';
  comingSoonTemplate.mobileImageSrc = '';
  comingSoonTemplate.detailDescription = '';
  comingSoonTemplate.features = [];

  assert.doesNotThrow(() => parseContentDocument(draft));
});

test('locale parity catches template route and feature drift between ES and EN', () => {
  const { es, en } = loadPublishedFixture();
  const draftEn = structuredClone(en);

  draftEn.templates.items[0].slug = 'different-template-slug';
  draftEn.templates.items[0].features.push('An untranslated extra feature');

  assert.deepEqual(checkLocaleParity(es, draftEn), [
    {
      path: 'templates.items[0].features',
      message: 'Feature count mismatch: es=4, en=5',
    },
    {
      path: 'templates.items[0].slug',
      message: 'Slug mismatch: es=modelo-empresarial, en=different-template-slug',
    },
  ]);
});
