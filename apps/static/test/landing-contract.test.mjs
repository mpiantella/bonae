import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const staticRoot = fileURLToPath(new URL('..', import.meta.url));

const readStaticFile = (relativePath) =>
  readFileSync(path.join(staticRoot, relativePath), 'utf8');

const readPublished = (locale) =>
  JSON.parse(readStaticFile(`content/published/${locale}.json`));

const extractObjectMap = (source, exportName) => {
  const match = source.match(
    new RegExp(`export const ${exportName}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`),
  );
  assert.ok(match, `expected to find ${exportName} export`);

  return new Map(
    [...match[1].matchAll(/^\s*([A-Za-z0-9_-]+): '([^']+)',?/gm)].map(([, key, value]) => [
      key,
      value,
    ]),
  );
};

describe('static landing page contracts', () => {
  it('submits only the supported contact lead fields', () => {
    const contactSource = readStaticFile('src/components/Contact.astro');
    const formMatch = contactSource.match(/<form\b[\s\S]*?<\/form>/);

    assert.ok(formMatch, 'contact component should render a form');
    assert.match(formMatch[0], /action="\/api\/contact"/);
    assert.match(formMatch[0], /method="POST"/);

    const submittedNames = [...formMatch[0].matchAll(/\bname="([^"]+)"/g)].map(
      ([, name]) => name,
    );

    assert.deepEqual(submittedNames, ['form-name', 'name', 'email', 'phone', 'message']);
    assert.ok(!submittedNames.includes('business'));
    assert.ok(!submittedNames.includes('serviceType'));
  });

  it('keeps the hero video asset and reduced-motion fallback wired', () => {
    const heroSource = readStaticFile('src/components/Hero.astro');

    assert.match(heroSource, /<video[\s\S]*class="hero-bg-video/);
    assert.match(heroSource, /<source src="\/videos\/hero-tech\.mp4" type="video\/mp4" \/>/);
    assert.ok(existsSync(path.join(staticRoot, 'public/videos/hero-tech.mp4')));
    assert.match(heroSource, /prefers-reduced-motion:\s*reduce/);
    assert.match(heroSource, /\.hero-bg-video\s*\{\s*display:\s*none;/);
  });

  it('maps every published value-prop icon to a shipped optimized image', () => {
    const iconsSource = readStaticFile('src/lib/icons.ts');
    const iconSrcByName = extractObjectMap(iconsSource, 'valuePropIconSrc');
    const iconAltByName = extractObjectMap(iconsSource, 'valuePropIconAlt');
    const iconCardSource = readStaticFile('src/components/IconCard.astro');

    assert.match(iconCardSource, /<img[\s\S]*src=\{src\}/);
    assert.match(iconCardSource, /loading="lazy"/);
    assert.match(iconCardSource, /decoding="async"/);

    for (const locale of ['es', 'en']) {
      const published = readPublished(locale);

      for (const item of published.valueProp.items) {
        const src = iconSrcByName.get(item.icon);
        const alt = iconAltByName.get(item.icon);

        assert.ok(src, `${locale} value-prop icon "${item.icon}" should have an image src`);
        assert.match(src, /^\/images\/value-prop\/.+\.png$/);
        assert.ok(
          existsSync(path.join(staticRoot, 'public', src.slice(1))),
          `${src} should be present in public assets`,
        );
        assert.ok(alt?.trim(), `${locale} value-prop icon "${item.icon}" should have alt text`);
      }
    }
  });
});
