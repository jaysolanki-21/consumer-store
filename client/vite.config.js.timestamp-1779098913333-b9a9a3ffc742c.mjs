// vite.config.js
import { defineConfig } from "file:///D:/SCS/Backend/Consumer%20Store%202.0/consumer-store/client/node_modules/vite/dist/node/index.js";
import react from "file:///D:/SCS/Backend/Consumer%20Store%202.0/consumer-store/client/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///D:/SCS/Backend/Consumer%20Store%202.0/consumer-store/client/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vite.svg"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true
      }
    }
  }
});
export {
  vite_config_default as default
};
