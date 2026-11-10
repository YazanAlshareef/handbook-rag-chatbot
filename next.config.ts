import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Tailwind v4 through its Turbopack loader (no PostCSS config needed)
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  // sqlite-vec loads a native extension by file path, so it must not be bundled
  serverExternalPackages: ["sqlite-vec"],
  // the vector indexes are read at runtime, so ship them with the route
  outputFileTracingIncludes: {
    "/api/ask": ["./data/index.*.db"],
  },
};

export default nextConfig;
