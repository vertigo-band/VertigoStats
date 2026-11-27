import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Set BASE=/promo-tracker/ when deploying to GitHub Pages under a repo path.
const base = process.env.BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"] },
      manifest: {
        name: "Music Promo Tracker",
        short_name: "Promo Tracker",
        description: "Track Meta ads, Hypeddit links and Spotify stats from screenshots.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0b0b",
        theme_color: "#0b0b0b",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Lets the user pick "Share → Promo Tracker" from the Pixel screenshot preview.
        share_target: {
          action: "share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: { files: [{ name: "screenshots", accept: ["image/*"] }] },
        },
      },
    }),
  ],
  test: { environment: "node" },
} as any);
