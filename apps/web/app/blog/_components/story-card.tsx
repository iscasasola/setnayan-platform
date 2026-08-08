import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  blogCategoryLabel,
  readingMinutes,
  type BlogArticle,
} from '@/lib/blog';

// The Journal's card grammar — EXTRACTED, not redrawn (2026-08-08, Warm
// Editorial port E4).
//
// This is a pure move out of app/blog/page.tsx: `MONTHS` + `formatDate`,
// `Eyebrow`, `metaLine` and `StoryCard` arrived here with every class string
// byte-identical to what /blog already shipped. Nothing below is new design.
//
// WHY IT MOVED: the "From the Journal" rail on /realstories
// (app/realstories/_components/journal-rail.tsx) must render a REAL Journal
// card, not a lookalike. Duplicating the markup would fork the grammar — the
// two surfaces would drift the first time either is touched, which is the
// paid-twice mistake the design programme exists to stop.
//
// Consumers: app/blog/page.tsx (the index grid + LeadCard's eyebrow/meta) and
// app/realstories/_components/journal-rail.tsx.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
      {children}
    </span>
  );
}

export function metaLine(article: BlogArticle): string {
  return `${formatDate(article.publishedAt)} · ${readingMinutes(article.blocks)} min read`;
}

// Photo-led story card for the grid.
export function StoryCard({ article }: { article: BlogArticle }) {
  return (
    <Link href={`/blog/${article.slug}`} className="group flex flex-col">
      <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-ink/5">
        <Image
          src={article.cover}
          alt={article.coverAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        <Eyebrow>{blogCategoryLabel(article.category)}</Eyebrow>
        <h3 className="mt-2 font-display text-xl font-medium leading-[1.16] tracking-tight text-ink group-hover:text-terracotta-700">
          {article.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">
          {article.excerpt}
        </p>
        <p className="mt-3 text-xs text-ink/45">{metaLine(article)}</p>
      </div>
    </Link>
  );
}
