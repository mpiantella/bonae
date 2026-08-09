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

  it('summarizes live template pricing, feature, and demo URL changes', () => {
    const published = loadPublished();
    const draft = structuredClone(published);

    draft.es.templates.priceCurrency = 'US$';
    draft.es.templates.priceNote = 'por lanzamiento';
    draft.es.templates.items[0].features = ['Nueva sección hero', 'Formulario conectado'];
    draft.es.templates.items[0].demoUrl = 'https://modelo-2.example.com/';
    draft.es.templates.items[0].price = 125;

    const review = buildPublishReview({ draft, published });
    const labels = review.changes.map((change) => change.label);

    expect(labels).toContain('ES › Plantillas › Moneda');
    expect(labels).toContain('ES › Plantillas › Nota de precio');
    expect(labels).toContain('ES › Plantillas › Ítem 1 › Detalles técnicos');
    expect(labels).toContain('ES › Plantillas › Ítem 1 › URL página en vivo');
    expect(labels).toContain('ES › Plantillas › Ítem 1 › Precio');
    expect(reviewBlocksPublish(review)).toBe(false);
  });

  it('blocks publishing when a live template has invalid page metadata', () => {
    const published = loadPublished();
    const draft = structuredClone(published);

    draft.es.templates.items[0].slug = 'Modelo 2';
    draft.es.templates.items[0].detailDescription = '';
    draft.es.templates.items[0].demoUrl = '/modelo-2';
    draft.es.templates.items[0].price = 0;

    const review = buildPublishReview({ draft, published });
    const validationText = review.validationErrors.join('\n');

    expect(reviewBlocksPublish(review)).toBe(true);
    expect(validationText).toContain('ES:');
    expect(validationText).toContain('Slug must be lowercase kebab-case');
    expect(validationText).toContain('Detail description is required for live templates');
    expect(validationText).toContain('Price is required for live templates');
    expect(validationText).toContain('Live page URL must be an absolute http(s) URL');
  });
});
