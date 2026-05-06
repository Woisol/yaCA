import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['apps/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true
});
