import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: "webview",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "webview"),
    },
  },
  build: {
    outDir: "../dist/webview",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "main.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
