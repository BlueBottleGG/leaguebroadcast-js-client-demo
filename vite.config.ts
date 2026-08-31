import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import webfontDownload from "vite-plugin-webfont-dl";
import svgLoader from "vite-svg-loader";

// https://vite.dev/config/
export default defineConfig({
  // LeagueBroadcast rewrites root asset URLs to /custom/<slug>/ when it serves
  // a static overlay. Root URLs also keep assets valid on deep history routes.
  base: "/",
  plugins: [tailwindcss(), vue(), webfontDownload(), svgLoader()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
