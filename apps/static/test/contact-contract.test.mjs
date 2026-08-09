import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const staticRoot = join(root.pathname, 'apps/static');

async function readStaticFile(relativePath) {
  return readFile(join(staticRoot, relativePath), 'utf8');
}

function extractAttributeValues(source, attributeName) {
  return [...source.matchAll(new RegExp(`${attributeName}="([^"]+)"`, 'g'))].map((match) => match[1]);
}

test('contact form posts the simplified lead payload to the contact endpoint', async () => {
  const source = await readStaticFile('src/components/Contact.astro');
  const fieldNames = extractAttributeValues(source, 'name');

  assert.match(source, /<form[^>]+action="\/api\/contact"[^>]+method="POST"/);
  assert.match(source, /<input[^>]+type="hidden"[^>]+name="form-name"[^>]+value="contact"/);

  assert.deepEqual(
    fieldNames.filter((name) => name !== 'form-name').sort(),
    ['email', 'message', 'name', 'phone'],
  );

  for (const fieldName of ['name', 'email', 'phone', 'message']) {
    assert.match(source, new RegExp(`(?:<input|<textarea)[^>]+name="${fieldName}"[^>]+required`));
  }

  assert.doesNotMatch(source, /contact\.form\.(?:business|serviceType|serviceOptions)/);
  assert.doesNotMatch(source, /name="(?:business|service)"/);
});

test('contact social links are rendered only when configured URLs exist', async () => {
  const source = await readStaticFile('src/components/Contact.astro');
  const settings = JSON.parse(await readStaticFile('content/published/settings.json'));

  assert.deepEqual(settings.socialLinks, {
    instagram: '',
    facebook: '',
    linkedin: '',
  });

  assert.match(source, /const instagramUrl = settings\.socialLinks\.instagram\.trim\(\);/);
  assert.match(source, /const linkedinUrl = settings\.socialLinks\.linkedin\.trim\(\);/);
  assert.match(source, /const hasSocialLinks = Boolean\(instagramUrl \|\| linkedinUrl\);/);
  assert.match(source, /\{hasSocialLinks && \(/);
  assert.match(source, /\{instagramUrl && \(/);
  assert.match(source, /\{linkedinUrl && \(/);

  assert.doesNotMatch(source, /href="#"/);
  assert.doesNotMatch(source, /\|\| '#'/);
  assert.doesNotMatch(source, /settings\.socialLinks\.facebook|aria-label="Facebook"/);
});
