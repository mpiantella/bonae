import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPublishReview, reviewBlocksPublish } from './contentReview.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublished() {
  return {
    es: JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')),
    en: JSON.parse(readFileSync(path.join(publishedRoot, 'en.json'), 'utf8')),
    settings: JSON.parse(readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8')),
  };
}

describe('buildPublishReview', () => {
  it('returns validation errors without throwing when a draft exceeds schema limits', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.es.valueProp.items[3].description =
      'Deja atrás los procesos manuales y obsoletos. Diagnosticamos tu negocio para eliminar tareas repetitivas, automatizar tu operación diaria y adaptar tu empresa al reto de reducir errores.';

    const review = buildPublishReview({ draft, published });

    expect(review.validationErrors.length).toBeGreaterThan(0);
    expect(review.validationErrors.some((e) => e.startsWith('ES:'))).toBe(true);
    expect(reviewBlocksPublish(review)).toBe(true);
  });

  it('blocks publishing a live template that is missing required detail metadata', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    const item = draft.es.templates.items[0];
    item.slug = '';
    item.imageSrc = '';
    item.detailDescription = '';
    item.price = 0;
    item.demoUrl = '/relative-demo';
    item.comingSoon = false;

    const review = buildPublishReview({ draft, published });

    expect(reviewBlocksPublish(review)).toBe(true);
    expect(review.validationErrors.join('\n')).toContain('Slug is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Image is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Detail description is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Price is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Live page URL must be an absolute http(s) URL');
  });

  it('allows coming-soon template placeholders to omit live-template detail metadata', () => {
    const published = loadPublished();
    const draft = structuredClone(published);

    for (const locale of ['es', 'en'] as const) {
      const item = draft[locale].templates.items[0];
      item.slug = '';
      item.imageSrc = '';
      item.detailDescription = '';
      item.demoUrl = '';
      item.price = 0;
      item.features = [];
      item.comingSoon = true;
    }

    const review = buildPublishReview({ draft, published });

    expect(review.validationErrors).toEqual([]);
    expect(reviewBlocksPublish(review)).toBe(false);
  });

  it('warns when localized live-template slugs or feature counts drift out of parity', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.en.templates.items[0].slug = 'modelo-2-en';
    draft.es.templates.items[0].features.push('Soporte de lanzamiento');

    const review = buildPublishReview({ draft, published });

    expect(review.validationErrors).toEqual([]);
    expect(reviewBlocksPublish(review)).toBe(false);
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'templates.items[0].features',
          message: 'Feature count mismatch: es=6, en=5',
        }),
        expect.objectContaining({
          label: 'templates.items[0].slug',
          message: 'Slug mismatch: es=modelo-2, en=modelo-2-en',
        }),
      ]),
    );
  });

  it('does not throw when published hours is a legacy string out of sync with draft schedule', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    (published.en as { contact: { hours: unknown } }).contact.hours = 'Mon–Fri 9am–6pm';
    (published.es as { contact: { hours: unknown } }).contact.hours = 'Lun–Vie 9:00–18:00';

    draft.es.contact.hours.days[0].open = '10:00';

    expect(() => buildPublishReview({ draft, published })).not.toThrow();
    const review = buildPublishReview({ draft, published });

    expect(review.changes.some((c) => c.label.includes('Horario'))).toBe(true);
    expect(reviewBlocksPublish(review)).toBe(false);
  });

  it('does not throw when published hours.days is missing', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    (published.en as { contact: { hours: unknown } }).contact.hours = { title: 'Business hours' };
    (published.es as { contact: { hours: unknown } }).contact.hours = { title: 'Horario' };

    expect(() => buildPublishReview({ draft, published })).not.toThrow();
    const review = buildPublishReview({ draft, published });
    expect(review.changes.some((c) => c.label.includes('Horario'))).toBe(true);
  });
});
