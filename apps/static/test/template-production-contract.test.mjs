import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const appRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const repoRoot = join(appRoot, '../..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(astro|[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
  });
}

function liveTemplates(doc) {
  return doc.templates.items.filter((item) => !item.comingSoon && item.slug.trim());
}

describe('static template production contracts', () => {
  it('does not ship local debug instrumentation in static source files', () => {
    const blockedPatterns = [
      { name: 'agent log region', pattern: /#region agent log/i },
      { name: 'local ingest endpoint', pattern: /127\.0\.0\.1:7408\/ingest/i },
      { name: 'debug session header', pattern: /X-Debug-Session-Id/i },
      { name: 'debug hypothesis payload', pattern: /hypothesisId/i },
    ];

    const violations = [];
    for (const file of sourceFiles(join(appRoot, 'src'))) {
      const contents = readFileSync(file, 'utf8');
      for (const { name, pattern } of blockedPatterns) {
        if (pattern.test(contents)) {
          violations.push(`${relative(appRoot, file)} contains ${name}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });

  it('keeps published live-template commercial fields routable and customer-safe', () => {
    const es = readJson(join(appRoot, 'content/published/es.json'));
    const en = readJson(join(appRoot, 'content/published/en.json'));
    const esLive = liveTemplates(es);
    const enLive = liveTemplates(en);

    assert.deepEqual(
      esLive.map((item) => item.slug),
      enLive.map((item) => item.slug),
      'ES and EN live-template slugs must stay aligned for localized routes',
    );

    const issues = [];
    for (const [locale, items] of [
      ['es', esLive],
      ['en', enLive],
    ]) {
      for (const item of items) {
        if (!Number.isInteger(item.price) || item.price <= 0) {
          issues.push(`${locale}:${item.slug} must have a positive integer price`);
        }
        if (!/^https?:\/\/.+/i.test(item.demoUrl.trim())) {
          issues.push(`${locale}:${item.slug} must use an absolute http(s) live page URL`);
        }
        if (!item.imageSrc.startsWith('/images/templates/')) {
          issues.push(`${locale}:${item.slug} must use a template image path`);
        }
        if (!existsSync(join(appRoot, 'public', item.imageSrc))) {
          issues.push(`${locale}:${item.slug} image does not exist at ${item.imageSrc}`);
        }
      }
    }

    assert.deepEqual(issues, []);
    assert.ok(existsSync(join(repoRoot, 'apps/static/src/pages/plantillas/[slug].astro')));
    assert.ok(existsSync(join(repoRoot, 'apps/static/src/pages/en/templates/[slug].astro')));
  });
});
