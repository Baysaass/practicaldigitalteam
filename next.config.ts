import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Embedded PGlite is for local development only; keep it out of server bundles.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: { "*": ["node_modules/@electric-sql/pglite/**", ".data/**"] },
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
