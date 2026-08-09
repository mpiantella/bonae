import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { contentDocumentSchema } from '../dist/schema.js';
import { assertLocaleParity, checkLocaleParity } from '../dist/validate.js';

const publishedRoot = new URL('../../../apps/static/content/published/', import.meta.url);

function loadPublished(locale) {
  return JSON.parse(readFileSync(new URL(`${locale}.json`, publishedRoot), 'utf8'));
}

function parseIssues(result) {
  assert.equal(result.success, false);
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

describe('template content contract', () => {
  it('allows coming-soon templates to omit live detail fields', () => {
    const doc = loadPublished('es');
    doc.templates.items[0] = {
      ...doc.templates.items[0],
      comingSoon: true,
      slug: '',
      imageSrc: '',
      detailDescription: '',
      features: [],
    };

    assert.equal(contentDocumentSchema.safeParse(doc).success, true);
  });

  it('rejects live templates without routable detail content', () => {
    const doc = loadPublished('es');
    doc.templates.items[0] = {
      ...doc.templates.items[0],
      slug: '',
      imageSrc: '   ',
      detailDescription: '   ',
      comingSoon: false,
    };

    const issues = parseIssues(contentDocumentSchema.safeParse(doc));

    assert.ok(
      issues.some(
        (issue) =>
          issue.path === 'templates.items.0.slug' &&
          issue.message === 'Slug is required for live templates',
      ),
    );
    assert.ok(
      issues.some(
        (issue) =>
          issue.path === 'templates.items.0.imageSrc' &&
          issue.message === 'Image is required for live templates',
      ),
    );
    assert.ok(
      issues.some(
        (issue) =>
          issue.path === 'templates.items.0.detailDescription' &&
          issue.message === 'Detail description is required for live templates',
      ),
    );
  });

  it('requires live template slugs to be lowercase kebab-case', () => {
    const doc = loadPublished('es');
    doc.templates.items[0].slug = 'Modelo Empresarial';

    const issues = parseIssues(contentDocumentSchema.safeParse(doc));

    assert.ok(
      issues.some(
        (issue) =>
          issue.path === 'templates.items.0.slug' &&
          issue.message === 'Slug must be lowercase kebab-case',
      ),
    );
  });

  it('flags locale drift for template detail routes and feature lists', () => {
    const es = loadPublished('es');
    const en = loadPublished('en');
    en.templates.items[0].slug = 'business-model';
    en.templates.items[1].features = en.templates.items[1].features.slice(1);

    const issues = checkLocaleParity(es, en);

    assert.deepEqual(
      issues.map((issue) => issue.path).filter((path) => path.startsWith('templates.items')),
      ['templates.items[0].slug', 'templates.items[1].features'],
    );
    assert.throws(() => assertLocaleParity(es, en), /templates\.items\[0\]\.slug/);
  });
});
