import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
    es: JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')),
    en: JSON.parse(readFileSync(path.join(publishedRoot, 'en.json'), 'utf8')),
    settings: JSON.parse(readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8')),
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
  expect(validation).not.toBeNull();
  return validation!;
}

describe('useFieldValidation', () => {
  it('validates editable DatosClave fields and counts them in sidebar errors', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);
    const draftEn = structuredClone(published.en);
    draftEs.keyFigures.years = '   ';
    draftEn.keyFigures.clients = 'x'.repeat(81);

    const validation = renderValidation(draftEs, draftEn, published.settings);

    expect(validation.errorsEs.keyFigures.years).toBe('Years value is required');
    expect(getLocaleFieldError(validation.errorsEn, 'keyFigures', 'clients')).toBe(
      'Clients label is too long (81/80)',
    );
    expect(validation.navErrorCount('keyFigures')).toBe(2);
    expect(validation.hasGlobalErrors).toBe(true);
  });
});
