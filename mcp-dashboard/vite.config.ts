import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "dist",
  },

  server: {
    port: 5173,
    host: true,
    allowedHosts: ["dev.mcp.docaperformance.com.br"],

    watch: {
      usePolling: true,
      interval: 250,
    },

    hmr: {
      host: "dev.mcp.docaperformance.com.br",
      protocol: "wss",
      clientPort: 443,
    },

    proxy: {
      "/api": {
        target:
          process.env.VITE_API_PROXY_TARGET ||
          "https://webhook.docaperformance.com.br",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
