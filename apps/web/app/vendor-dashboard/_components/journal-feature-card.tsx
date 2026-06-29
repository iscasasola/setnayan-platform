import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import {
  PLACEMENT_LABELS,
  type VendorJournalFeature,
} from '@/lib/journal-spotlights';

/**
 * JournalFeatureCard — the read-only "You're featured in the Journal" list on
 * the vendor-dashboard HOME (Wave 5 Editorial & Journal Spotlights · the vendor
 * half of the loop).
 *
 * When the Setnayan editorial team credits a vendor inside a published Journal
 * article, the (approved) credit shows up here with a link to the live article.
 * Mirrors the Real-Stories vendor page shape (read-only, ownership-scoped). The
 * parent dashboard passes the already-fetched approved features in; an empty
 * list renders nothing (the home page has no "coming soon" placeholder for it,
 * matching the Spotlight Award banner's render-nothing-when-empty behaviour).
 *
 * Pure presentation — drafts/pending credits never reach here (the read is
 * approved-only at the RLS + query layer).
 */

export function JournalFeatureCard({
  features,
}: {
  features: VendorJournalFeature[];
}) {
  if (!features || features.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
          You&rsquo;re featured in the Journal
        </h2>
        <Link
          href="/blog"
          className="text-xs text-terracotta hover:underline"
        >
          Read the Journal →
        </Link>
      </div>

      <ul className="space-y-2">
        {features.map((f) => {
          const title = f.article_title ?? 'A Setnayan Journal story';
          return (
            <li key={f.spotlight_id}>
              <Link
                href={`/blog/${f.blog_slug}`}
                target="_blank"
                className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:bg-ink/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
                        {PLACEMENT_LABELS[f.placement]}
                      </span>
                      {f.is_sponsored ? (
                        <span className="inline-flex items-center rounded-full bg-ink/[0.07] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink/65">
                          Sponsored
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">
                      {title}
                    </p>
                  </div>
                </div>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-ink/40"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
