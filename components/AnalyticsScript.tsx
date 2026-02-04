'use client';

import Script from 'next/script';

/**
 * Plausible Analytics Script Component
 *
 * Configure via environment variables:
 * - NEXT_PUBLIC_PLAUSIBLE_DOMAIN: Your site domain (e.g., "pdfcompress.app")
 * - NEXT_PUBLIC_PLAUSIBLE_HOST: Self-hosted Plausible URL (optional, defaults to plausible.io)
 */
export function AnalyticsScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const host = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST || 'https://plausible.io';

  // Don't load if no domain configured or in development
  if (!domain) {
    return null;
  }

  return (
    <Script
      defer
      data-domain={domain}
      src={`${host}/js/script.js`}
      strategy="afterInteractive"
    />
  );
}
