import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { ContentDocument, SiteSettings } from '@bonae/content';
import { describe, expect, it } from 'vitest';
import { useFieldValidation, type ValidationState } from './useFieldValidation.js';

const publishedRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../static/content/published',
);

function loadPublished(): { es: ContentDocument; en: ContentDocument; settings: SiteSettings } {
  return {
    es: JSON.parse(readFileSync(path.join(publishedRoot, 'es.json'), 'utf8')),
    en: JSON.parse(readFileSync(path.join(publishedRoot, 'en.json'), 'utf8')),
    settings: JSON.parse(readFileSync(path.join(publishedRoot, 'settings.json'), 'utf8')),
  };
}

function renderValidation(input: {
  es: ContentDocument;
  en: ContentDocument;
  settings: SiteSettings;
}): ValidationState {
  let validation: ValidationState | null = null;

  function ValidationProbe() {
    validation = useFieldValidation(input.es, input.en, input.settings);
    return null;
  }

  renderToString(createElement(ValidationProbe));

  if (!validation) {
    throw new Error('Validation hook did not render');
  }

  return validation;
}

describe('useFieldValidation', () => {
  it('surfaces live template errors in the template navigation count', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);

    Object.assign(draftEs.templates.items[0], {
      slug: '',
      detailDescription: '',
      demoUrl: 'modelo-2.local',
      price: 0,
      comingSoon: false,
    });

    const validation = renderValidation({
      es: draftEs,
      en: published.en,
      settings: published.settings,
    });
    const templateErrors = validation.errorsEs.templates.items[0];

    expect(templateErrors.slug).toBe('Slug es obligatorio');
    expect(templateErrors.detailDescription).toBe('Descripción larga es obligatorio');
    expect(templateErrors.demoUrl).toBe('URL página en vivo debe ser http(s)');
    expect(templateErrors.price).toBe('Precio es obligatorio');
    expect(validation.navErrorCount('templates')).toBe(4);
    expect(validation.hasGlobalErrors).toBe(true);
  });

  it('does not require live template fields for coming-soon placeholders', () => {
    const published = loadPublished();
    const draftEs = structuredClone(published.es);

    Object.assign(draftEs.templates.items[0], {
      slug: '',
      detailDescription: '',
      demoUrl: '',
      price: 0,
      comingSoon: true,
    });

    const validation = renderValidation({
      es: draftEs,
      en: published.en,
      settings: published.settings,
    });
    const templateErrors = validation.errorsEs.templates.items[0];

    expect(templateErrors.slug).toBeNull();
    expect(templateErrors.detailDescription).toBeNull();
    expect(templateErrors.demoUrl).toBeNull();
    expect(templateErrors.price).toBeNull();
  });
});
