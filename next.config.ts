import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Security headers for production
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Content Security Policy - allows inline scripts needed for Next.js
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://plausible.io https://*.sentry.io",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Sentry configuration for source maps
  productionBrowserSourceMaps: false,

  // Optimize builds
  poweredByHeader: false,

  // Compression is handled by the hosting provider (Vercel/Netlify)
  compress: true,

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Redirects for common patterns
  async redirects() {
    return [
      // Redirect www to non-www (configure your DNS for this too)
      // Uncomment if using custom domain
      // {
      //   source: '/:path*',
      //   has: [{ type: 'host', value: 'www.pdfcompress.app' }],
      //   destination: 'https://pdfcompress.app/:path*',
      //   permanent: true,
      // },
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

  // Image optimization (if needed later)
  images: {
    formats: ["image/avif", "image/webp"],
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
