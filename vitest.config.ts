import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each package (and the app's pure modules) is its own project with its own vitest.config.ts.
    projects: ["packages/*", "apps/mobile"],
  },
});
