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

  it('blocks publish when a live template is missing its detail page contract', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    Object.assign(draft.es.templates.items[0], {
      slug: '',
      imageSrc: '',
      detailDescription: '',
      demoUrl: '/modelo-2',
      price: 0,
      comingSoon: false,
    });

    const review = buildPublishReview({ draft, published });

    expect(reviewBlocksPublish(review)).toBe(true);
    expect(review.validationErrors.join('\n')).toContain('Slug is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Image is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Detail description is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Price is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Live page URL must be an absolute http(s) URL');
  });

  it('warns when live template slugs or feature counts drift across locales', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.en.templates.items[0].slug = 'different-model';
    draft.en.templates.items[0].features = draft.en.templates.items[0].features.slice(1);

    const review = buildPublishReview({ draft, published });

    expect(reviewBlocksPublish(review)).toBe(false);
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'templates.items[0].slug' }),
        expect.objectContaining({ label: 'templates.items[0].features' }),
      ]),
    );
  });
});
