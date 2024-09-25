import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    includeSource: ['src/**/*.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
    },
    browser: {
      enabled: true,
      name: 'chrome',
      headless: true,
      provider: 'webdriverio',
      screenshotFailures: false,
    },
    includeTaskLocation: true,
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  plugins: [
    {
      enforce: 'pre',
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          next();
        });
      },
    },
  ],
  build: {
    target: 'esnext',
    lib: {
      entry: './src/index.ts',
      name: 'SahPoolDialect',
      fileName: (format) => `sahpool-dialect.${format}.js`,
    },
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  worker: {
    format: 'es',
    plugins: [],
  },
  esbuild: {
    target: 'esnext',
  },
});
