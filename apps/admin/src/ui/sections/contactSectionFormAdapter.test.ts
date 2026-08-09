import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentDocument } from '@bonae/content';
import { defaultBusinessHoursDays } from '@bonae/content/schema';
import { describe, expect, it } from 'vitest';
import { applyContactForm, readContactForm } from './contactSectionFormAdapter.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../static/content/published',
);

function loadPublishedEs(): ContentDocument {
  return JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')) as ContentDocument;
}

function withDraftHours(doc: ContentDocument, hours: unknown): ContentDocument {
  const next = structuredClone(doc);
  (next as { contact: { hours: unknown } }).contact.hours = hours;
  return next;
}

describe('contact section form adapter', () => {
  it('uses a legacy string hours value as the editable hours title', () => {
    const doc = loadPublishedEs();
    const legacyDoc = withDraftHours(doc, 'Lun-Vie 9:00-18:00');

    const values = readContactForm(legacyDoc);

    expect(values.hoursTitle).toBe('Lun-Vie 9:00-18:00');
    expect(values.form.serviceOptions).toEqual(
      doc.contact.form.serviceOptions.map((value) => ({ value })),
    );
  });

  it('preserves an existing weekly schedule when contact labels change', () => {
    const doc = loadPublishedEs();
    const customDoc = structuredClone(doc);
    customDoc.contact.hours.days[0] = {
      ...customDoc.contact.hours.days[0],
      open: '10:00',
      close: '19:00',
    };
    const values = readContactForm(customDoc);
    values.hoursTitle = 'Horario especial';
    values.form.serviceOptions = [{ value: 'Sitio web' }, { value: 'CRM' }];

    const next = applyContactForm(values, customDoc);

    expect(next.contact.hours.title).toBe('Horario especial');
    expect(next.contact.hours.days).toEqual(customDoc.contact.hours.days);
    expect(next.contact.form.serviceOptions).toEqual(['Sitio web', 'CRM']);
  });

  it('repairs partial hours objects with the default weekly schedule', () => {
    const doc = loadPublishedEs();
    const partialDoc = withDraftHours(doc, { title: 'Business hours' });
    const values = readContactForm(partialDoc);

    const next = applyContactForm(values, partialDoc);

    expect(values.hoursTitle).toBe('Business hours');
    expect(next.contact.hours).toEqual({
      title: 'Business hours',
      days: defaultBusinessHoursDays(),
    });
  });
});
