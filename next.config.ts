import type { NextConfig } from "next";

// Dashboard selalu membaca DB per request (force-dynamic), jadi Cache Components tidak dipakai.
const nextConfig: NextConfig = {
  // Library Google (gRPC/proto) dibaca dari node_modules saat runtime, jangan di-bundle.
  serverExternalPackages: ["@google-analytics/data", "google-gax", "googleapis"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
