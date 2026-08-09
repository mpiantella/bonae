import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const staticRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(staticRoot, '../..');

const readText = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

const parseStringArrayConst = (source, name) => {
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*\\[(?<body>[\\s\\S]*?)\\]\\s+as const;`));
  assert.ok(match?.groups?.body, `Could not find ${name} const array`);

  return [...match.groups.body.matchAll(/'([^']+)'/g)].map(([, value]) => value);
};

const parseStringRecord = (source, name) => {
  const match = source.match(new RegExp(`export const ${name}: Record<string, string>\\s*=\\s*\\{(?<body>[\\s\\S]*?)\\};`));
  assert.ok(match?.groups?.body, `Could not find ${name} string record`);

  return Object.fromEntries(
    [...match.groups.body.matchAll(/^\s*([a-zA-Z0-9_-]+):\s*'([^']+)'/gm)].map(([, key, value]) => [key, value]),
  );
};

test('custom value-prop media covers every content icon', async () => {
  const [contentIconsSource, staticIconsSource] = await Promise.all([
    readText('packages/content/src/icons.ts'),
    readText('apps/static/src/lib/icons.ts'),
  ]);

  const contentIcons = parseStringArrayConst(contentIconsSource, 'valuePropIcons');
  const iconSrc = parseStringRecord(staticIconsSource, 'valuePropIconSrc');
  const iconAlt = parseStringRecord(staticIconsSource, 'valuePropIconAlt');

  assert.deepEqual(Object.keys(iconSrc).sort(), [...contentIcons].sort());
  assert.deepEqual(Object.keys(iconAlt).sort(), [...contentIcons].sort());

  for (const icon of contentIcons) {
    assert.match(iconSrc[icon], /^\/images\/value-prop\/[a-z0-9-]+\.png$/, `${icon} should use a public PNG asset`);
    assert.ok(iconAlt[icon].trim(), `${icon} should expose non-empty alt text`);

    const assetPath = path.join(staticRoot, 'public', iconSrc[icon].slice(1));
    assert.ok(existsSync(assetPath), `${icon} asset should exist at ${iconSrc[icon]}`);
    assert.ok(statSync(assetPath).size > 0, `${icon} asset should not be empty`);
  }
});

test('IconCard consumes the tested value-prop image metadata', async () => {
  const iconCardSource = await readText('apps/static/src/components/IconCard.astro');

  assert.match(iconCardSource, /import \{ valuePropIconSrc, valuePropIconAlt \} from '\.\.\/lib\/icons';/);
  assert.match(iconCardSource, /const src = valuePropIconSrc\[icon\];/);
  assert.match(iconCardSource, /const alt = valuePropIconAlt\[icon\] \?\? title;/);
  assert.match(iconCardSource, /src=\{src\}/);
  assert.match(iconCardSource, /alt=\{alt\}/);
  assert.match(iconCardSource, /loading="lazy"/);
  assert.match(iconCardSource, /decoding="async"/);
});

test('hero background video points at shipped media and respects reduced motion', async () => {
  const heroSource = await readText('apps/static/src/components/Hero.astro');
  const videoSource = heroSource.match(/<source src="(?<src>\/videos\/[^"]+\.mp4)" type="video\/mp4" \/>/);

  assert.ok(videoSource?.groups?.src, 'Hero should declare a public mp4 source');

  const assetPath = path.join(staticRoot, 'public', videoSource.groups.src.slice(1));
  assert.ok(existsSync(assetPath), `Hero video should exist at ${videoSource.groups.src}`);
  assert.ok(statSync(assetPath).size > 0, 'Hero video should not be empty');

  assert.match(heroSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(heroSource, /\.hero-bg-video\s*\{\s*display: none;\s*\}/);
});
