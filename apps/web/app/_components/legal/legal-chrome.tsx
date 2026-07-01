import Link from 'next/link';
import { Logo } from '@/app/_components/logo';
import { CookieSettingsLink } from './cookie-settings-link';

// Shared chrome for the standalone legal/compliance pages (privacy, terms,
// refunds, cookies, acceptable-use). Matches the long-standing privacy/terms
// scaffold so every policy page reads identically. The footer carries the
// full legal link set so a visitor can hop between policies without going
// back to the homepage.

export function LegalHeader() {
  return (
    <header className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center text-ink">
          <Logo height={32} withWordmark />
        </Link>
      </div>
    </header>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-ink/5">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-8 text-xs text-ink/55 sm:px-6 lg:px-8">
        <Link href="/" className="hover:text-ink">Home</Link>
        <Link href="/help" className="hover:text-ink">Help</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/refunds" className="hover:text-ink">Refunds</Link>
        <Link href="/cookies" className="hover:text-ink">Cookie policy</Link>
        <Link href="/acceptable-use" className="hover:text-ink">Acceptable use</Link>
        <CookieSettingsLink className="hover:text-ink" />
      </div>
    </footer>
  );
}

export function LegalLayout({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-cream">
      <LegalHeader />
      <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-xs text-ink/55">{meta}</p>
        </header>
        {children}
      </article>
      <LegalFooter />
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-ink/75">{children}</div>
    </section>
  );
}
