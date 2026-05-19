import path from 'node:path';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

function getHostnameFromEnv(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Allow `next/image` to optimize photos served from R2 (production hero
// imagery, vendor portfolios, mood-board crops, etc.) and Supabase Storage
// (legacy / fallback upload bucket). Hostnames are resolved from the same
// env vars the runtime app already reads — no duplicate config.
const r2PublicHost = getHostnameFromEnv(process.env.R2_PUBLIC_URL);
const supabaseHost = getHostnameFromEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);

const remoteImagePatterns = [
  // R2 custom domain / r2.dev subdomain (whichever R2_PUBLIC_URL points at)
  r2PublicHost
    ? { protocol: 'https' as const, hostname: r2PublicHost, pathname: '/**' }
    : null,
  // R2 account-scoped endpoint — only matches if accountId is set
  process.env.R2_ACCOUNT_ID
    ? {
        protocol: 'https' as const,
        hostname: `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        pathname: '/**',
      }
    : null,
  // Supabase Storage public URL
  supabaseHost
    ? {
        protocol: 'https' as const,
        hostname: supabaseHost,
        pathname: '/storage/v1/object/public/**',
      }
    : null,
].filter((p): p is NonNullable<typeof p> => p !== null);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone build per kickoff brief — produces a self-contained server bundle
  // for Tauri desktop wrapping + container deploys.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    // AVIF first — ~50% smaller than WebP for the photographic content
    // marketing surfaces use (hero, coverage, vendor portfolios). Next.js
    // falls back to WebP for clients without AVIF support.
    formats: ['image/avif', 'image/webp'],
    // Tight whitelist — only origins we control. Empty array is fine in
    // local dev (no remote images), so build succeeds with R2 unset.
    remotePatterns: remoteImagePatterns,
    // Cache optimized variants for a week so we don't re-optimize on every
    // revalidation. Vercel's image CDN charges per transformation, not per
    // delivery, so this is pure savings.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
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
