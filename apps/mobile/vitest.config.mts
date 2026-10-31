import { defineConfig } from "vitest/config";

// Unit tests for the app's pure modules (no React Native); run from the root `pnpm test`.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
