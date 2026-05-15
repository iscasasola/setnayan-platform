import Link from 'next/link';
import { Apple } from 'lucide-react';

// Footer matching the main marketing pages (apps/web/app/page.tsx +
// apps/web/app/for-vendors/page.tsx use the same shape). Kept inline
// rather than promoted to a shared component because PR #57 is rewriting
// the homepage layout this week and would conflict with a shared change.
// Once both PRs land, this can be lifted into _components/site-footer.tsx
// in a follow-up cleanup.

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-[10px] font-semibold text-cream"
          >
            S
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Setnayan &middot; setnayan.com
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>&copy; 2026 Setnayan</span>
          <span aria-hidden>&middot;</span>
          <span>Made in the Philippines</span>
          <span aria-hidden>&middot;</span>
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/for-vendors" className="hover:text-ink">
            For vendors
          </Link>
          <Link href="/download" className="inline-flex items-center gap-1 hover:text-ink">
            <Apple aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Mac app
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
