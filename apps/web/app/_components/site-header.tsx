'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isVendorContext(pathname: string): boolean {
  return pathname === '/for-vendors' || pathname.startsWith('/for-vendors/');
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const signupHref = isVendorContext(pathname) ? '/signup?as=vendor' : '/signup';

  return (
    <header className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
          >
            S
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
            Setnayan
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Sign in
          </Link>
          <Link href={signupHref} className="button-primary h-10 px-5 text-sm">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
