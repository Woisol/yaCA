import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['apps/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  bundle: true,
  external: ['@woisol-g/yaca-web', '@woisol-g/yaca-web/server.js', '@woisol-g/yaca-web/server/prompt.js'],
  splitting: false,   // 代码分隔，取消以生成单一文件
  minify: true,
});
