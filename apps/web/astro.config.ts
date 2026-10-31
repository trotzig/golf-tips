import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Deployed to https://trotzig.github.io/golf-tips/ — all internal links go through `href()`.
export default defineConfig({
  site: "https://trotzig.github.io",
  base: "/golf-tips",
  trailingSlash: "ignore",
  vite: {
    plugins: [tailwindcss()],
  },
});
