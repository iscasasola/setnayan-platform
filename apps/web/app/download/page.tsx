import Link from 'next/link';
import { AppWindow, Globe, ShieldCheck, Zap } from 'lucide-react';
import { resolveDesktopRelease } from '@/lib/desktop-release-server';
import { DESKTOP_ENCODER_READINESS_NOTICE } from '@/lib/live-studio-readiness';
import { getNavSlotMap } from '@/lib/nav-registry';
import {
  RevealGroup,
  LineRevealH1,
  AppWindowHero,
  MagneticDownloadButton,
  PlatformCompatBanner,
} from './_download-motion';

// GEO Phase G5 (2026-05-28) — canonical URL + openGraph block added.
// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
// S10: also bounds how stale the R2-resolved release can be — a fresh release
// shows up within this window, never instantly and never never.
export const revalidate = 3600;

export const metadata = {
  title: 'Download Setnayan for Mac or Windows',
  description:
    'Install Setnayan as a native desktop app for Mac or Windows. It opens straight to your account — your guest list, invitations, planner and seating in their own window. iOS and Android shells on the V1.5 roadmap.',
  alternates: { canonical: '/download' },
  openGraph: {
    title: 'Download Setnayan for Mac or Windows',
    description:
      'A native desktop app for Mac or Windows that opens straight to your Setnayan account. iOS and Android on the V1.5 roadmap.',
    url: '/download',
  },
};

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DownloadPage() {
  // S10: resolves from the setnayan-media R2 bucket (see lib/desktop-release.ts)
  // instead of a hardcoded object pointing at one committed .dmg. `release` is
  // `null` when R2 can't be reached or hasn't published yet — rendered as an
  // honest "not available right now" state below, never a link that 404s.
  const release = await resolveDesktopRelease();
  const mac = release?.mac.aarch64 ?? null;
  const windows = release?.windows ?? null;
  const macSizeLabel = mac ? formatMb(mac.sizeBytes) : null;
  const winSizeLabel = windows ? formatMb(windows.sizeBytes) : null;

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
  const winDownloadLabel = 'Download for Windows';

  return (
    <main className="min-h-dvh bg-cream text-ink">

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

            {/* READINESS GATE — rendered verbatim, above both download buttons
                (S10 guard test asserts the exact string). Not a claim about the
                app in general: the OS floor for Setnayan's own future in-app
                encoder specifically. See DESKTOP_ENCODER_READINESS_NOTICE's
                docblock in lib/live-studio-readiness.ts for why this is a
                separate fact from "you need OBS today". The OBS link itself
                lives in PlatformCompatBanner just below, next to the
                best-effort per-visitor nudge, rather than mid-sentence here. */}
            <p data-reveal-item className="max-w-md text-xs leading-relaxed text-ink/50">
              {DESKTOP_ENCODER_READINESS_NOTICE}
            </p>

            <PlatformCompatBanner />

            {mac ? (
              <div data-reveal-item className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
                <MagneticDownloadButton href="/api/download/mac" label={macDownloadLabel} sizeLabel={macSizeLabel!} />
                {windows ? (
                  <MagneticDownloadButton
                    href="/api/download/windows"
                    label={winDownloadLabel}
                    sizeLabel={winSizeLabel!}
                    variant="secondary"
                  />
                ) : null}
                <Link
                  href="https://setnayan.com"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  <Globe aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Use it on the web instead
                </Link>
              </div>
            ) : (
              // Honest degraded state — never a link that 404s. See
              // lib/desktop-release.ts: resolveDesktopRelease() returns null when
              // R2 hasn't published a release yet or can't be reached.
              <div data-reveal-item className="max-w-md rounded-xl border border-ink/12 bg-ink/[0.03] px-4 py-3 text-sm text-ink/65">
                The desktop download isn&rsquo;t available right now. Try again shortly, or{' '}
                <Link href="https://setnayan.com" className="text-terracotta underline-offset-4 hover:underline">
                  use Setnayan on the web
                </Link>{' '}
                in the meantime.
              </div>
            )}

            {mac ? (
              <div data-reveal-item className="space-y-1.5 pt-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
                  v{release!.version} · {macSizeLabel} · Apple Silicon · Released {release!.publishedAt}
                  {windows ? ` · Windows build ${winSizeLabel}` : ''}
                </p>
                {mac.signed ? (
                  <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">
                    <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Signed &amp; notarized by Apple
                  </p>
                ) : (
                  // Truthful, not alarming: an ad-hoc-signed build opens fine on
                  // first launch with one extra click (see "First launch" below),
                  // it is simply not Apple-notarized YET (S11).
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/40">
                    Not yet notarized by Apple — see &ldquo;First launch&rdquo; below
                  </p>
                )}
                {windows && !windows.signed ? (
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/40">
                    Windows build is unsigned — Windows SmartScreen will warn on first run
                  </p>
                ) : null}
              </div>
            ) : null}
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
                  {mac?.signed ? 'Just double-click to open.' : 'One extra click, first time only.'}
                </h3>
                {mac?.signed ? (
                  <>
                    <p className="mt-3 text-ink/65">
                      Because Setnayan is notarized by Apple, it opens like any trusted
                      Mac app — no right-click, no Gatekeeper workarounds.
                    </p>
                    <p className="mt-3 text-ink/65">
                      The first time, macOS may ask once to confirm you downloaded it
                      from the internet — click <span className="text-ink/80">Open</span>.
                      That&rsquo;s it.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-ink/65">
                    This build isn&rsquo;t Apple-notarized yet, so macOS will warn once on first
                    open. Right-click the app in Applications and choose{' '}
                    <span className="text-ink/80">Open</span>, then confirm — after that it
                    opens normally.
                  </p>
                )}
                {windows && !windows.signed ? (
                  <p className="mt-3 text-ink/65">
                    On Windows, SmartScreen will warn too (the build isn&rsquo;t
                    code-signed yet) — click{' '}
                    <span className="text-ink/80">More info</span>, then{' '}
                    <span className="text-ink/80">Run anyway</span>.
                  </p>
                ) : null}
              </Note>

              <Note data-reveal-item label="What you need">
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink">
                  System requirements.
                </h3>
                <ul className="mt-4 divide-y divide-ink/8">
                  <Req>Apple-silicon Mac (M1 or newer) on macOS 14 or later, with the Safari 26 update</Req>
                  {windows ? <Req>Or Windows 10/11 with hardware video encoding</Req> : null}
                  <Req>An internet connection — it opens your account in a native window</Req>
                </ul>
                <p className="mt-4 text-sm text-ink/55">
                  On an Intel Mac, or an older macOS? Use{' '}
                  <a
                    href="https://obsproject.com/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-terracotta underline-offset-4 hover:underline"
                  >
                    OBS
                  </a>{' '}
                  or{' '}
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

