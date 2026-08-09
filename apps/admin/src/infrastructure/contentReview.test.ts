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

  it('summarizes template detail label and feature changes before publish', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.es.templates.backLabel = '← Volver al catálogo';
    draft.en.templates.useTemplateLabel = 'Start from this template';
    draft.es.templates.items[0].features = [
      'Integración con WhatsApp incluida',
      ...draft.es.templates.items[0].features.slice(1),
    ];
    draft.en.templates.items[1].features = draft.en.templates.items[1].features.slice(1);

    const review = buildPublishReview({ draft, published });

    expect(review.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'es',
          label: 'ES › Plantillas › Volver',
          kind: 'changed',
          after: '← Volver al catálogo',
        }),
        expect.objectContaining({
          locale: 'en',
          label: 'EN › Plantillas › Usar plantilla',
          kind: 'changed',
          after: 'Start from this template',
        }),
        expect.objectContaining({
          locale: 'es',
          label: 'ES › Plantillas › Ítem 1 › Características',
          kind: 'changed',
          after: expect.stringContaining('Integración con WhatsApp incluida'),
        }),
      ]),
    );
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'templates.items[1].features',
          message: 'Feature count mismatch: es=4, en=3',
        }),
      ]),
    );
  });

  it('blocks publishing live templates that cannot render a detail page', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.es.templates.items[0].slug = '';
    draft.es.templates.items[0].imageSrc = '';
    draft.es.templates.items[0].detailDescription = '';

    const review = buildPublishReview({ draft, published });

    expect(reviewBlocksPublish(review)).toBe(true);
    expect(review.validationErrors.join('\n')).toContain('Slug is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Image is required for live templates');
    expect(review.validationErrors.join('\n')).toContain('Detail description is required for live templates');
  });
});
