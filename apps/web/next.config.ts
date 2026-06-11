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

// Global security headers applied to every response — the safe, non-breaking
// subset: HSTS · MIME-sniff lock · clickjacking · referrer trim · powerful-
// feature lockdown. (Pre-public-pilot hardening § B1 ·
// Pre_Public_Pilot_Hardening_2026-06-04.md.)
//
// We intentionally ship ONLY `frame-ancestors 'self'` for CSP — NOT a full
// resource/script CSP. A strict default-src/script-src would have to enumerate
// every external origin we load (Supabase · Sentry ingest · PostHog · R2 ·
// Maya · YouTube · Google Fonts · Vercel) AND would break the inline
// Babel-standalone keynote decks under public/keynote/* — so a tested
// resource-CSP is a deliberate follow-up, not this change.
//
// `frame-ancestors 'self'` (not 'none') + `X-Frame-Options: SAMEORIGIN` block
// external clickjacking while still allowing the dashboard's same-origin
// landing-page live-preview iframe to render.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(self), browsing-topics=()',
  },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone build per kickoff brief — produces a self-contained server bundle
  // for Tauri desktop wrapping + container deploys.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Self-hosted NSFW model (lib/nsfw-screen.ts) — the quantized MobileNetV2-mid
  // graph-model files under models/nsfw/ are read with node:fs at runtime, so
  // the bundler can't see them. Trace them into EVERY serverless function
  // ('/**' route glob): screening fires from the guest-capture API route AND
  // the papic seat server action, and server actions can execute under any
  // route's lambda.
  outputFileTracingIncludes: {
    '/**': ['./models/nsfw/**/*'],
  },
  // `sharp` (native) is loaded server-side to decode uploaded vendor QR images
  // (lib/vendor-payment-methods.server.ts). Keep it external so it's required
  // at runtime + traced into the standalone bundle, not webpack-bundled.
  // `@tensorflow/tfjs` + `nsfwjs` (lib/nsfw-screen.ts) are external for the
  // same reason — tfjs is a multi-MB pure-JS package that crashes the webpack
  // server-bundle minifier when inlined; as externals they're required at
  // runtime and traced like any node_modules dep. (Pure-JS tfjs, NOT
  // @tensorflow/tfjs-node — native bindings break on Vercel.)
  serverExternalPackages: ['sharp', '@tensorflow/tfjs', 'nsfwjs'],
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
    // Reduce peak webpack memory during `next build`. Next.js 15's
    // build sits right at Vercel's standard 8GB build-machine ceiling
    // for this app's route count, so a build that normally fits would
    // intermittently OOM (no routes-manifest.json → deploy fails) when a
    // new page tipped it over the edge. This flag trades a slightly slower
    // build for a meaningfully lower memory high-water mark, with no change
    // to build output. Paired with the --max-old-space-size cap on the
    // build script so the ceiling is deterministic, not GC-timing-dependent.
    // https://nextjs.org/docs/app/api-reference/config/next-config-js/webpackMemoryOptimizations
    webpackMemoryOptimizations: true,
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
    // Client-side Router Cache window. Next.js 15 defaults staleTimes.dynamic
    // to 0, so EVERY in-app navigation — even tapping back to a tab you
    // viewed seconds ago — refetches the RSC payload from the server and
    // re-shows a loading skeleton. For the event dashboard (Home · Guests ·
    // Services · Website · More) that makes tab-switching feel like a fresh
    // page load every time instead of a native app.
    //
    // The per-route loading.tsx skeletons (PR #892) fix the WRONG-shape flash
    // on first visit; this fixes the RE-LOAD on revisit. `dynamic: 60` caches
    // the rendered route client-side for 60s: re-tapping a recently-viewed tab
    // inside the window is instant — no server round-trip, no skeleton at all.
    // `static: 300` does the same for prefetchable static routes.
    //
    // SAFE because every dashboard mutation runs through a Server Action that
    // calls revalidatePath() (100+ call sites across app/ + lib/), which busts
    // the client cache for the touched route — so a couple never sees stale
    // data after they change something themselves. The 60s window only affects
    // passive re-navigation, where 60s-old planning data is indistinguishable
    // from fresh. Tune `dynamic` up for more "instant", down for fresher.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  // PWA service worker + manifest must be reachable with no auth and no
  // middleware rewriting — the matcher in middleware.ts already excludes them.
  async headers() {
    return [
      {
        // Security headers on every route — pages, API, static assets, and the
        // /keynote decks. See `securityHeaders` above for why CSP is
        // frame-ancestors-only for now.
        source: '/(.*)',
        headers: securityHeaders,
      },
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
      {
        // iOS Universal Links fetches this extensionless file and REQUIRES
        // application/json — Next would otherwise serve it as text/plain and
        // iOS would reject the association. (Android's assetlinks.json already
        // gets application/json from its .json extension.)
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
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
