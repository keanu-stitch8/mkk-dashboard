import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // service/query/repository mengimpor "server-only"; tes hanya menyentuh lib/ & mappers/, jadi cukup modul kosongnya
  resolve: {
    alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js") },
  },
  test: { include: ["tests/**/*.test.ts", "src/**/*.test.ts"], environment: "node" },
});
