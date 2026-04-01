import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: false,
    treeshake: true,
    minify: false,
    sourcemap: false,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    clean: false,
    banner: { js: '#!/usr/bin/env node' },
    treeshake: true,
    minify: false,
    sourcemap: false,
    define: {
      __MAILINTEL_VERSION__: JSON.stringify(version),
    },
  },
]);
