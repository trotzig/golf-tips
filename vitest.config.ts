import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each package and app with tests is its own project; one may add its own vitest.config.ts.
    projects: ["packages/*", "apps/web", "apps/mobile"],
  },
});
