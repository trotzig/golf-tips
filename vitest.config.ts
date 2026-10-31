import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each package is its own project; a package may add its own vitest.config.ts.
    projects: ["packages/*"],
  },
});
