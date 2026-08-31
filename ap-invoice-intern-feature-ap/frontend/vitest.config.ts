import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Project root is one level above frontend/
const projectRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  root: frontendRoot,
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
  resolve: {
    alias: {
      '@frontend': frontendRoot,
      'react': path.resolve(frontendRoot, 'node_modules/react'),
      'react-dom': path.resolve(frontendRoot, 'node_modules/react-dom'),
      '@testing-library/react': path.resolve(frontendRoot, 'node_modules/@testing-library/react'),
      'react/jsx-dev-runtime': path.resolve(frontendRoot, 'node_modules/react/jsx-dev-runtime'),
      'next': path.resolve(frontendRoot, 'node_modules/next'),
      'react-virtuoso': path.resolve(frontendRoot, 'node_modules/react-virtuoso'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(frontendRoot, 'vitest.setup.ts')],
    globals: true,
    pool: 'forks',
    include: ['../testing/frontend/unit/**/*.{test,spec}.{ts,tsx}'],
    deps: {
      moduleDirectories: [
        'node_modules',
        path.resolve(frontendRoot, 'node_modules'),
      ],
    },
  },
});
