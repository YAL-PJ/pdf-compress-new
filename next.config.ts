import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },

  // Sentry configuration for source maps
  productionBrowserSourceMaps: false,

  // Optimize builds
  poweredByHeader: false,

  // Webpack configuration for web workers
  webpack: (config, { isServer }) => {
    // Handle web workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

// Apply bundle analyzer
const configWithAnalyzer = withBundleAnalyzer(nextConfig);

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses all Sentry logs
  silent: true,

  // Organization and project for source maps (set in environment)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps only in production with valid DSN
  disableServerWebpackPlugin: !process.env.SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Hide source maps from client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
};

// Export with Sentry wrapper
export default withSentryConfig(configWithAnalyzer, sentryWebpackPluginOptions);
