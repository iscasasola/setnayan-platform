import Link from 'next/link';
import { Logo } from '@/app/_components/logo';
import {
  Apple,
  Download,
  Globe,
  ShieldAlert,
  Cpu,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { DESKTOP_RELEASE } from '@/lib/desktop-release';
import { SiteHeader } from '@/app/_components/site-header';

export const metadata = {
  title: 'Download Setnayan for Mac',
  description:
    'Install Setnayan as a native macOS app for Apple Silicon. Same Setnayan experience, in its own window.',
};

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DownloadPage() {
  const mac = DESKTOP_RELEASE.mac.aarch64;

  return (
    <main className="min-h-dvh bg-cream">
      <SiteHeader />

      <section className="border-b border-ink/5">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr,1fr] lg:px-8">
          <div className="space-y-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Setnayan · macOS app · v{DESKTOP_RELEASE.version}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Setnayan, on your Mac.
            </h1>
            <p className="max-w-prose text-lg text-ink/70">
              The same Setnayan you know &mdash; guest lists, QR invitations, planner,
              seating &mdash; living in its own window with its own dock icon.
              Built for Apple Silicon.
            </p>

            <div className="flex flex-wrap gap-3">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/download/mac"
                className="button-primary inline-flex items-center gap-2"
              >
                <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Download for Mac &middot; {formatMb(mac.sizeBytes)}
              </a>
              <Link
                href="https://setnayan.com"
                className="button-secondary inline-flex items-center gap-2"
              >
                <Globe aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Use on the web instead
              </Link>
            </div>

            <p className="text-xs text-ink/55">
              Apple Silicon (M1 / M2 / M3 / M4) only. Released{' '}
              {DESKTOP_RELEASE.publishedAt}.
            </p>
          </div>

          <DownloadCard filename={mac.filename} sizeBytes={mac.sizeBytes} />
        </div>
      </section>

      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Install in 30 seconds
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Four steps, done.
            </h2>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Step
              n={1}
              title="Download"
              body={
                <>
                  Click <span className="font-medium">Download for Mac</span> above.
                  Your browser saves it to your Downloads folder.
                </>
              }
            />
            <Step
              n={2}
              title="Open the .dmg"
              body="Double-click the downloaded file. A window appears with the Setnayan icon and an Applications shortcut."
            />
            <Step
              n={3}
              title="Drag to Applications"
              body="Drag the Setnayan icon onto the Applications shortcut. That installs it."
            />
            <Step
              n={4}
              title="Eject + open"
              body={
                <>
                  Right-click the disk icon on your desktop &rarr; Eject. Then open
                  Applications &rarr; double-click <span className="font-medium">Setnayan</span>.
                </>
              }
            />
          </ol>
        </div>
      </section>

      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card
              Icon={ShieldAlert}
              tone="amber"
              title="First-launch warning is normal"
            >
              <p className="text-sm text-ink/70">
                The first time you open Setnayan, macOS may say{' '}
                <span className="font-medium">
                  &ldquo;Setnayan cannot be opened because the developer cannot be
                  verified&rdquo;
                </span>
                . That&rsquo;s because the app is signed by us but not yet notarized
                by Apple.
              </p>
              <p className="mt-2 text-sm text-ink/70">
                <span className="font-medium">To open anyway:</span> in Finder, find{' '}
                Setnayan in Applications, <span className="font-medium">right-click</span>{' '}
                (or Control-click) the icon &rarr; choose{' '}
                <span className="font-medium">Open</span> &rarr; click{' '}
                <span className="font-medium">Open</span> in the dialog. You only need
                to do this the first time.
              </p>
            </Card>

            <Card Icon={Cpu} tone="cream" title="System requirements">
              <ul className="space-y-2 text-sm text-ink/70">
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                    strokeWidth={1.75}
                  />
                  Apple Silicon Mac (M1, M2, M3, or M4 chip)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                    strokeWidth={1.75}
                  />
                  macOS 11 (Big Sur) or newer
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                    strokeWidth={1.75}
                  />
                  Internet connection (the app loads setnayan.com inside a native
                  window)
                </li>
              </ul>
              <p className="mt-3 text-xs text-ink/55">
                Not sure if your Mac is Apple Silicon? Click the Apple menu &rarr;{' '}
                <span className="font-medium">About This Mac</span>. If the chip
                starts with M1/M2/M3/M4, you&rsquo;re good. If it says &ldquo;Intel
                Core,&rdquo; please use the web app at{' '}
                <Link
                  href="https://setnayan.com"
                  className="text-terracotta underline-offset-4 hover:underline"
                >
                  setnayan.com
                </Link>
                .
              </p>
            </Card>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function DownloadCard({
  filename,
  sizeBytes,
}: {
  filename: string;
  sizeBytes: number;
}) {
  return (
    <div className="mx-auto w-full max-w-md self-center rounded-3xl border border-ink/10 bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(26,26,26,0.25)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta text-cream">
            <Apple aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Setnayan.app</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              macOS &middot; Apple Silicon
            </p>
          </div>
        </div>
        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          v{DESKTOP_RELEASE.version}
        </span>
      </div>

      <dl className="mt-6 space-y-2 border-t border-ink/10 pt-4 text-sm">
        <Row label="File">
          <code className="font-mono text-xs text-ink/75">{filename}</code>
        </Row>
        <Row label="Size">{(sizeBytes / 1024 / 1024).toFixed(1)} MB</Row>
        <Row label="Released">{DESKTOP_RELEASE.publishedAt}</Row>
        <Row label="Verified by">SHA-256 + Tauri code signature</Row>
      </dl>

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/download/mac"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream hover:bg-terracotta-600"
      >
        <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Download for Mac
      </a>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </dt>
      <dd className="text-right text-ink/80">{children}</dd>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-5">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/15 font-mono text-xs font-semibold text-terracotta-700">
        {n}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink/70">{body}</p>
    </li>
  );
}

function Card({
  Icon,
  tone,
  title,
  children,
}: {
  Icon: typeof ShieldAlert;
  tone: 'amber' | 'cream';
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-300/60 bg-amber-50/80'
      : 'border-ink/10 bg-cream';
  return (
    <div className={`rounded-xl border p-6 ${toneClass}`}>
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
            tone === 'amber'
              ? 'bg-amber-200/60 text-amber-900'
              : 'bg-terracotta/10 text-terracotta'
          }`}
        >
          <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-ink hover:text-ink/80">
          <Logo height={24} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Setnayan &middot; setnayan.com
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
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
