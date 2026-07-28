import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentDocument, SiteSettings } from '@bonae/content';
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
    settings: JSON.parse(readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8')) as SiteSettings,
  };
}

function renderValidation(
  es: ContentDocument,
  en: ContentDocument,
  settings: SiteSettings,
): ValidationState {
  let state: ValidationState | null = null;

  function Probe() {
    state = useFieldValidation(es, en, settings);
    return null;
  }

  renderToString(createElement(Probe));
  if (!state) {
    throw new Error('Validation probe did not render');
  }
  return state;
}

describe('useFieldValidation template rules', () => {
  it('flags missing live-template detail-page fields in editor navigation', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const liveTemplate = draftEs.templates.items[0];
    liveTemplate.slug = '';
    liveTemplate.detailDescription = '';
    liveTemplate.demoUrl = 'modelo-2.local';
    liveTemplate.price = 0;

    const validation = renderValidation(draftEs, published.en, published.settings);

    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug'),
    ).toBe('Slug es obligatorio');
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription'),
    ).toBe('Descripción larga es obligatorio');
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'demoUrl'),
    ).toBe('URL página en vivo debe ser http(s)');
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price'),
    ).toBe('Precio es obligatorio');
    expect(validation.navErrorCount('templates')).toBeGreaterThanOrEqual(4);
    expect(validation.hasGlobalErrors).toBe(true);
  });

  it('does not require slug, detail copy, or price for coming-soon placeholders', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const placeholder = draftEs.templates.items[0];
    placeholder.comingSoon = true;
    placeholder.slug = '';
    placeholder.detailDescription = '';
    placeholder.demoUrl = '';
    placeholder.price = 0;

    const validation = renderValidation(draftEs, published.en, published.settings);

    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug'),
    ).toBeNull();
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription'),
    ).toBeNull();
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price'),
    ).toBeNull();
  });
});
