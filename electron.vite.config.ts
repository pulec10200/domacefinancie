import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: "apps/desktop/src/main/index.ts",
          documentWorker: "apps/desktop/src/main/documentWorker.ts",
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: "apps/desktop/src/preload/index.ts" } },
  },
  renderer: {
    root: "apps/desktop/src/renderer",
    plugins: [react()],
    build: { rollupOptions: { input: "apps/desktop/src/renderer/index.html" } },
  },
});
