/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Relative base: the build works at any path (e.g. GitHub Pages' /GymApp/).
  // Hash routing means no server rewrites are needed.
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: ['es2020', 'safari15'],
    cssTarget: 'safari15',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
