import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Serves and builds the standalone demo in demo/.
export default defineConfig({
  root: "demo",
  base: "./",
  plugins: [react()],
  build: { outDir: "../dist-demo", emptyOutDir: true },
});
