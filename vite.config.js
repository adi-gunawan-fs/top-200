import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/braintrust": {
        target: "https://api.braintrust.dev",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/braintrust/, ""),
      },
    },
  },
});
