import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: {
      "@": path.resolve(import.meta.dirname),
      // server-only throws outside a bundler; the guard is a build concern.
      "server-only": path.resolve(import.meta.dirname, "lib/test/empty.ts"),
    } },
  test: {
    include: ["{lib,components}/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
