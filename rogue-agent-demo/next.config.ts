import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Keep the dev badge off the projected page.
  devIndicators: false,
};

export default nextConfig;
