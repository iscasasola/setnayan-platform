import Link from 'next/link';
import { Logo } from '@/app/_components/logo';
import { AppWindow, ArrowRight, Globe, ShieldCheck, Zap } from 'lucide-react';
import { DESKTOP_RELEASE } from '@/lib/desktop-release';
import { SiteHeader } from '@/app/_components/site-header';
import { getNavSlotMap } from '@/lib/nav-registry';
import {
  RevealGroup,
  LineRevealH1,
  AppWindowHero,
  MagneticDownloadButton,
} from './_download-motion';

// GEO Phase G5 (2026-05-28) — canonical URL + openGraph block added.
// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const revalidate = 3600;

export const metadata = {
  title: 'Download Setnayan for Mac',
  description:
    'Install Setnayan as a native macOS app for Apple Silicon. It opens straight to your account — your guest list, invitations, planner and seating in their own window. iOS and Android shells on the V1.5 roadmap.',
  alternates: { canonical: '/download' },
  openGraph: {
    title: 'Download Setnayan for Mac',
    description:
      'A native macOS app for Apple Silicon that opens straight to your Setnayan account. iOS and Android on the V1.5 roadmap.',
    url: '/download',
  },
};

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DownloadPage() {
  const mac = DESKTOP_RELEASE.mac.aarch64;
  const sizeLabel = formatMb(mac.sizeBytes);

  // Nav/icon/menu-registry overlay for the "Download for Mac" CTA label
  // (public.download.mac-api) — applied to the CTA + the step-1 instruction.
  // Label-only + fails open: this is a server component, so it can't call the
  // client-only navIconComponent — the icons stay hardcoded in code; only the
  // button text is admin-renamable from /admin/menus. href + size suffix stay in
  // code too. NOTE: this page is ISR (revalidate=3600), so an admin label edit
  // propagates within the 1hr revalidation window (the registry data cache busts
  // instantly via NAV_REGISTRY_TAG, but the page's prerendered HTML refreshes on
  // the next ISR pass), not on the next request.
  const navSlots = await getNavSlotMap();
  const macDownloadLabel = navSlots['public.download.mac-api']?.label ?? 'Download for Mac';

  return (
    <main className="min-h-dvh bg-cream text-ink">
      <SiteHeader />

      {/* ───────────────────────── Hero ─────────────────────────
          Airy two-column editorial split. Copy leads with a hairline eyebrow + a
          serif line-reveal headline; the floating macOS app window (the page's
          ONE motion moment) opens on the right and the Setnayan dock icon
          launch-bounces — the product story made literal. */}
      <section>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1fr,1fr] lg:gap-16 lg:px-8 lg:py-28">
          <RevealGroup className="space-y-7">
            <LineRevealH1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink sm:text-6xl">
              Setnayan, on your Mac.
            </LineRevealH1>

            <p data-reveal-item className="max-w-md text-lg leading-relaxed text-ink/65">
              In its own window, with its own Dock icon — your guest list,
              invitations, planner and seating, one launch away. It opens straight
              to your account, no browser tab in sight.
            </p>

            <div data-reveal-item className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
              <MagneticDownloadButton label={macDownloadLabel} sizeLabel={sizeLabel} />
              <Link
                href="https://setnayan.com"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                <Globe aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Use it on the web instead
              </Link>
            </div>

            <div data-reveal-item className="space-y-1.5 pt-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
                v{DESKTOP_RELEASE.version} · {sizeLabel} · Apple Silicon (M1 – M4) · Released{' '}
                {DESKTOP_RELEASE.publishedAt}
              </p>
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Signed &amp; notarized by Apple
              </p>
            </div>
          </RevealGroup>

          <AppWindowHero />
        </div>
      </section>

      {/* ───────────────────── Why open it on your Mac ─────────────────────
          The substance the page was missing — three quiet value columns, gold
          icon + one confident line each. Hairline-topped, no boxes. */}
      <section className="border-t border-ink/8">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-14 max-w-xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">
              The same Setnayan, closer to hand.
            </h2>
          </div>

          <RevealGroup stagger={0.09}>
            <div className="grid gap-12 sm:grid-cols-3 sm:gap-10">
              <Value
                icon={<AppWindow aria-hidden className="h-5 w-5" strokeWidth={1.5} />}
                title="Its own window & Dock icon"
                body="Lives in your Dock like any real Mac app. ⌘-Tab straight to it — no hunting through browser tabs."
              />
              <Value
                icon={<Zap aria-hidden className="h-5 w-5" strokeWidth={1.5} />}
                title="Opens straight to your plan"
                body="No landing page, no sign-in wall every time. Launch it and you're already inside your wedding."
              />
              <Value
                icon={<ShieldCheck aria-hidden className="h-5 w-5" strokeWidth={1.5} />}
                title="Trusted & always signed in"
                body="Signed with an Apple Developer ID and notarized by Apple. Sign in once — it remembers you after that."
              />
            </div>
          </RevealGroup>
        </div>
      </section>

      {/* ─────────────────────── Install steps ───────────────────────
          Borderless editorial grid: oversized champagne numerals, hairline top
          rule per column, no boxes. Reads as one calm row. */}
      <section className="border-t border-ink/8">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-14 max-w-xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">
              Four steps, done.
            </h2>
          </div>

          <RevealGroup stagger={0.07}>
            <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              <Step
                n="01"
                title="Download"
                body={
                  <>
                    Click <span className="text-ink">{macDownloadLabel}</span>. It
                    lands in your Downloads folder.
                  </>
                }
              />
              <Step
                n="02"
                title="Open the .dmg"
                body="Double-click the file. A window opens with the Setnayan icon and an Applications shortcut."
              />
              <Step
                n="03"
                title="Drag to Applications"
                body="Drop the Setnayan icon onto the Applications shortcut. That installs it."
              />
              <Step
                n="04"
                title="Open it"
                body="Eject the disk, open Applications, and launch Setnayan. Sign in once — it remembers you next time."
              />
            </ol>
          </RevealGroup>
        </div>
      </section>

      {/* ─────────────────────── Good to know ───────────────────────
          Two quiet columns separated by a hairline. No amber alert card —
          the note carries its own weight in type. */}
      <section className="border-t border-ink/8">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <RevealGroup stagger={0.1}>
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <Note data-reveal-item label="First launch">
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink">
                  Just double-click to open.
                </h3>
                <p className="mt-3 text-ink/65">
                  Because Setnayan is notarized by Apple, it opens like any trusted
                  Mac app — no right-click, no Gatekeeper workarounds.
                </p>
                <p className="mt-3 text-ink/65">
                  The first time, macOS may ask once to confirm you downloaded it
                  from the internet — click <span className="text-ink/80">Open</span>.
                  That&rsquo;s it.
                </p>
              </Note>

              <Note data-reveal-item label="What you need">
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink">
                  System requirements.
                </h3>
                <ul className="mt-4 divide-y divide-ink/8">
                  <Req>Apple Silicon Mac (M1, M2, M3 or M4)</Req>
                  <Req>macOS 11 Big Sur or newer</Req>
                  <Req>An internet connection — it opens your account in a native window</Req>
                </ul>
                <p className="mt-4 text-sm text-ink/55">
                  On an Intel Mac? Use{' '}
                  <Link
                    href="https://setnayan.com"
                    className="text-terracotta underline-offset-4 hover:underline"
                  >
                    setnayan.com
                  </Link>{' '}
                  instead — same experience, no install.
                </p>
              </Note>
            </div>
          </RevealGroup>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Value({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div data-reveal-item className="border-t border-ink/12 pt-6">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta-700">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/60">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li data-reveal-item className="border-t border-ink/12 pt-5">
      <span className="block font-mono text-3xl font-semibold leading-none tracking-tight text-terracotta/35">
        {n}
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{body}</p>
    </li>
  );
}

function Note({
  label,
  children,
  ...rest
}: {
  label: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest}>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-terracotta">
        {label}
      </p>
      {children}
    </div>
  );
}

function Req({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3 py-3 text-ink/70">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terracotta" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-ink/8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-ink hover:text-ink/80">
          <Logo height={22} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Setnayan · setnayan.com
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
            Home <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          </Link>
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
