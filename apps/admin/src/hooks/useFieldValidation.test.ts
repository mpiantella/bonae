import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getLocaleFieldError,
  useFieldValidation,
  type ValidationState,
} from './useFieldValidation.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublished(): {
  es: ContentDocument;
  en: ContentDocument;
  settings: SiteSettings;
} {
  return {
    es: JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')) as ContentDocument,
    en: JSON.parse(readFileSync(path.join(publishedRoot, 'en.json'), 'utf8')) as ContentDocument,
    settings: JSON.parse(
      readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8'),
    ) as SiteSettings,
  };
}

function renderValidation(
  draftEs: ContentDocument | null,
  draftEn: ContentDocument | null,
  draftSettings: SiteSettings | null,
): ValidationState {
  let validation: ValidationState | null = null;

  function Probe() {
    validation = useFieldValidation(draftEs, draftEn, draftSettings);
    return null;
  }

  renderToStaticMarkup(createElement(Probe));
  if (!validation) {
    throw new Error('Validation probe did not render');
  }
  return validation;
}

describe('useFieldValidation', () => {
  it('reports localized hero and settings errors with navigation counts', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const draftEn = structuredClone(published.en);
    const draftSettings = structuredClone(published.settings);

    draftEs.hero.headline = '  ';
    draftEn.hero.headline = 'T'.repeat(91);
    draftEs.contact.email = 'ventas';
    draftSettings.siteUrl = '';

    const validation = renderValidation(draftEs, draftEn, draftSettings);

    expect(validation.errorsEs.hero.headline).toBe('Titular es obligatorio');
    expect(validation.errorsEn.hero.headline).toBe('Titular es demasiado largo (91/90)');
    expect(validation.settingsErrors.email).toBe('Ingresa un email válido');
    expect(validation.settingsErrors.siteUrl).toBe('URL del sitio es obligatorio');
    expect(validation.navErrorCount('hero')).toBe(2);
    expect(validation.navErrorCount('settings')).toBe(2);
    expect(validation.hasGlobalErrors).toBe(true);
  });

  it('keeps nested localized errors addressable for section forms', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const draftEn = structuredClone(published.en);

    draftEs.valueProp.items[0].title = '';
    draftEs.valueProp.items[0].description = 'D'.repeat(181);
    draftEn.about.members[0].role = '';

    const validation = renderValidation(draftEs, draftEn, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'valueProp', 'items', 0, 'title')).toBe(
      'Título de tarjeta es obligatorio',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'valueProp', 'items', 0, 'description')).toBe(
      'Descripción de tarjeta es demasiado largo (181/180)',
    );
    expect(getLocaleFieldError(validation.errorsEn, 'about', 'founders', 0, 'role')).toBe(
      'Rol es obligatorio',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'valueProp', 'items', 99, 'title')).toBeNull();
    expect(validation.navErrorCount('valueProp')).toBe(2);
    expect(validation.navErrorCount('about')).toBe(1);
  });
});
