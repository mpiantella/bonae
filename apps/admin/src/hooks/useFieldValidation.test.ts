import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import { describe, expect, it } from 'vitest';
import { type ValidationState, useFieldValidation } from './useFieldValidation.js';

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

function readValidation(
  es: ContentDocument,
  en: ContentDocument,
  settings: SiteSettings,
): ValidationState {
  let validation: ValidationState | null = null;

  function Probe() {
    validation = useFieldValidation(es, en, settings);
    return null;
  }

  renderToStaticMarkup(createElement(Probe));

  if (!validation) {
    throw new Error('Validation probe did not render');
  }
  return validation;
}

describe('useFieldValidation', () => {
  it('reports invalid legacy hours without breaking settings validation defaults', () => {
    const { es, en, settings } = loadPublished();
    (es as { contact: { hours: unknown } }).contact.hours = 'Lun-Vie 9:00-18:00';
    (en as { contact: { hours: unknown } }).contact.hours = { title: 'Business hours' };

    const validation = readValidation(es, en, settings);

    expect(validation.errorsEs.contact.hoursTitle).toBe('Título del horario es obligatorio');
    expect(validation.errorsEn.contact.hoursTitle).toBe('Título del horario es obligatorio');
    expect(validation.settingsErrors.hours).toBeNull();
    expect(validation.hasGlobalErrors).toBe(true);
    expect(validation.navErrorCount('contact')).toBe(2);
  });
});
