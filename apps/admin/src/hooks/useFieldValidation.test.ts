import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getLocaleFieldError,
  type ValidationState,
  useFieldValidation,
} from './useFieldValidation.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(publishedRoot, fileName), 'utf8')) as T;
}

function loadPublished(): {
  es: ContentDocument;
  en: ContentDocument;
  settings: SiteSettings;
} {
  return {
    es: readJson<ContentDocument>('es.json'),
    en: readJson<ContentDocument>('en.json'),
    settings: readJson<SiteSettings>('settings.json'),
  };
}

function evaluateValidation(
  draftEs: ContentDocument,
  draftEn: ContentDocument,
  draftSettings: SiteSettings,
): ValidationState {
  let validation: ValidationState | undefined;

  function Probe() {
    validation = useFieldValidation(draftEs, draftEn, draftSettings);
    return null;
  }

  renderToStaticMarkup(React.createElement(Probe));

  if (!validation) {
    throw new Error('Validation probe did not render');
  }

  return validation;
}

describe('useFieldValidation template rules', () => {
  it('flags invalid live template page metadata in the templates nav count', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);

    draftEs.templates.items[0].slug = '';
    draftEs.templates.items[0].detailDescription = '';
    draftEs.templates.items[0].demoUrl = '/modelo-2';
    draftEs.templates.items[0].price = 0;

    const validation = evaluateValidation(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug')).toBe(
      'Slug es obligatorio',
    );
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription'),
    ).toBe('Descripción larga es obligatorio');
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'demoUrl')).toBe(
      'URL página en vivo debe ser http(s)',
    );
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price')).toBe(
      'Precio es obligatorio',
    );
    expect(validation.navErrorCount('templates')).toBe(4);
    expect(validation.hasGlobalErrors).toBe(true);
  });

  it('does not require page-only metadata for coming-soon templates', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);

    draftEs.templates.items[0].comingSoon = true;
    draftEs.templates.items[0].slug = '';
    draftEs.templates.items[0].detailDescription = '';
    draftEs.templates.items[0].demoUrl = '';
    draftEs.templates.items[0].price = 0;

    const validation = evaluateValidation(draftEs, published.en, published.settings);

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug')).toBeNull();
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription'),
    ).toBeNull();
    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'price')).toBeNull();
    expect(validation.navErrorCount('templates')).toBe(0);
    expect(validation.hasGlobalErrors).toBe(false);
  });
});
