/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage } from "node:http";

const BACKEND = process.env.CRUNCHRADAR_BACKEND ?? "http://localhost:8000";

// Browser page loads (Accept: text/html) of routes the SPA owns stay in Vite;
// fetches and form posts to the same paths go to FastAPI.
const htmlStaysLocal = (req: IncomingMessage) =>
  req.method === "GET" && (req.headers.accept ?? "").includes("text/html") ? "/index.html" : undefined;

const proxied = (bypassHtml: boolean) => ({
  target: BACKEND,
  changeOrigin: true,
  ...(bypassHtml ? { bypass: htmlStaysLocal } : {}),
});

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    strictPort: true,
    proxy: {
      "/api": proxied(false),
      "/healthz": proxied(false),
      "/workflows": proxied(false),
      "/summary": proxied(false),
      "/pulse": proxied(false),
      "/proposals": proxied(true),
      "/outbox": proxied(true),
      "/approve": proxied(true),
      "/lecturer": proxied(true),
    },
  },
  preview: { port: 5199, strictPort: true },
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
