import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
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

function validateFields(
  draftEs: ContentDocument,
  draftEn: ContentDocument,
  draftSettings: SiteSettings,
): ValidationState {
  let captured: ValidationState | null = null;

  function Probe() {
    captured = useFieldValidation(draftEs, draftEn, draftSettings);
    return null;
  }

  renderToStaticMarkup(createElement(Probe));

  if (!captured) {
    throw new Error('Validation state was not captured');
  }
  return captured;
}

describe('useFieldValidation template validation', () => {
  it('requires slugs and long descriptions for live template detail pages', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);

    draftEs.templates.items[0].slug = '';
    draftEs.templates.items[0].detailDescription = '';

    const state = validateFields(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', 0, 'slug')).toBe('Slug es obligatorio');
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', 0, 'detailDescription')).toBe(
      'Descripción larga es obligatorio',
    );
    expect(state.navErrorCount('templates')).toBe(2);
    expect(state.hasGlobalErrors).toBe(true);
  });

  it('allows coming-soon template placeholders without detail page fields', () => {
    const published = loadPublished();
    const comingSoonIndex = published.es.templates.items.findIndex((item) => item.comingSoon);

    const state = validateFields(published.es, published.en, published.settings);

    expect(comingSoonIndex).toBeGreaterThanOrEqual(0);
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', comingSoonIndex, 'slug')).toBeNull();
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', comingSoonIndex, 'detailDescription')).toBeNull();
    expect(state.navErrorCount('templates')).toBe(0);
  });
});
