import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  backgroundColor,
  colors,
  cssVariables,
  terracottaGradientStops,
  themeColor,
} from '../src/styles/colors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');

test('exports the approved static site palette and derived browser colors', () => {
  assert.deepEqual(colors.terracotta, {
    DEFAULT: '#FF6F61',
    dark: '#E65A4C',
  });
  assert.equal(colors.cyan, '#00CED1');
  assert.equal(colors.amber, '#DAA520');
  assert.equal(colors.body, '#6c7a7e');
  assert.equal(colors.cream, '#FBFDFF');
  assert.equal(colors.pacificblue, '#2C454C');
  assert.equal(colors['mid-blue'], '#5A7A82');
  assert.equal(colors['light-blue'], '#8AA3AB');
  assert.equal(colors['dark-blue'].DEFAULT, '#40575D');
  assert.equal(colors['dark-blue'].dark, '#3A4E53');

  assert.deepEqual(terracottaGradientStops, {
    light1: '#FF8478',
    light2: '#FF9186',
    light3: '#FF9C92',
  });
  assert.equal(themeColor, colors['dark-blue'].DEFAULT);
  assert.equal(backgroundColor, colors.cream);
});

test('keeps CSS variables aligned with the Tailwind palette tokens', () => {
  assert.deepEqual(cssVariables, {
    '--color-terracotta': colors.terracotta.DEFAULT,
    '--color-terracotta-dark': colors.terracotta.dark,
    '--color-terracotta-light-1': terracottaGradientStops.light1,
    '--color-terracotta-light-2': terracottaGradientStops.light2,
    '--color-terracotta-light-3': terracottaGradientStops.light3,
    '--color-cyan': colors.cyan,
    '--color-amber': colors.amber,
    '--color-body': colors.body,
    '--color-mid-blue': colors['mid-blue'],
    '--color-light-blue': colors['light-blue'],
    '--color-dark-blue': colors['dark-blue'].DEFAULT,
    '--color-dark-blue-dark': colors['dark-blue'].dark,
    '--color-pacificblue': colors.pacificblue,
    '--color-cream': colors.cream,
  });
});

test('keeps Tailwind configured to use the shared palette and CSS variables', async () => {
  const tailwindConfig = await readFile(resolve(appRoot, 'tailwind.config.mjs'), 'utf8');

  assert.match(
    tailwindConfig,
    /import \{ colors, cssVariables \} from '\.\/src\/styles\/colors\.mjs';/,
  );
  assert.match(tailwindConfig, /extend:\s*\{\s*colors,/);
  assert.match(tailwindConfig, /':root': cssVariables/);
});

test('keeps generated PWA metadata aligned with the shared palette and favicon asset', async () => {
  const manifestPath = resolve(appRoot, 'public/manifest.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.equal(manifest.background_color, backgroundColor);
  assert.equal(manifest.theme_color, themeColor);
  assert.deepEqual(manifest.icons, [
    {
      src: '/favicon.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ]);
});
