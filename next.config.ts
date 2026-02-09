import type { NextConfig } from "next";

import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: false, // process.env.ANALYZE === "true",
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
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://docs.google.com",
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
  trailingSlash: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  reactStrictMode: true,

  productionBrowserSourceMaps: false,

  // Image optimization (static export compatible)
  images: {
    unoptimized: true,
  },

  // Experimental features
  /*
   experimental: {
     // Optimize CSS bundling to reduce unused preload warnings
     optimizeCss: false, // temporarily disabled
     // Use strict CSS chunking to bundle CSS with its JavaScript
     // This prevents preload warnings by ensuring CSS is loaded
     // only when its associated JS chunk is needed
     cssChunking: "strict",
   },
   */

  // Headers (MERGED, single implementation)
  // Headers (MERGED, single implementation)
  // Note: Headers are not supported in 'output: export' mode within next.config.js
  // They must be configured in your hosting platform (e.g., netlify.toml, vercel.json)
  /*
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
  */

  // Webpack config (Commented out to support Turbopack)
  /*
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
  */
};

/* =========================
   PLUGINS
========================= */

// Bundle analyzer
const configWithAnalyzer = withBundleAnalyzer(nextConfig);

// Export final config
export default configWithAnalyzer;
