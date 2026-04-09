import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:3003",
      "/assets": "http://localhost:3003"
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true
  }
});
