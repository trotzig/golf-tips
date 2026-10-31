import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Serves and builds the standalone demo in demo/.
export default defineConfig({
  root: "demo",
  base: "./",
  plugins: [react()],
  // three.js is ~1 MB minified; it lives in its own lazy chunk.
  build: { outDir: "../dist-demo", emptyOutDir: true, chunkSizeWarningLimit: 1100 },
});
