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

  it('reports template item removals and locale parity warnings without blocking publish', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.es.templates.items = draft.es.templates.items.slice(0, 2);

    const review = buildPublishReview({ draft, published });

    expect(review.validationErrors).toEqual([]);
    expect(reviewBlocksPublish(review)).toBe(false);
    expect(review.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'es',
          label: 'ES › Plantillas › Ítem 3',
          kind: 'removed',
          before: 'Más plantillas próximamente',
        }),
      ]),
    );
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'templates.items',
          message: 'Array length mismatch for templates.items: es=2, en=3',
        }),
      ]),
    );
  });

  it('warns when Spanish template section copy changes without an English update', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.es.templates.title = 'Plantillas digitales para lanzar más rápido';

    const review = buildPublishReview({ draft, published });

    expect(review.validationErrors).toEqual([]);
    expect(review.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'es',
          label: 'ES › Plantillas › Título',
          kind: 'changed',
        }),
      ]),
    );
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'ES › Plantillas › Título',
          message: 'Falta traducción EN',
        }),
      ]),
    );
  });

  it('warns when Spanish template card copy changes without an English update', () => {
    const published = loadPublished();
    const draft = structuredClone(published);
    draft.es.templates.items[0].description = 'Landing editable para validar una nueva oferta digital.';

    const review = buildPublishReview({ draft, published });

    expect(review.validationErrors).toEqual([]);
    expect(review.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'es',
          label: 'ES › Plantillas › Ítem 1 › Descripción',
          kind: 'changed',
        }),
      ]),
    );
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'ES › Plantillas › Ítem 1 › Descripción',
          message: 'Falta traducción EN',
        }),
      ]),
    );
  });
});
