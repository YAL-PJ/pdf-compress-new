import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/* =========================
   SECURITY HEADERS (MERGED)
========================= */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com",
      "font-src 'self'",
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.sentry.io https://docs.google.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
];

/* =========================
   NEXT CONFIG
========================= */
const nextConfig: NextConfig = {
  // General
  output: "export",
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  reactStrictMode: true,

  // Sentry
  productionBrowserSourceMaps: false,

  // Image optimization (static export compatible)
  images: {
    unoptimized: true,
  },

  // Experimental features
  experimental: {
    // Optimize CSS bundling to reduce unused preload warnings
    optimizeCss: true,
    // Use strict CSS chunking to bundle CSS with its JavaScript
    // This prevents preload warnings by ensuring CSS is loaded
    // only when its associated JS chunk is needed
    cssChunking: "strict",
  },

  // Headers (MERGED, single implementation)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Long-term cache for static assets
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|svg|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Webpack config for Web Workers and CSS optimization
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };

      // Disable automatic CSS preload hints to prevent browser warnings
      // about preloaded resources not being used within a few seconds
      if (config.optimization?.splitChunks?.cacheGroups) {
        const cacheGroups = config.optimization.splitChunks
          .cacheGroups as Record<
            string,
            { chunks?: string; enforce?: boolean }
          >;
        // Consolidate CSS into fewer chunks to reduce preload warnings
        if (cacheGroups.styles) {
          cacheGroups.styles.chunks = "all";
          cacheGroups.styles.enforce = true;
        }
      }
    }
    return config;
  },
};

/* =========================
   PLUGINS
========================= */

// Bundle analyzer
const configWithAnalyzer = withBundleAnalyzer(nextConfig);

// Sentry plugin options
const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableServerWebpackPlugin: !process.env.SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  hideSourceMaps: true,
  disableLogger: true,
};

// Export final config
export default withSentryConfig(
  configWithAnalyzer,
  sentryWebpackPluginOptions
);
