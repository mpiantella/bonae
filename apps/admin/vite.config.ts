/// <reference types="node" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** This directory only — avoids resolving the monorepo root `tsconfig.json` (Astro) during builds. */
const adminRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: adminRoot,
  envDir: adminRoot,
  // amazon-cognito-identity-js → buffer expects Node's `global` (not present in browsers).
  define: {
    global: 'globalThis',
  },
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      strict: true,
      allow: [adminRoot],
    },
  },
});
