import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const repoRoot = root.pathname;
const staticRoot = join(repoRoot, 'apps/static');

async function readRepoFile(relativePath) {
  return readFile(join(repoRoot, relativePath), 'utf8');
}

function extractStringArray(source, constName) {
  const match = source.match(new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const;`));
  assert.ok(match, `Expected ${constName} array export`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function extractStringRecord(source, constName) {
  const match = source.match(new RegExp(`export const ${constName}: Record<string, string> = \\{([\\s\\S]*?)\\};`));
  assert.ok(match, `Expected ${constName} record export`);

  return Object.fromEntries(
    [...match[1].matchAll(/^\s*([a-zA-Z0-9_-]+): '([^']+)'/gm)].map((entry) => [entry[1], entry[2]]),
  );
}

function assertSameKeys(actual, expected, label) {
  assert.deepEqual(Object.keys(actual).sort(), [...expected].sort(), `${label} keys should match content icon union`);
}

async function assertPublicAsset(publicPath, { minBytes, magicBytes, label }) {
  assert.match(publicPath, /^\//, `${label} should use an absolute public URL`);

  const assetPath = join(staticRoot, 'public', publicPath.slice(1));
  const [{ size }, bytes] = await Promise.all([stat(assetPath), readFile(assetPath)]);

  assert.ok(size >= minBytes, `${label} should be a non-empty checked-in asset`);
  assert.deepEqual([...bytes.subarray(0, magicBytes.length)], magicBytes, `${label} should have the expected file signature`);
}

test('value-prop image mapping covers every content icon and checked-in asset', async () => {
  const contentIconsSource = await readRepoFile('packages/content/src/icons.ts');
  const staticIconsSource = await readRepoFile('apps/static/src/lib/icons.ts');
  const valuePropIcons = extractStringArray(contentIconsSource, 'valuePropIcons');
  const valuePropIconSrc = extractStringRecord(staticIconsSource, 'valuePropIconSrc');
  const valuePropIconAlt = extractStringRecord(staticIconsSource, 'valuePropIconAlt');

  assertSameKeys(valuePropIconSrc, valuePropIcons, 'valuePropIconSrc');
  assertSameKeys(valuePropIconAlt, valuePropIcons, 'valuePropIconAlt');

  for (const icon of valuePropIcons) {
    await assertPublicAsset(valuePropIconSrc[icon], {
      minBytes: 1_024,
      magicBytes: [0x89, 0x50, 0x4e, 0x47],
      label: `${icon} value-prop illustration`,
    });
    assert.ok(valuePropIconAlt[icon].trim().length > 0, `${icon} should have non-empty alt copy`);
  }
});

test('published landing content only references value-prop icons with static illustrations', async () => {
  const contentIconsSource = await readRepoFile('packages/content/src/icons.ts');
  const staticIconsSource = await readRepoFile('apps/static/src/lib/icons.ts');
  const valuePropIcons = new Set(extractStringArray(contentIconsSource, 'valuePropIcons'));
  const valuePropIconSrc = extractStringRecord(staticIconsSource, 'valuePropIconSrc');

  for (const locale of ['es', 'en']) {
    const published = JSON.parse(await readRepoFile(`apps/static/content/published/${locale}.json`));
    assert.ok(published.valueProp.items.length > 0, `${locale} should publish value-prop cards`);

    for (const item of published.valueProp.items) {
      assert.ok(valuePropIcons.has(item.icon), `${locale} published unknown value-prop icon: ${item.icon}`);
      assert.ok(valuePropIconSrc[item.icon], `${locale} icon ${item.icon} should resolve to an illustration`);
    }
  }
});

test('hero video source is wired to the checked-in mp4 with reduced-motion fallback', async () => {
  const source = await readRepoFile('apps/static/src/components/Hero.astro');

  assert.match(source, /<video[\s\S]*class="hero-bg-video[\s\S]*aria-hidden="true"[\s\S]*>/);
  assert.match(source, /<source src="\/videos\/hero-tech\.mp4" type="video\/mp4" \/>/);
  assert.match(source, /preload="metadata"/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /\.hero-bg-video\s*\{\s*display: none;/);

  await assertPublicAsset('/videos/hero-tech.mp4', {
    minBytes: 100_000,
    magicBytes: [0x00, 0x00, 0x00],
    label: 'hero video',
  });
});
