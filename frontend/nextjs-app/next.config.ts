import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Produces .next/standalone with a minimal server.js, used by the Dockerfile.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
