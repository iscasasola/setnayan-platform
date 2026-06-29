import Link from 'next/link';
import { Apple } from 'lucide-react';

// Footer matching the main marketing pages (apps/web/app/page.tsx +
// apps/web/app/for-vendors/page.tsx use the same shape). Kept inline
// rather than promoted to a shared component because PR #57 is rewriting
// the homepage layout this week and would conflict with a shared change.
// Once both PRs land, this can be lifted into _components/site-footer.tsx
// in a follow-up cleanup.

// Marketing feature pages — surfaced here so they're reachable by clicking
// (added 2026-06-28). Public-facing names match each page's own title.
const FEATURE_LINKS: { href: string; label: string }[] = [
  { href: '/alaala', label: 'Alaala' },
  { href: '/papic', label: 'Papic' },
  { href: '/setnayan-ai', label: 'Setnayan AI' },
  { href: '/panood', label: 'Panood' },
  { href: '/pa3d', label: 'Pa3D' },
  { href: '/palogo', label: 'Animated Monogram' },
  { href: '/pawebsite', label: 'Wedding Website' },
];

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 border-t border-ink/10 pt-8 text-sm text-ink/55 sm:flex-row sm:items-baseline sm:gap-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
            Explore
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {FEATURE_LINKS.map((f) => (
              <Link key={f.href} href={f.href} className="hover:text-ink">
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
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
          <Link href="/realstories" className="hover:text-ink">
            Real Stories
          </Link>
          <Link href="/blog" className="hover:text-ink">
            Journal
          </Link>
          <Link href="/monogram" className="hover:text-ink">
            Monogram maker
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
