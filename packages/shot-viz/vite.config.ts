import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Serves and builds the standalone demo in demo/ (index.html, and swing.html: the swing playground).
export default defineConfig({
  root: "demo",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("demo/index.html", import.meta.url)),
        swing: fileURLToPath(new URL("demo/swing.html", import.meta.url)),
      },
    },
  },
});
