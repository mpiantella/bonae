import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import { describe, expect, it } from 'vitest';
import { getLocaleFieldError, useFieldValidation, type ValidationState } from './useFieldValidation.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublished(): { es: ContentDocument; en: ContentDocument; settings: SiteSettings } {
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
  let validation: ValidationState | null = null;

  function Probe() {
    validation = useFieldValidation(es, en, settings);
    return null;
  }

  renderToStaticMarkup(React.createElement(Probe));

  if (!validation) {
    throw new Error('Validation probe did not render');
  }
  return validation;
}

describe('useFieldValidation', () => {
  it('flags live-template detail errors before publish', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const liveItem = draftEs.templates.items[0];
    liveItem.slug = '';
    liveItem.detailDescription = '';
    liveItem.demoUrl = '/relative-demo';
    liveItem.price = 0;
    liveItem.comingSoon = false;

    const validation = renderValidation(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug')).toBe(
      'Slug es obligatorio',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription')).toBe(
      'Descripción larga es obligatorio',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'demoUrl')).toBe(
      'URL página en vivo debe ser http(s)',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price')).toBe(
      'Precio es obligatorio',
    );
    expect(validation.navErrorCount('templates')).toBe(4);
    expect(validation.hasGlobalErrors).toBe(true);
  });

  it('does not require slug, detail copy, or price for coming-soon templates', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const placeholder = draftEs.templates.items[0];
    placeholder.slug = '';
    placeholder.detailDescription = '';
    placeholder.demoUrl = '';
    placeholder.price = 0;
    placeholder.comingSoon = true;

    const validation = renderValidation(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug')).toBeNull();
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription')).toBeNull();
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'demoUrl')).toBeNull();
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price')).toBeNull();
    expect(validation.navErrorCount('templates')).toBe(0);
    expect(validation.hasGlobalErrors).toBe(false);
  });
});
