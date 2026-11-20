import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import type { Byline, LinkCard } from '@/lib/articles.server';
import { segmentParagraph } from '@/lib/article-links';

/**
 * Small, server-rendered pieces shared by the feed and the article page (drawing v15 · Articles · An article).
 * Text and links only: a setnayan.com link becomes a card read from our own data (where we can place it); an
 * outside link is ONLY a link — no card, no preview, no outside image (owner 2026-11-17).
 */

/** "2h" · "3d" · "17 Nov" — the feed's own short time, in Manila. A Journal post always shows its date (drawing). */
export function articleWhen(iso: string | null, now: Date = new Date(), dated = false): string {
  if (!iso) return '';
  if (dated) return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}

/** The writer's name — a shop wears the Supplier mark; Setnayan's own posts read "Setnayan Journal". */
export function BylineName({ byline }: { byline: Byline }) {
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${byline.kind === 'journal' ? 'text-mulberry' : 'text-ink'}`}>
      {byline.name}
      {byline.kind === 'shop' ? (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-ink/80">
          <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
          Supplier
        </span>
      ) : null}
    </span>
  );
}

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Link
          key={t}
          href={`/articles?tag=${encodeURIComponent(t)}`}
          className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-medium text-ink/80 hover:bg-ink/[0.1]"
        >
          {t}
        </Link>
      ))}
    </span>
  );
}

/** One paragraph, with setnayan.com links made clickable and outside links left as words. */
export function ArticleParagraph({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/90">
      <Segments text={text} />
    </p>
  );
}

function Segments({ text }: { text: string }) {
  return (
    <>
      {segmentParagraph(text).map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i}>{seg.text}</span>
        ) : seg.kind === 'setnayan' ? (
          <Link key={i} href={seg.path} className="text-link underline decoration-ink/25 underline-offset-2">
            {seg.text}
          </Link>
        ) : (
          // An outside link is ONLY a link (owner 2026-11-17: "Outside link will only be a link"): no card, no
          // preview, nothing fetched. Opened in a new tab, and `nofollow ugc` because a reader wrote it, not us.
          <a
            key={i}
            href={/^https?:\/\//i.test(seg.text) ? seg.text : `https://${seg.text}`}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            className="break-all text-link underline decoration-ink/25 underline-offset-2"
          >
            {seg.text}
          </a>
        ),
      )}
    </>
  );
}

/** A setnayan.com link as a card — its picture read from that page's own row (a shop's logo), never from outside. */
export function LinkCardView({ card }: { card: LinkCard }) {
  return (
    <Link
      href={card.path}
      className="sn-frame flex items-center gap-3 p-3"
      data-link-card={card.kind}
    >
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL; next/image re-signs per render
        <img src={card.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink/[0.06] text-sm font-semibold text-ink/70">
          {card.title.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[12px] text-ink/70">{card.kind === 'shop' ? 'Shop' : 'Article'} · setnayan.com</span>
        <span className="block truncate text-sm font-semibold text-ink">{card.title}</span>
        {card.line ? <span className="block truncate text-[12px] text-ink/70">{card.line}</span> : null}
      </span>
    </Link>
  );
}

/** Two letters for a reply's round mark ("tagaytaybride" → "TA", "Taal Vista Hotel" → "TV"). */
export function initialsOf(name: string): string {
  const words = name.replace(/[._]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const two = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return two.toUpperCase();
}
