import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs, so the built site works from any sub-path
  // (e.g. GitHub Pages or GitLab Pages project sites).
  base: './',
  test: {
    environment: 'node',
  },
});
