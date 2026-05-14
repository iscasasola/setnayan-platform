import path from 'node:path';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone build per kickoff brief — produces a self-contained server bundle
  // for Tauri desktop wrapping + container deploys.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Server actions accept file uploads (merchant QR codes, future vendor
  // logos + payment screenshots). Default 1MB is too small for phone-camera
  // screenshots — raise to 6MB so a single image plus form fields fit.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  // PWA service worker + manifest must be reachable with no auth and no
  // middleware rewriting — the matcher in middleware.ts already excludes them.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ];
  },
};

// Sentry wrapper — injects the SDK and (when SENTRY_AUTH_TOKEN is set)
// uploads source maps at build time. Source-map upload is deferred until
// the owner provisions the auth token; the wrapper is safe without it.
export default withSentryConfig(nextConfig, {
  // Suppress CLI chatter outside CI builds.
  silent: !process.env.CI,
  // Instrument client files outside /pages so server-action errors keep
  // useful stack frames.
  widenClientFileUpload: true,
  // Skip the Sentry logger to shrink the client bundle.
  disableLogger: true,
  // Vercel cron monitors are off — we'll opt in per-cron later if needed.
  automaticVercelMonitors: false,
});
