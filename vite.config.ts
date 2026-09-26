import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: [
      { find: "@shared", replacement: path.resolve(root, "shared") },
      { find: "@", replacement: path.resolve(root, "src") },
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
