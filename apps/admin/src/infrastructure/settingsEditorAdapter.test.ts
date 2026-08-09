import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BusinessHoursDay, ContentDocument, SiteSettings } from '@bonae/content/schema';
import { defaultBusinessHoursDays } from '@bonae/content/schema';
import { applySettingsForm, readSettingsForm, type SettingsFormValues } from './settingsEditorAdapter.js';

type ContentDocumentWithUnknownHours = Omit<ContentDocument, 'contact'> & {
  contact: Omit<ContentDocument['contact'], 'hours'> & { hours: unknown };
};

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublished() {
  return {
    es: JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')) as ContentDocument,
    en: JSON.parse(readFileSync(path.join(publishedRoot, 'en.json'), 'utf8')) as ContentDocument,
    settings: JSON.parse(readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8')) as SiteSettings,
  };
}

describe('settingsEditorAdapter', () => {
  it('falls back to the default weekly schedule when draft hours is legacy data', () => {
    const { es, settings } = loadPublished();
    const draftEs = structuredClone(es) as ContentDocumentWithUnknownHours;
    draftEs.contact.hours = 'Lun-Vie 9:00-18:00';

    const form = readSettingsForm(draftEs as ContentDocument, settings);

    expect(form.hoursDays).toEqual(defaultBusinessHoursDays());
    expect(form.email).toBe(es.contact.email);
    expect(form.siteUrl).toBe(settings.siteUrl);
  });

  it('writes a valid shared schedule while preserving valid locale-specific titles', () => {
    const { es, en, settings } = loadPublished();
    const formValues: SettingsFormValues = {
      siteName: 'BONAE TECH',
      whatsapp: '+58 (424) 679-3082',
      email: 'hola@bonaetech.com',
      address: 'Caracas, Venezuela',
      hoursDays: makeCustomHoursDays(),
      footerText: 'Copyright BONAE',
      siteUrl: 'https://bonaetech.com',
      socialInstagram: 'https://instagram.com/bonaetech',
      socialFacebook: '',
      socialLinkedin: '',
    };
    const draftEs = structuredClone(es) as ContentDocumentWithUnknownHours;
    const draftEn = structuredClone(en);
    draftEs.contact.hours = { title: 'Horario sin días' };

    const result = applySettingsForm(formValues, draftEs as ContentDocument, draftEn, settings);

    expect(result.es.contact.hours).toEqual({
      title: 'Horario de atención',
      days: formValues.hoursDays,
    });
    expect(result.en.contact.hours).toEqual({
      title: en.contact.hours.title,
      days: formValues.hoursDays,
    });
    expect(result.settings.whatsappNumber).toBe('584246793082');
    expect(result.settings.socialLinks.instagram).toBe('https://instagram.com/bonaetech');
  });
});

function makeCustomHoursDays(): BusinessHoursDay[] {
  return defaultBusinessHoursDays().map((day) =>
    day.day === 'sunday' ? day : { ...day, open: '10:00', close: '17:00' },
  );
}
