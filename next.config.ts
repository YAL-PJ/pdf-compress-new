import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
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

  // Compress responses
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Strict mode for better React development
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        // Static assets - long cache
        source: '/(.*)\\.(ico|png|jpg|jpeg|gif|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

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
