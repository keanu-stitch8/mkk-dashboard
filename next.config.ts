import type { NextConfig } from "next";

// Dashboard selalu membaca DB per request (force-dynamic), jadi Cache Components tidak dipakai.
const nextConfig: NextConfig = {
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
