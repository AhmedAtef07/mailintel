import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: true,
    treeshake: true,
    minify: false,
    sourcemap: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    clean: false,
    banner: { js: '#!/usr/bin/env node' },
    treeshake: true,
    minify: false,
    sourcemap: false,
  },
]);
