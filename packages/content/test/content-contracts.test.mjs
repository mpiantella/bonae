import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  WEEKDAYS,
  asBusinessHours,
  assertLocaleParity,
  businessHoursSchema,
  defaultBusinessHoursDays,
  parseContentDocument,
} from '../dist/index.js';

const publishedDir = fileURLToPath(
  new URL('../../../apps/static/content/published/', import.meta.url),
);

function loadPublished(name) {
  return JSON.parse(readFileSync(join(publishedDir, name), 'utf8'));
}

function loadDocuments() {
  return {
    es: parseContentDocument(loadPublished('es.json')),
    en: parseContentDocument(loadPublished('en.json')),
  };
}

function issuePaths(result) {
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('business hours content contract', () => {
  it('provides one ordered default day for each weekday', () => {
    const days = defaultBusinessHoursDays();

    assert.deepEqual(
      days.map((day) => day.day),
      WEEKDAYS,
    );
    assert.deepEqual(days.at(-1), {
      day: 'sunday',
      closed: true,
      open: '',
      close: '',
    });
  });

  it('rejects open days with missing times', () => {
    const hours = {
      title: 'Business hours',
      days: defaultBusinessHoursDays(),
    };
    hours.days[0] = { ...hours.days[0], close: '   ' };

    const result = businessHoursSchema.safeParse(hours);

    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('days.0.close'));
  });

  it('rejects schedules with weekdays out of order', () => {
    const hours = {
      title: 'Business hours',
      days: defaultBusinessHoursDays(),
    };
    hours.days[1] = { ...hours.days[1], day: 'monday' };

    const result = businessHoursSchema.safeParse(hours);

    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('days.1.day'));
  });

  it('narrows only valid structured schedules', () => {
    const validHours = {
      title: 'Business hours',
      days: defaultBusinessHoursDays(),
    };

    assert.equal(asBusinessHours('Mon-Fri 9am-6pm'), null);
    assert.equal(asBusinessHours({ title: 'Business hours' }), null);
    assert.deepEqual(asBusinessHours(validHours), validHours);
  });
});

describe('template content contract', () => {
  it('allows coming-soon templates to omit live-page fields', () => {
    const { es } = loadDocuments();
    const draft = structuredClone(es);
    draft.templates.items[0] = {
      ...draft.templates.items[0],
      comingSoon: true,
      detailDescription: '',
      imageSrc: '',
      slug: '',
      demoUrl: 'relative-demo',
      price: 0,
      features: [],
    };

    assert.doesNotThrow(() => parseContentDocument(draft));
  });

  it('rejects live templates with non-routable slugs or placeholder prices', () => {
    const { es } = loadDocuments();
    const draft = structuredClone(es);
    draft.templates.items[0] = {
      ...draft.templates.items[0],
      slug: 'Modelo 2',
      price: 0,
    };

    assert.throws(
      () => parseContentDocument(draft),
      (error) =>
        error.issues.some(
          (issue) =>
            issue.path.join('.') === 'templates.items.0.slug' &&
            issue.message === 'Slug must be lowercase kebab-case',
        ) &&
        error.issues.some(
          (issue) =>
            issue.path.join('.') === 'templates.items.0.price' &&
            issue.message === 'Price is required for live templates',
        ),
    );
  });

  it('reports template slug and feature-count locale drift', () => {
    const { es, en } = loadDocuments();
    const draftEn = structuredClone(en);
    draftEn.templates.items[0] = {
      ...draftEn.templates.items[0],
      slug: 'mismatched-template',
      features: draftEn.templates.items[0].features.slice(1),
    };

    assert.throws(
      () => assertLocaleParity(es, draftEn),
      (error) =>
        error.message.includes('templates.items[0].slug') &&
        error.message.includes('templates.items[0].features'),
    );
  });
});
