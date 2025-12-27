import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize highs package so WASM loads correctly
  serverExternalPackages: ["highs"],
  
  // Empty turbopack config to acknowledge we're using turbopack
  turbopack: {},
};

export default nextConfig;
