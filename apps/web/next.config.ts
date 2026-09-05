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
  // 🚨 THE BUCKET IS A SUBDOMAIN, AND THE ENTRY ABOVE NEVER MATCHED A REAL URL.
  //
  // `lib/r2.ts` builds its S3Client with
  // `endpoint: https://<accountId>.r2.cloudflarestorage.com` and leaves
  // `forcePathStyle` at its default of FALSE, so every presigned URL the SDK
  // signs is VIRTUAL-HOST style:
  //     https://setnayan-media.<accountId>.r2.cloudflarestorage.com/<key>
  // The pattern above has no bucket segment, `hostname` is an exact match
  // unless it carries a wildcard, and so every single presigned R2 image ever
  // handed to next/image came back **HTTP 400 INVALID_IMAGE_OPTIMIZE_REQUEST**.
  //
  // MEASURED on the live site 2026-08-08, minutes after the fix that was
  // supposed to make the owner's shop logo appear: the presigned URL itself
  // answered `200 image/png 34478 bytes`, and `/_next/image?url=…` answered
  // `400`. The picture was still missing — same symptom, third cause, after a
  // raw `r2://` and a CSP-blocked iframe. **RESOLVING A REFERENCE IS NOT THE
  // SAME AS THE PICTURE ARRIVING. FETCH THE FINAL URL.**
  //
  // Nobody had seen it because production holds no vendor portfolios and no
  // Papic photos yet — the shop logo was the first R2 image the optimizer was
  // ever asked for. This affected the whole app, not one page.
  process.env.R2_ACCOUNT_ID
    ? {
        protocol: 'https' as const,
        hostname: `*.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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
//
// `frame-src` is scoped narrowly to the video players we embed: same-origin
// (the landing-page preview iframe) plus YouTube-nocookie / YouTube / Vimeo,
// which the vendor "Featured videos" gallery + the Enterprise Films rack mount
// as inline players — and Instagram / TikTok, whose /embed players back the
// Creator "Adventure Chapter" embed (lib/creator-chapters.ts allowlist:
// youtube|instagram|tiktok; every chapter iframe is additionally sandboxed).
// This directive only governs what WE embed — it does NOT re-introduce the
// strict default-src/script-src the comment above deferred, so the
// Babel-standalone keynote decks are unaffected. New embed origins later
// extend this one list.
/**
 * REPORT-ONLY CSP (2026-07-30) — the measurement step the comment above deferred.
 *
 * The deferral is right that a strict `default-src`/`script-src` "would have to
 * enumerate every external origin we load" — and that list is a GUESS until it is
 * measured. Guessing it wrong takes the site down, which is the same long-tail trap
 * that made a fail-closed allowlist the wrong call for `/api/upload`'s media
 * prefixes. So this header BLOCKS NOTHING; it names the origins we believe we use
 * and reports whatever it actually catches to /api/csp-report.
 *
 * ⚠ `'unsafe-inline'` + `'unsafe-eval'` are DELIBERATELY kept in `script-src`. A
 * strict script-src here would fire on Next's own inline hydration bootstrap on
 * every single page load and drown the signal — the unknown worth measuring is the
 * ORIGIN allowlist, not inline-ness. Removing them is a later step that needs a
 * nonce in middleware, and it should be measured on its own.
 *
 * Enforcement is a SEPARATE, owner-reviewed change once the reports are boring.
 * Never flip this to the enforcing header in the same PR that changes the policy.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Origins named in the deferral comment above, plus the embeds already trusted by
  // the enforced `frame-src`. Anything MISSING here is precisely what the reports
  // will surface.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com https://*.vercel-scripts.com https://*.posthog.com https://challenges.cloudflare.com https://itunes.apple.com",
  // ↑ MEASURED 2026-08-02: PostHog loads its client from
  // `us-assets.i.posthog.com`, and it was in connect-src but NOT script-src —
  // so the policy let PostHog SEND but not LOAD. Enforcing the old list would
  // have killed product analytics outright. Exactly what report-only is for.
  //
  // ↑ 2026-08-11, both found by `csp-embeds-are-allowed.test.ts` once it was
  // taught to look at SCRIPT hosts, not just `<iframe>` markup we wrote:
  //   • `challenges.cloudflare.com` — Cloudflare Turnstile. `turnstile-field.tsx`
  //     and `turnstile-client.ts` inject its api.js, and the challenge itself is
  //     an IFRAME from the same origin, so it needs BOTH this directive and the
  //     enforced `frame-src` below. Absent from either one, every sign-in,
  //     sign-up, password reset and login-free claim is refused the moment
  //     captcha is switched on — including the owner's.
  //   • `itunes.apple.com` — the Song Bank preview lookup is JSONP
  //     (`lib/itunes-preview.ts` appends a <script src>), so it is a script
  //     origin we have always loaded and never named here. Report-only blocks
  //     nothing, so this was noise in the reports rather than a live break —
  //     but enforcing the old list would have killed song previews outright.
  // NOT added: `connect-src`. Turnstile's own traffic runs INSIDE its iframe,
  // on its own origin. If a parent-context call to it ever appears, that is
  // precisely the report this header exists to raise — do not pre-empt it.
  // `ipc:` / `http://ipc.localhost` — S5 (build-sessions/encoder/S5.md, trap 2):
  // Tauri's custom-protocol IPC on WINDOWS (WebView2) requests
  // `http://ipc.localhost/<command>`; WITHOUT this origin in connect-src, that
  // fetch is a CSP violation and `ipc-protocol.js` permanently latches into its
  // JSON/postMessage fallback for the rest of the session — a self-inflicted
  // version of the exact trap `contract.rs`'s docblock describes. Listing it
  // is NECESSARY for Windows, but NOT SUFFICIENT to reach `InvokeBody::Raw`
  // everywhere: S0 measured that on macOS/WebKit the `ipc://` custom protocol
  // is refused from an `https://` document regardless of this header (mixed
  // content, not CSP) — see `contract.rs`'s own docblock and
  // `ipc-envelope.ts`'s go-live guard, which is why the chosen transport is
  // the base64-JSON envelope on EVERY platform, not just macOS. Guarded by
  // `csp-encoder-ipc.test.ts`.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.posthog.com https://*.r2.cloudflarestorage.com https://media.setnayan.com https://*.vercel-insights.com ipc: http://ipc.localhost",
  // 🔴 ADDED 2026-08-11. This directive was MISSING ENTIRELY, and its absence was
  // a live outage scheduled for whenever someone enforces this draft: with no
  // `frame-src`, frames fall back to `default-src 'self'`, so EVERY embed on the
  // site — YouTube, Vimeo, Instagram, TikTok, the vendor OpenStreetMap panel
  // (fixed only days ago) and the Turnstile challenge (fixed in this same pass) —
  // becomes a silent grey box. The exact failure this whole file is about.
  //
  // It also cost us the signal in the meantime: with everything falling back to
  // 'self', every legitimate YouTube embed reports a violation, so real findings
  // would arrive buried in noise about things we already decided are fine.
  //
  // ⚠ THIS IS A COPY OF THE ENFORCED LIST BELOW, AND A COPY IS A DRIFT WAITING TO
  // HAPPEN — so it is not left to discipline. `csp-embeds-are-allowed.test.ts`
  // fails if the enforced list gains a host this one lacks. The chain is anchored
  // in code at both ends: source iframes/scripts → enforced list → this draft.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.instagram.com https://www.tiktok.com https://www.openstreetmap.org https://challenges.cloudflare.com",
  "img-src 'self' data: blob: https://media.setnayan.com https://*.r2.cloudflarestorage.com https://*.supabase.co https://i.ytimg.com",
  "media-src 'self' data: blob: https://media.setnayan.com https://*.r2.cloudflarestorage.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'report-uri /api/csp-report',
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(self), browsing-topics=()',
  },
  // ⚠ `https://www.openstreetmap.org` added 2026-08-08. It was MISSING, and the
  // vendor location map has been a silent grey box on every shop page with
  // coordinates ever since it shipped — measured on the live site, not inferred.
  // A blocked iframe throws nothing a visitor or a test can see; it just renders
  // empty. So "New embed origins later extend this one list" (above) needed a
  // mechanism, not a sentence: `lib/csp-embeds-are-allowed.test.ts` now fails if
  // any iframe host in the app is absent here.
  //
  // 🔴 `https://challenges.cloudflare.com` added 2026-08-11 — THE SAME BUG, one
  // step further out. The OSM fix taught the guard to read `<iframe>` markup, so
  // it could never see this: Cloudflare Turnstile paints its challenge in a
  // window IT creates, from a script, with no `<iframe` anywhere in our source.
  // Missing here, the bot check cannot render — and because Supabase captcha is
  // GLOBAL, that is every sign-in, sign-up, password reset and login-free camera
  // claim refused at once, the owner's included. Nothing is broken today only
  // because no site key is set. The guard now derives this from the script hosts
  // the app actually injects; see FRAME_CREATING_SCRIPT_HOSTS in that test.
  //
  // 🔑 KEEP THIS COMMENT ABOVE THE OBJECT, NOT BETWEEN `value:` AND THE STRING.
  // `csp-report.test.ts` matches `value:` immediately followed by the policy to
  // prove the enforced header is still the frame-only one, and a comment in
  // between fails it. That guard is right and is not to be loosened — this note
  // is here so the next person moves their comment instead of the assertion.
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'self'; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.instagram.com https://www.tiktok.com https://www.openstreetmap.org https://challenges.cloudflare.com",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Skip the in-`next build` TypeScript type-check + ESLint passes. BOTH are
  // already enforced as dedicated, isolated, REQUIRED CI jobs
  // (.github/workflows/ci.yml → `typecheck-lint`: `pnpm typecheck` (tsc
  // --noEmit) + `pnpm lint`), so re-running them inside `next build` is pure
  // duplication — and it's the build's single largest memory peak: Next's
  // "checking validity of types" phase loads the FULL TypeScript program
  // (multiple GB resident) on top of the already-built webpack output, which
  // is precisely what tips this app's `next build` over Vercel's free 8GB
  // build-machine ceiling and OOM-kills the deploy (no routes-manifest.json →
  // "couldn't be found"). That's the recurring #1258 OOM, creeping back as the
  // route count grows; the in-build type-check was the 19-minute phase the OOM
  // died in. Skipping it is FREE, OUTPUT-NEUTRAL (type-checking + linting never
  // affect emitted JS), and loses NO safety — a type or lint error still fails
  // the required `typecheck-lint` job in its own isolated container and blocks
  // the merge. It does NOT disable the webpack `server-only` compile guard the
  // CI `build` job exists to catch: that fires during compilation, not the
  // type-check pass, so it's unaffected by these flags. The next free lever
  // after #1258's webpackMemoryOptimizations + --max-old-space-size cap.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
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
  // models/face-detection/ (lib/face-blur.ts — Salamisim P2 FaceBlock baker)
  // follows the identical committed-weights + node:fs pattern.
  // Monogram-lockup PDF badges (lib/lockup-pdf.ts) read these TTFs with node:fs
  // via a path that's indirected through a function param, so @vercel/nft can't
  // statically resolve them at the readFileSync call site — trace them explicitly
  // or the seating/concept-pdf routes throw ENOENT for bar/duo/script/infinity.
  outputFileTracingIncludes: {
    '/**': [
      './models/nsfw/**/*',
      './models/face-detection/**/*',
      './assets/cipher-fonts/*.ttf',
      './lib/social/fonts/*.ttf',
      // NPC submission PDFs streamed admin-only by
      // /admin/data-privacy/documents/[doc] (read via a dynamic filename, so
      // nft can't statically trace them — force-include the set).
      './assets/npc-docs/*.pdf',
    ],
  },
  // `sharp` (native) is loaded server-side to decode uploaded vendor QR images
  // (lib/vendor-payment-methods.server.ts). Keep it external so it's required
  // at runtime + traced into the standalone bundle, not webpack-bundled.
  // `@tensorflow/tfjs` + `nsfwjs` (lib/nsfw-screen.ts) are external for the
  // same reason — tfjs is a multi-MB pure-JS package that crashes the webpack
  // server-bundle minifier when inlined; as externals they're required at
  // runtime and traced like any node_modules dep. (Pure-JS tfjs, NOT
  // @tensorflow/tfjs-node — native bindings break on Vercel.)
  serverExternalPackages: [
    'sharp',
    '@tensorflow/tfjs',
    'nsfwjs',
    '@tensorflow-models/face-detection',
  ],
  // paper.js (Vector Monogram Studio engine) ships a Node entry
  // (paper-full → dist/node/{self,canvas}.js) that `require`s `jsdom` + `canvas`
  // for server-side rendering we never use — the studio engine runs ONLY in the
  // browser (client-only dynamic import in studio.tsx). paper's own `browser`
  // field already stubs these for the web target; mirror that for the SERVER
  // compile too so `next build` doesn't try to resolve the absent, unused
  // jsdom/canvas node deps (it OOM-pattern-failed at module resolution before
  // this). Safe: neither is an app dependency and paper's node path never runs.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias.jsdom = false;
    config.resolve.alias.canvas = false;
    config.resolve.alias['jsdom/lib/jsdom/living/generated/utils'] = false;
    return config;
  },
  images: {
    // WebP only — AVIF dropped 2026-06-14 to cut the Vercel image-optimization
    // bill. Emitting BOTH avif+webp DOUBLES Vercel's per-transformation charge,
    // and our gallery / vendor-portfolio / seeded-stock images are mostly
    // viewed once, so the per-transform cost dominates the per-byte delivery
    // saving AVIF would buy. WebP is universally supported and visually
    // indistinguishable for this content. (Reverses the prior "AVIF first"
    // posture purely on cost grounds; the proper fix — move optimization +
    // delivery to Cloudflare Images with free R2 egress — is tracked in
    // Image_Optimization_Plan.md. This is the zero-infra interim cut.)
    formats: ['image/webp'],
    // Tight whitelist — only origins we control. Empty array is fine in
    // local dev (no remote images), so build succeeds with R2 unset.
    remotePatterns: remoteImagePatterns,
    // Drop the two largest responsive variants (2048 / 3840) from Next's
    // default spread. They're the most expensive transforms to encode and are
    // only ever requested by full-bleed images on 4K displays, where the 1920
    // variant is already sharp. Trims transform count + per-image cache
    // footprint with no visible difference on normal screens.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Cache optimized variants for a MONTH (was 7 days) so we don't re-optimize
    // on every ISR revalidation. Vercel's image CDN charges per transformation,
    // not per delivery, so a longer TTL is pure savings — the source images
    // (R2 hero / vendor / moodboard photos) are immutable once uploaded.
    minimumCacheTTL: 60 * 60 * 24 * 31,
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
    // Limit webpack to 1 parallel worker — cuts peak build RAM so Vercel's
    // standard container doesn't OOM. Slower build; identical output.
    // Next lever after webpackMemoryOptimizations (#1258) + ignoreBuildErrors
    // (#1425). Escalate to Vercel Enhanced Builds (paid) if this recurs.
    cpus: 1,
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
        // Report-only CSP — measurement, blocks nothing. Now covers EVERY path.
        //
        // It used to exclude /keynote and /proto, because those dated internal
        // pitch decks executed inline Babel-standalone out of public/ and would
        // have buried the signal in known, uninteresting violations. Those decks
        // were taken off the open web on 2026-08-12 (moved to `internal-decks/`),
        // so the carve-out lost its subject — and a carve-out that outlives its
        // reason is worse than none: anything ever republished at those paths
        // would have been silently exempt from the measurement too, without
        // anyone choosing that.
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY }],
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
  // 2026-06-14 — Real Weddings showcase renamed `/weddings` → `/realstories`
  // (owner "rename it as /realstories"). 301-redirect the old paths so the
  // already-indexed `/weddings` URLs consolidate their ranking to the new path
  // and any in-flight nav links still pointing at `/weddings` (the nav PR #1391
  // was open at rename time) keep working instead of 404-ing.
  async redirects() {
    return [
      // 2026-08-11 — Papic became ONE product, so the help article
      // 'Papic Pool or Papic One — which one do I want?' answers a question that
      // no longer exists. It was rewritten (how do I make sure one person never
      // runs out?) under an accurate slug; this carries any bookmark or indexed
      // link to the new answer instead of a 404.
      {
        source: '/help/papic-pool-vs-papic-one',
        destination: '/help/papic-giving-a-camera-its-own-shots',
        permanent: true,
      },
      /*
        2026-09-01 — THREE EXPLAINERS BECAME ONE. `/why-setnayan`,
        `/how-it-works` and `/features` each answered part of "what is this and
        what does it do", and only `/features` had the bilingual dictionary
        architecture. The other two folded into it as sections, so these carry
        their ranking, bookmarks, and any indexed link to the merged page
        instead of a 404.

        🔑 THE TAGLISH TWIN GOES TO THE TAGLISH PAGE. `/tl/how-it-works` must
        land on `/tl/features`, NOT `/features` — sending a Taglish reader to
        the English page is a locale regression that reads as a bug, and it
        would break the EN↔TL hreflang reciprocity the pair depends on.

        Permanent (308) so the ranking transfers. EXACT sources only: none of
        these had subpaths, and a `:path*` catch-all would swallow future
        routes nested under them.
      */
      { source: '/how-it-works', destination: '/features', permanent: true },
      { source: '/tl/how-it-works', destination: '/tl/features', permanent: true },
      /*
        ⚠ `/why-setnayan` HAD NO TAGLISH TWIN — it was English-only, which is
        part of why it was merged: the frame now HAS a Taglish edition it never
        had. There is deliberately no `/tl/why-setnayan` rule below, because
        that URL never existed and inventing a redirect for it would advertise
        a page nobody can have linked to.
      */
      { source: '/why-setnayan', destination: '/features', permanent: true },
      { source: '/weddings', destination: '/realstories', permanent: true },
      { source: '/weddings/:slug', destination: '/realstories/:slug', permanent: true },
      // 2026-07-05 — vendor BENEFITS page renamed `/for-vendors` → `/vendors`
      // (owner routing change). Permanent (308) so already-indexed URLs,
      // bookmarks, email links, and QR codes carry their ranking to the new
      // path. EXACT source only — the static hero art still lives under
      // `public/for-vendors/*.avif`, so a `:path*` catch-all would break those
      // asset URLs. Marketplace subpaths (`/vendors/*` → /explore) are handled
      // separately in middleware.ts.
      { source: '/for-vendors', destination: '/vendors', permanent: true },
      // 2026-07-16 — Storytellers hub (PR-D · council verdict): /storytellers
      // is a SPEAKABLE WORD, not a page — it redirects into the "From Our
      // Storytellers" shelf on the single stories hub, so creators/marketing
      // (and the /pricing "Creators — Free" callout) have a link target with
      // zero second page to maintain. Never indexable on its own. TEMPORARY
      // (307) on purpose: the verdict's Phase S4 leaves room for a future
      // standalone page once chapter volume outgrows the shelf — a permanent
      // redirect would be cached against that promotion.
      { source: '/storytellers', destination: '/realstories#storytellers', permanent: false },
      // 2026-07-25 — Live Studio route rename: the customer-facing surface moved
      // from `/studio/live-studio-roam` → `/studio/live-studio-control` (owner:
      // "one unified controller, not Cast-vs-Roam"). Redirect the old path (detail
      // page AND the /setup controller, via :path*) so bookmarks / in-app deep
      // links never 404. TEMPORARY (307): the whole surface is still behind a dark
      // flag, so a permanent redirect shouldn't be cached against a future retarget.
      {
        source: '/dashboard/:eventId/studio/live-studio-roam/:path*',
        destination: '/dashboard/:eventId/studio/live-studio-control/:path*',
        permanent: false,
      },
      {
        source: '/dashboard/:eventId/studio/live-studio-roam',
        destination: '/dashboard/:eventId/studio/live-studio-control',
        permanent: false,
      },
    ];
  },
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
  // Don't generate full source maps until a SENTRY_AUTH_TOKEN exists to upload
  // them. Without the token the maps can't reach Sentry anyway, so emitting
  // them is pure wasted build work (a real memory + time cost on the #1258 OOM-
  // prone build). `disable` is keyed off the token, so this self-re-enables the
  // moment the owner provisions one; `deleteSourcemapsAfterUpload` then keeps
  // the maps out of the deployed bundle once upload is live.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
