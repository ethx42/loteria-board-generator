import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Externalize highs package so WASM loads correctly
  serverExternalPackages: ["highs"],

  // Empty turbopack config to acknowledge we're using turbopack
  turbopack: {},

  // Configure remote image domains for Next.js Image component
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      // Cloudflare R2 public URL
      {
        protocol: "https",
        hostname: "pub-f6e0582122da452f9d51e1e631b8f543.r2.dev",
        pathname: "/**",
      },
      // Allow any R2 dev subdomain (for flexibility)
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
