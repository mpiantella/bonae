import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentDocument, SiteSettings } from '@bonae/content';
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
  draftEs: ContentDocument,
  draftEn: ContentDocument,
  draftSettings: SiteSettings,
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

describe('useFieldValidation template rules', () => {
  it('reports live template errors for missing route details, pricing, and absolute demo URLs', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    Object.assign(draftEs.templates.items[0], {
      slug: '',
      detailDescription: '',
      demoUrl: '/modelo-2',
      price: 0,
      comingSoon: false,
    });

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
    expect(validation.navErrorCount('templates')).toBeGreaterThanOrEqual(4);
  });

  it('does not require detail-page-only fields for coming-soon template placeholders', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    Object.assign(draftEs.templates.items[0], {
      slug: '',
      detailDescription: '',
      demoUrl: '',
      price: 0,
      comingSoon: true,
    });

    const validation = renderValidation(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug')).toBeNull();
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription')).toBeNull();
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price')).toBeNull();
  });
});
