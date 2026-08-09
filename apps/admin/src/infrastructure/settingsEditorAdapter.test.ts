import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import { defaultBusinessHoursDays } from '@bonae/content/schema';
import { describe, expect, it } from 'vitest';
import { applySettingsForm, readSettingsForm } from './settingsEditorAdapter.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublished(): { es: ContentDocument; en: ContentDocument; settings: SiteSettings } {
  return {
    es: JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')),
    en: JSON.parse(readFileSync(path.join(publishedRoot, 'en.json'), 'utf8')),
    settings: JSON.parse(readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8')),
  };
}

describe('readSettingsForm', () => {
  it('falls back to a complete default schedule when draft hours are legacy text', () => {
    const { es, settings } = loadPublished();
    (es as { contact: { hours: unknown } }).contact.hours = 'Lun-Vie 9:00-18:00';

    const form = readSettingsForm(es, settings);

    expect(form.hoursDays).toEqual(defaultBusinessHoursDays());
    expect(form.siteName).toBe(es.siteName);
    expect(form.email).toBe(es.contact.email);
    expect(form.whatsapp).toBe(settings.whatsappNumber);
  });

  it('does not reuse fallback schedule instances across reads', () => {
    const { es, settings } = loadPublished();
    (es as { contact: { hours: unknown } }).contact.hours = { title: 'Horario' };

    const first = readSettingsForm(es, settings);
    first.hoursDays[0].open = '00:00';
    const second = readSettingsForm(es, settings);

    expect(second.hoursDays).toEqual(defaultBusinessHoursDays());
  });
});

describe('applySettingsForm', () => {
  it('preserves locale-specific hour titles while applying the shared weekly schedule', () => {
    const { es, en, settings } = loadPublished();
    const hoursDays = defaultBusinessHoursDays().map((day) =>
      day.day === 'monday' ? { ...day, open: '10:00', close: '17:00' } : day,
    );

    const result = applySettingsForm(
      {
        siteName: 'BONAE LABS',
        whatsapp: '+58 (424) 679-3082',
        email: 'hello@bonaetech.com',
        address: 'Caracas, Venezuela',
        hoursDays,
        footerText: '2026 BONAE',
        siteUrl: 'https://example.com',
        socialInstagram: 'https://instagram.com/bonae',
        socialFacebook: '',
        socialLinkedin: 'https://linkedin.com/company/bonae',
      },
      es,
      en,
      settings,
    );

    expect(result.es.contact.hours.title).toBe('Horario de atención');
    expect(result.en.contact.hours.title).toBe('Business hours');
    expect(result.es.contact.hours.days).toEqual(hoursDays);
    expect(result.en.contact.hours.days).toEqual(hoursDays);
    expect(result.es.contact.email).toBe('hello@bonaetech.com');
    expect(result.en.contact.locationNote).toBe('Caracas, Venezuela');
    expect(result.settings.whatsappNumber).toBe('584246793082');
    expect(result.settings.siteUrl).toBe('https://example.com');
    expect(result.settings.socialLinks.linkedin).toBe('https://linkedin.com/company/bonae');
  });
});
