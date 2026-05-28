import type { Metadata, Viewport } from 'next';
import {
  Cormorant_Garamond,
  Manrope,
  DM_Mono,
  Saira_Condensed,
  Geist,
  Instrument_Serif,
  JetBrains_Mono,
} from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Suspense } from 'react';
import { ClientTypeDetector } from './_components/client-type-detector';
import { DemoModeBanner } from './_components/demo-mode-banner';
import { PilotModeBanner } from './_components/pilot-mode-banner';
import { Providers } from './providers';
import { themeBootstrapScript } from './_components/theme-provider';

// Brand typography — iteration 0015 § Brand. Self-hosted via next/font/google
// so the fonts ship in the same render lifecycle as the page (no FOUT, no
// extra DNS roundtrip to fonts.gstatic.com on cold cache). The CSS variables
// are wired into `tailwind.config.ts` so `font-display` / `font-sans` /
// `font-mono` Tailwind utilities resolve to the right family at build time.
//
//   - Cormorant Garamond → display (h1/h2 hero + section titles). Editorial
//     serif with the elegant wedding-invitation register the spec calls for.
//   - Manrope            → body sans (paragraphs, buttons, nav, form fields).
//     Modern geometric humanist; reads well on small screens (PH is 80%+
//     mobile per DataReportal Digital 2024 Philippines).
//   - DM Mono            → accent mono (eyebrows, label chips, /sɛt na jan/).
//     Brand mono distinct from the dev-tools SF Mono fallback.
//
// `display: 'swap'` means the system fallback paints immediately while the
// webfont streams, so LCP measurements stay anchored to first paint instead
// of font load. The weight subsets are minimal — only the weights we actually
// reference — so payload stays under ~80KB total for all three families.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono',
});

// v2.1 marketing typography (Setnayan Vendor Keynote template package · CLAUDE.md
// 2026-05-28 11th row "v2.1 template package adoption"). Loaded alongside the
// existing editorial stack — marketing surfaces opt-in via `var(--font-condensed)`
// / `var(--font-sans-marketing)` / `var(--font-serif-marketing)` / `var(--font-mono-marketing)`
// inline styles or arbitrary Tailwind classes. Dashboard chrome keeps existing
// Cormorant / Manrope / DM Mono so the 200+ shipped components don't churn.
//
//   - Saira Condensed  → display headlines (WWDC keynote register · Setnayan
//     v2 brand mark "SET NA 'YAN" wordmark). Weights 400/600/700/800.
//   - Geist            → marketing body sans (more geometric than Manrope).
//   - Instrument Serif → editorial accent serif (italic supported).
//   - JetBrains Mono   → marketing mono (eyebrows, label chips, /sɛt na jan/
//     phonetic spelling).
const sairaCondensed = Saira_Condensed({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700', '800'],
  variable: '--font-condensed',
});

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans-marketing',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif-marketing',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono-marketing',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Setnayan',
    template: '%s · Setnayan',
  },
  description:
    "Set na 'yan. Setnayan is the Philippines-first life-events platform. V1 weddings.",
  applicationName: 'Setnayan',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.svg', type: 'image/svg+xml', sizes: '192x192' },
      { url: '/icon-512.svg', type: 'image/svg+xml', sizes: '512x512' },
    ],
    apple: [{ url: '/icon-192.svg', sizes: '192x192' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Setnayan',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    siteName: 'Setnayan',
    locale: 'en_PH',
    images: [{ url: '/icon-512.svg', width: 512, height: 512, alt: 'Setnayan' }],
  },
  twitter: {
    card: 'summary',
    images: ['/icon-512.svg'],
  },
};

// 2026-05-22 brand pivot: theme-color responds to light vs dark mode so iOS
// Safari + Android Chrome tint the URL bar to match the active palette.
// Light → Facebook white. Dark → Facebook dark surface.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#18191A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

function getOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Preconnect to backend origins the marketing + dashboard surfaces will
  // hit within the first second — saves the cold DNS+TCP+TLS roundtrip on
  // the first auth check, first analytics event, and first signed-URL fetch.
  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const posthogOrigin = getOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  const r2Origin = getOrigin(process.env.R2_PUBLIC_URL);

  return (
    <html
      lang="en-PH"
      className={`${cormorant.variable} ${manrope.variable} ${dmMono.variable} ${sairaCondensed.variable} ${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          FOUC-safe theme bootstrap — 2026-05-22 brand pivot.
          Runs synchronously before first paint, reads localStorage.theme,
          applies `dark` class to <html> when resolved theme is dark. Keeps
          light/dark toggles from flashing the wrong palette on cold loads.
          See _components/theme-provider.tsx for the algorithm.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
        {posthogOrigin ? (
          <>
            <link rel="preconnect" href={posthogOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={posthogOrigin} />
          </>
        ) : null}
        {r2Origin ? (
          <>
            <link rel="preconnect" href={r2Origin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={r2Origin} />
          </>
        ) : null}
      </head>
      <body className="min-h-dvh bg-cream font-sans text-ink antialiased">
        <PilotModeBanner />
        {/*
          DemoModeBanner is admin-only (the server component itself
          short-circuits to null for non-admin sessions, even if a stale
          cookie is present). Wrapped in Suspense so anonymous + non-admin
          visitors don't wait on the cookie + auth lookup — the public
          marketing surface stays as fast as before; only admin sessions
          actually hit the banner-render path.
        */}
        <Suspense fallback={null}>
          <DemoModeBanner />
        </Suspense>
        <Providers>{children}</Providers>
        <ClientTypeDetector />
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }`}
        </Script>
      </body>
    </html>
  );
}
