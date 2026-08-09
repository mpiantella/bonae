import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  defaultBusinessHoursDays,
  parseContentDocument,
  type ContentDocument,
} from '@bonae/content';
import {
  applyContactForm,
  readContactForm,
  type ContactFormValues,
} from './contactSectionFormAdapter.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublishedEs(): ContentDocument {
  return parseContentDocument(JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')));
}

function withContactHours(doc: ContentDocument, hours: unknown): ContentDocument {
  const next = structuredClone(doc);
  (next as unknown as { contact: { hours: unknown } }).contact.hours = hours;
  return next;
}

describe('contactSectionFormAdapter', () => {
  it('uses a legacy string hours value as the editable hours title', () => {
    const doc = withContactHours(loadPublishedEs(), 'Lun a Vie 9:00-18:00');

    const form = readContactForm(doc);

    expect(form.hoursTitle).toBe('Lun a Vie 9:00-18:00');
    expect(form.form.serviceOptions).toEqual(
      loadPublishedEs().contact.form.serviceOptions.map((value) => ({ value })),
    );
  });

  it('seeds default weekly days when applying a partial hours object', () => {
    const doc = withContactHours(loadPublishedEs(), { title: 'Horario importado' });
    const formValues = readContactForm(doc);

    const next = applyContactForm(
      {
        ...formValues,
        subtitle: 'Nuevo subtitulo',
      },
      doc,
    );

    expect(next.contact.hours).toEqual({
      title: 'Horario importado',
      days: defaultBusinessHoursDays(),
    });
    expect(next.contact.subtitle).toBe('Nuevo subtitulo');
    expect(parseContentDocument(next).contact.hours.days).toHaveLength(7);
  });

  it('preserves an existing valid weekly schedule while editing contact labels', () => {
    const doc = loadPublishedEs();
    const customDays = structuredClone(doc.contact.hours.days);
    customDays[0] = { ...customDays[0], open: '10:00' };
    const formValues: ContactFormValues = {
      ...readContactForm(withContactHours(doc, { title: 'Horario actual', days: customDays })),
      hoursTitle: 'Horario actualizado',
      form: {
        ...readContactForm(doc).form,
        serviceOptions: [{ value: 'CRM' }, { value: 'SEO' }],
      },
    };

    const next = applyContactForm(
      formValues,
      withContactHours(doc, { title: 'Horario actual', days: customDays }),
    );

    expect(next.contact.hours).toEqual({
      title: 'Horario actualizado',
      days: customDays,
    });
    expect(next.contact.form.serviceOptions).toEqual(['CRM', 'SEO']);
    expect(parseContentDocument(next).contact.hours.days[0].open).toBe('10:00');
  });
});
