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
  // Wikimedia Commons — deviation from "origins we control" because V1
  // venue_directory hero photos hotlink CC-BY-SA images served from
  // upload.wikimedia.org (iteration 0022, migration
  // 20260526020000_venue_directory_hero_images.sql). V1.2 venue iteration
  // copies these into Supabase Storage and this rule retires.
  {
    protocol: 'https' as const,
    hostname: 'upload.wikimedia.org',
    pathname: '/wikipedia/commons/**',
  },
  // Picsum.photos — V1 moodboard placeholder photos (iteration 0010,
  // migration 20260528000000_moodboard_library_placeholder_seed.sql).
  // The moodboard_library_assets table is empty at hard-launch until admin
  // uploads via /admin/moodboard-library; this seed uses stable Picsum seed
  // URLs so couples have something to render on the Mood Board page.
  // Retires when admin replaces them with real wedding-specific photos.
  {
    protocol: 'https' as const,
    hostname: 'picsum.photos',
    pathname: '/**',
  },
  {
    protocol: 'https' as const,
    hostname: 'fastly.picsum.photos',
    pathname: '/**',
  },
  // Pexels CDN — V1 pilot-polish photos for vendor_profiles (admin-owned
  // unclaimed rows for the 59 famous PH venues + the 960 test marketplace
  // vendors) AND venue_directory reception/garden/beach/heritage rows.
  // Pexels License (https://www.pexels.com/license/) is functionally
  // equivalent to CC0 — free for any use, attribution not required, no
  // permission needed. Migration
  // 20260617000000_iteration_0006_vendor_hero_photos_pilot_polish.sql
  // hotlinks ~115 verified Pexels CDN URLs (all batch-curl 200 OK before
  // ship). Retires when real vendors claim their listings and upload
  // their own photos OR V1.5+ Higgsfield Filipino-specific batch
  // generation (CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars"
  // 3-phase asset sourcing strategy) replaces the stock pool.
  {
    protocol: 'https' as const,
    hostname: 'images.pexels.com',
    pathname: '/photos/**',
  },
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
    // Tree-shake barrel imports per Next.js 15 docs. lucide-react ships
    // 1,500+ icons; every page on the marketing site + dashboard imports
    // a handful via named imports from the package root. Without this
    // flag, transitive re-exports can pull in the entire icon graph on
    // some builds. Listing here is a no-op when SWC already tree-shakes
    // and a meaningful TBT win when it doesn't.
    optimizePackageImports: ['lucide-react'],
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
  // v2.1 keynote static decks · CLAUDE.md 2026-05-28 11th row "v2.1
  // template package adoption" Phase 10 Option B. Three React+Babel
  // scroll decks live under public/keynote/{index,vendors,engineering}.html
  // with their JSX dependencies + styles.css + brand assets co-located.
  // These rewrites give them clean URLs (/keynote · /keynote/vendors ·
  // /keynote/engineering) instead of forcing the .html suffix. The static
  // files in public/ are served directly by Next.js; the rewrite is a
  // URL-only remap so a deep-link in marketing email or social card lands
  // on the right slide deck without a 404 + redirect dance.
  async rewrites() {
    return [
      { source: '/keynote', destination: '/keynote/index.html' },
      { source: '/keynote/vendors', destination: '/keynote/vendors.html' },
      { source: '/keynote/engineering', destination: '/keynote/engineering.html' },
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
