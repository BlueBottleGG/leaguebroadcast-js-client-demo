import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import webfontDownload from "vite-plugin-webfont-dl";
import svgLoader from "vite-svg-loader";

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works under ANY mount path. LeagueBroadcast
  // hosts custom overlays from an arbitrary subpath (e.g.
  // http://localhost:58869/custom/my-overlay/); with the default absolute base
  // the emitted /assets/... URLs 404 under the subpath -> blank screen. "./"
  // makes every asset URL resolve relative to index.html, wherever it lives.
  // Routing stays subpath-agnostic via hash history (see src/router/index.ts).
  base: "./",
  plugins: [tailwindcss(), vue(), webfontDownload(), svgLoader()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
