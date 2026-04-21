import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function isHtmlNavigationRequest(
  acceptHeader: string | undefined,
  requestUrl: string | undefined,
): boolean {
  if (!requestUrl) {
    return false;
  }

  const isAuthDocument =
    requestUrl === "/auth" ||
    requestUrl === "/auth/" ||
    requestUrl.startsWith("/auth?") ||
    requestUrl.startsWith("/auth/?");

  return isAuthDocument && Boolean(acceptHeader?.includes("text/html"));
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // No rewrite — backend now serves routes under /api prefix
      },
      "/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
        bypass(req) {
          if (isHtmlNavigationRequest(req.headers.accept, req.url)) {
            return "/index.html";
          }

          return undefined;
        },
      },
    },
  },
});
