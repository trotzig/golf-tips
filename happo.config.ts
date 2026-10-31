import { defineConfig } from "happo";
import { buildHappoBundle } from "./apps/web/happo/build.ts";

export default defineConfig({
  apiKey: process.env.HAPPO_API_KEY!,
  apiSecret: process.env.HAPPO_API_SECRET!,

  project: "default",
  integration: {
    // Every built page and shot diagram, bundled by apps/web/happo/build.ts.
    type: "custom",
    build: buildHappoBundle,
  },

  // https://docs.happo.io/docs/configuration#targets
  targets: {
    "chrome-large": {
      type: "chrome",
      viewport: "1200x900",
    },

    "chrome-small": {
      type: "chrome",
      viewport: "375x667",
    },

    accessibility: {
      type: "accessibility",
      viewport: "1024x768",
    },
  },
});
