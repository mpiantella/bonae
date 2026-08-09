import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import { getLocaleFieldError, type ValidationState, useFieldValidation } from './useFieldValidation.js';

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

function validate(
  draftEs: ContentDocument,
  draftEn: ContentDocument,
  draftSettings: SiteSettings,
): ValidationState {
  let state: ValidationState | null = null;

  function Probe() {
    state = useFieldValidation(draftEs, draftEn, draftSettings);
    return React.createElement('div');
  }

  renderToString(React.createElement(Probe));
  if (!state) {
    throw new Error('Validation probe did not render');
  }
  return state;
}

describe('useFieldValidation template details', () => {
  it('requires slugs and detail copy for live templates only', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    draftEs.templates.items[0].slug = '';
    draftEs.templates.items[0].detailDescription = '';
    draftEs.templates.items[2].slug = '';
    draftEs.templates.items[2].detailDescription = '';

    const state = validate(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', 0, 'slug')).toBe(
      'Slug es obligatorio',
    );
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', 0, 'detailDescription')).toBe(
      'Descripción larga es obligatorio',
    );
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', 2, 'slug')).toBeNull();
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'items', 2, 'detailDescription')).toBeNull();
    expect(state.navErrorCount('templates')).toBe(2);
  });

  it('validates template detail UI labels and modal copy', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    draftEs.templates.backLabel = '';
    draftEs.templates.desktopTabLabel = '';
    draftEs.templates.comingSoonModalBody = 'x'.repeat(281);

    const state = validate(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(state.errorsEs, 'templates', 'backLabel')).toBe('Volver es obligatorio');
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'desktopTabLabel')).toBe(
      'Pestaña escritorio es obligatorio',
    );
    expect(getLocaleFieldError(state.errorsEs, 'templates', 'comingSoonModalBody')).toBe(
      'Modal próximamente es demasiado largo (281/280)',
    );
    expect(state.navErrorCount('templates')).toBe(3);
  });
});
