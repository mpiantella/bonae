import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
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

function validate(
  draftEs: ContentDocument | null,
  draftEn: ContentDocument | null,
  draftSettings: SiteSettings | null,
): ValidationState {
  let captured: ValidationState | null = null;

  function Probe(): React.ReactElement {
    captured = useFieldValidation(draftEs, draftEn, draftSettings);
    return React.createElement('div');
  }

  renderToStaticMarkup(React.createElement(Probe));

  if (!captured) {
    throw new Error('Validation hook did not render');
  }
  return captured;
}

describe('useFieldValidation', () => {
  it('reports template field errors and includes them in the template nav count', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const draftEn = structuredClone(published.en);

    draftEs.templates.title = '';
    draftEs.templates.items[1].description = 'x'.repeat(221);
    draftEn.templates.items[0].category = '';

    const validation = validate(draftEs, draftEn, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'title')).toBe(
      'Título de sección es obligatorio',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 1, 'description')).toBe(
      'Descripción es demasiado largo (221/220)',
    );
    expect(getLocaleFieldError(validation.errorsEn, 'templates', 'items', 0, 'category')).toBe(
      'Categoría es obligatorio',
    );
    expect(validation.navErrorCount('templates')).toBe(3);
    expect(validation.navErrorCount('plans')).toBe(0);
    expect(validation.hasGlobalErrors).toBe(true);
  });
});
