/**
 * Sentry Client Configuration
 * This file configures Sentry SDK for client-side error tracking.
 *
 * Setup Instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new Next.js project
 * 3. Set NEXT_PUBLIC_SENTRY_DSN in your .env.local file
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Adjust sample rates in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',

  // Environment tag
  environment: process.env.NODE_ENV,

  // Filter out common non-errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore cancelled requests
    if (error instanceof Error) {
      if (error.name === 'AbortError') return null;
      if (error.message.includes('ResizeObserver')) return null;
    }

    return event;
  },

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Only capture replays on errors
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
