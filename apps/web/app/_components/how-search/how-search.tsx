import Link from 'next/link';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { HowHit } from '@/lib/how-search-core';
import { HOW_SEARCH_PLACEHOLDER } from '@/lib/how-search-words';
import { HowSearchRow } from './how-search-row';

/**
 * ONE SEARCH FOR "HOW DOES SETNAYAN WORK" — /help and /features both mount
 * this (owner, 25 Oct 2026: *"also the HELP and Features where we can
 * mazimize the app to be searchable"*; "one place for everything").
 *
 *   signed in   the thumb row (Discover's: Enter → this page's `?q=`, ✕ → back)
 *   signed out  the page's own field — a plain GET form, so it works with no JS
 *
 * The results draw IN PLACE, under the page head, and are marked
 * `data-search-results` so the shared search pin (`lib/search-pin.ts`) lands
 * the first one under the chrome. Help answers open in place (`<details>` —
 * no script); feature pages and guides link to their page.
 *
 * Server-rendered. The one client part (the signed-in row) is page-local.
 */
export function HowSearchField({
  q,
  signedIn,
  action,
  keep = {},
}: {
  q: string;
  signedIn: boolean;
  /** This page's own path — the words stay on it. */
  action: string;
  /** Other parameters the page keeps (the /help role tile). */
  keep?: Record<string, string | undefined>;
}) {
  if (signedIn) return <HowSearchRow key={q} q={q} />;
  return (
    <form role="search" action={action} method="get" className="relative" data-how-search="">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
        strokeWidth={1.75}
      />
      <input
        type="search"
        name="q"
        defaultValue={q}
        enterKeyHint="search"
        placeholder={HOW_SEARCH_PLACEHOLDER}
        aria-label={HOW_SEARCH_PLACEHOLDER}
        className="input-field w-full pl-9"
      />
    </form>
  );
}

export function HowSearchResults({
  q,
  hits,
  storiesFailed,
  clearHref,
  askHref,
}: {
  q: string;
  hits: ReadonlyArray<HowHit>;
  storiesFailed: boolean;
  /** This page without the words. */
  clearHref: string;
  /** The contact form. */
  askHref: string;
}) {
  if (hits.length === 0) {
    return (
      <div data-how-results="" data-search-none="" className="py-4">
        <p className="text-base font-semibold text-ink">Nothing matched “{q}”</p>
        {storiesFailed ? (
          <p className="mt-1 text-sm text-ink/65">Stories didn&rsquo;t load just now, so they weren&rsquo;t searched.</p>
        ) : null}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href={askHref} className="font-semibold text-terracotta underline-offset-4 hover:underline">
            Ask us
          </a>
          <Link href={clearHref} className="text-ink/60 underline-offset-4 hover:underline">
            Clear
          </Link>
        </p>
      </div>
    );
  }
  return (
    <section aria-label={`Results for ${q}`} data-how-results="" data-search-results="">
      <p className="text-xs text-ink/55">
        {hits.length} result{hits.length === 1 ? '' : 's'} for “{q}” ·{' '}
        <Link href={clearHref} className="underline underline-offset-2 hover:text-terracotta">
          Clear
        </Link>
      </p>
      {storiesFailed ? (
        <p className="mt-1 text-xs text-ink/55">Stories didn&rsquo;t load just now.</p>
      ) : null}
      <ul className="mt-2 divide-y divide-ink/10">
        {hits.map((h) => (
          <li key={`${h.kind}:${h.href}`} data-how-kind={h.kind}>
            {h.kind === 'help' ? <HelpAnswerRow hit={h} /> : <LinkRow hit={h} />}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink/60">
        Not here?{' '}
        <a href={askHref} className="font-semibold text-terracotta underline-offset-4 hover:underline">
          Ask us
        </a>
      </p>
    </section>
  );
}

function Kind({ tag }: { tag: string }) {
  return <span className="fd-kindtag">{tag}</span>;
}

/** A help answer — the title and one line; the whole answer opens in place. */
function HelpAnswerRow({ hit }: { hit: HowHit }) {
  return (
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <Kind tag={hit.tag} />
          <span className="mt-1 block text-base font-semibold text-ink">{hit.title}</span>
          <span className="mt-0.5 block text-sm text-ink/65 group-open:hidden">{hit.blurb}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="mt-6 h-4 w-4 flex-none text-ink/45 transition-transform group-open:rotate-180"
          strokeWidth={1.75}
        />
      </summary>
      <p className="mt-1 whitespace-pre-line text-sm text-ink/75">{hit.answer}</p>
      <Link
        href={hit.href}
        className="mt-2 inline-block text-sm font-semibold text-terracotta underline-offset-4 hover:underline"
      >
        Open this answer
      </Link>
    </details>
  );
}

/** A feature page or a guide — one press to its page. */
function LinkRow({ hit }: { hit: HowHit }) {
  return (
    <Link href={hit.href} className="group flex items-start gap-3 py-3">
      <span className="min-w-0 flex-1">
        <Kind tag={hit.tag} />
        <span className="mt-1 block text-base font-semibold text-ink group-hover:underline">{hit.title}</span>
        <span className="mt-0.5 block text-sm text-ink/65">{hit.blurb}</span>
      </span>
      <ChevronRight aria-hidden className="mt-6 h-4 w-4 flex-none text-ink/45" strokeWidth={1.75} />
    </Link>
  );
}
