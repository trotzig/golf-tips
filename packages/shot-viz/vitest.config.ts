import { defineConfig } from "vitest/config";

// Separate from vite.config.ts (the demo) so the root `vitest --projects packages/*` picks this up.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
