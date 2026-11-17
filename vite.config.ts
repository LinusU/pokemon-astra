import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    {
      name: "deny-rom-files",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (/\.(?:gb|gbc)(?:\?|$)/i.test(req.url || "")) {
            res.statusCode = 404;
            res.end();
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (/\.(?:gb|gbc)(?:\?|$)/i.test(req.url || "")) {
            res.statusCode = 404;
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
});
