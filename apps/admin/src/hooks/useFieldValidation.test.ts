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

function readPublishedJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(publishedRoot, fileName), 'utf8')) as T;
}

function loadPublished() {
  return {
    es: readPublishedJson<ContentDocument>('es.json'),
    en: readPublishedJson<ContentDocument>('en.json'),
    settings: readPublishedJson<SiteSettings>('settings.json'),
  };
}

function ValidationProbe(props: {
  es: ContentDocument;
  en: ContentDocument;
  settings: SiteSettings;
  onValidation: (validation: ValidationState) => void;
}) {
  props.onValidation(useFieldValidation(props.es, props.en, props.settings));
  return null;
}

function validateFields(input: {
  es: ContentDocument;
  en: ContentDocument;
  settings: SiteSettings;
}): ValidationState {
  let validation: ValidationState | null = null;
  renderToStaticMarkup(
    createElement(ValidationProbe, {
      ...input,
      onValidation: (nextValidation) => {
        validation = nextValidation;
      },
    }),
  );
  if (!validation) {
    throw new Error('Validation probe did not render');
  }
  return validation;
}

describe('useFieldValidation', () => {
  it('requires slug and detail copy for live templates', () => {
    const published = loadPublished();
    const es = structuredClone(published.es);
    es.templates.items[0].slug = ' ';
    es.templates.items[0].detailDescription = '';

    const validation = validateFields({ ...published, es });

    expect(getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'slug')).toBe(
      'Slug es obligatorio',
    );
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', 0, 'detailDescription'),
    ).toBe('Descripción larga es obligatorio');
    expect(validation.navErrorCount('templates')).toBe(2);
    expect(validation.hasGlobalErrors).toBe(true);
  });

  it('allows coming-soon templates to omit detail page fields', () => {
    const published = loadPublished();
    const validation = validateFields(published);
    const comingSoonIndex = published.es.templates.items.findIndex((item) => item.comingSoon);

    expect(comingSoonIndex).toBeGreaterThanOrEqual(0);
    expect(
      getLocaleFieldError(validation.errorsEs, 'templates', 'items', comingSoonIndex, 'slug'),
    ).toBeNull();
    expect(
      getLocaleFieldError(
        validation.errorsEs,
        'templates',
        'items',
        comingSoonIndex,
        'detailDescription',
      ),
    ).toBeNull();
  });
});
