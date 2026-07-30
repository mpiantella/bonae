import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

const forbiddenDebugMarkers = [
  {
    label: 'agent debug regions',
    pattern: /#region agent log/,
  },
  {
    label: 'local debug ingest host',
    pattern: /127\.0\.0\.1:7408/,
  },
  {
    label: 'debug session header',
    pattern: /X-Debug-Session-Id/,
  },
  {
    label: 'debug hypothesis payload',
    pattern: /hypothesisId/,
  },
  {
    label: 'debug ingest endpoint',
    pattern: /\/ingest\//,
  },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(path);
      }

      return path;
    }),
  );

  return files.flat();
}

test('static source does not ship local debug instrumentation', async () => {
  const violations = [];

  for (const filePath of await sourceFiles(sourceRoot)) {
    const source = await readFile(filePath, 'utf8');

    for (const marker of forbiddenDebugMarkers) {
      if (marker.pattern.test(source)) {
        violations.push(`${relative(sourceRoot, filePath)} contains ${marker.label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
