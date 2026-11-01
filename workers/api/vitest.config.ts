import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The Worker shares the registration form rules with the web app.
    alias: { "@": path.resolve(import.meta.dirname, "../../apps/web/src") },
  },
  test: { environment: "node", globals: true },
});
