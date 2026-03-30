import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "Recovery Passport",
        short_name: "Recovery",
        start_url: "/",
        display: "standalone",
        theme_color: "#1A4A4A",
        background_color: "#FAF5EC",
        icons: [
          { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /\/card/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "card-cache" },
          },
          {
            urlPattern: /\/plan/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "plan-cache" },
          },
          {
            urlPattern: /\/milestones/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "milestones-cache" },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
