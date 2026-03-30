import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // amazon-cognito-identity-js → buffer expects Node's `global` (not present in browsers).
  define: {
    global: 'globalThis',
  },
  plugins: [react()],
  server: { port: 5173 },
});
