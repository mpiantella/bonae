import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const staticRoot = new URL('../', import.meta.url);
const repoRoot = new URL('../../../', import.meta.url);

async function readText(path) {
  return readFile(new URL(path, repoRoot), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

function parseStringArrayExport(source, exportName) {
  const match = source.match(new RegExp(`export const ${exportName} = \\[(?<body>[\\s\\S]*?)\\] as const;`));
  assert.ok(match?.groups?.body, `Expected ${exportName} array export`);
  return [...match.groups.body.matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function parseStringMapExport(source, exportName) {
  const match = source.match(new RegExp(`export const ${exportName}: Record<string, string> = \\{(?<body>[\\s\\S]*?)\\};`));
  assert.ok(match?.groups?.body, `Expected ${exportName} string map export`);

  return Object.fromEntries(
    [...match.groups.body.matchAll(/\s([A-Za-z0-9_]+): '([^']+)'/g)].map((entry) => [entry[1], entry[2]]),
  );
}

function assertSameMembers(actual, expected, message) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}

test('all allowed value-prop icons resolve to tracked public image assets', async () => {
  const contentIconsSource = await readText('packages/content/src/icons.ts');
  const staticIconsSource = await readText('apps/static/src/lib/icons.ts');

  const allowedIcons = parseStringArrayExport(contentIconsSource, 'valuePropIcons');
  const iconSrc = parseStringMapExport(staticIconsSource, 'valuePropIconSrc');
  const iconAlt = parseStringMapExport(staticIconsSource, 'valuePropIconAlt');

  assertSameMembers(Object.keys(iconSrc), allowedIcons, 'valuePropIconSrc must cover every schema-allowed icon');
  assertSameMembers(Object.keys(iconAlt), allowedIcons, 'valuePropIconAlt must cover every schema-allowed icon');

  for (const icon of allowedIcons) {
    const src = iconSrc[icon];
    assert.match(src, /^\/images\/value-prop\/[a-z0-9-]+\.png$/, `${icon} should point at a value-prop png`);
    assert.ok(iconAlt[icon].trim(), `${icon} should have a non-empty image alt label`);

    const asset = await stat(new URL(`public${src}`, staticRoot));
    assert.ok(asset.isFile(), `${src} should be a file`);
    assert.ok(asset.size > 0, `${src} should not be empty`);
  }
});

test('published value-prop content only uses icon keys with rendered images', async () => {
  const staticIconsSource = await readText('apps/static/src/lib/icons.ts');
  const iconSrc = parseStringMapExport(staticIconsSource, 'valuePropIconSrc');

  const publishedLocales = await Promise.all([
    readJson('apps/static/content/published/es.json'),
    readJson('apps/static/content/published/en.json'),
  ]);

  for (const locale of publishedLocales) {
    for (const item of locale.valueProp.items) {
      assert.ok(iconSrc[item.icon], `${locale.lang} value-prop item "${item.title}" should have an image mapping`);
    }
  }
});

test('hero component references the checked-in public video asset', async () => {
  const heroSource = await readText('apps/static/src/components/Hero.astro');
  const sourceMatch = heroSource.match(/<source\s+src="(?<src>\/videos\/[^"]+\.mp4)"\s+type="video\/mp4"\s*\/>/);

  assert.ok(sourceMatch?.groups?.src, 'Hero should render an mp4 source path');

  const asset = await stat(new URL(`public${sourceMatch.groups.src}`, staticRoot));
  assert.ok(asset.isFile(), `${sourceMatch.groups.src} should be a file`);
  assert.ok(asset.size > 0, `${sourceMatch.groups.src} should not be empty`);
});
