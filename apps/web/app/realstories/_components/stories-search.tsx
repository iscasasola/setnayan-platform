'use client';

// ============================================================================
// Stories SEARCH — place / service / kind facets across BOTH shelves
// (P4+ · Creator Economy build plan 2026-07-16, council INTEGRATE verdict).
// ============================================================================
//
// The VOLUME-GATED search face of /realstories. The page mounts this ONLY when
// the already-public featured+curated pool crosses STORIES_SEARCH_MIN_POOL — a
// search box over a dozen items reads as a dead platform (Simplicity Canon:
// don't build search before there's something to find). Below the gate the
// page keeps its shelf layout (the editorial cascade + the Storytellers shelf);
// this component never mounts.
//
// Facets span BOTH pools but results KEEP THEIR VOICE (the non-negotiable lock):
//   • editorial → the Chronicle newspaper Tile (reused from gallery.tsx);
//   • chapter   → the byline-forward StorytellerTile.
// The two never blur into one grammar — they render in two labelled sections,
// each filtered by the same shared facet state. Same-event cross-links (the
// "Watch the storyteller's cut" / "Read the editorial" chips) ride along on the
// tiles exactly as on the shelves.
//
// READ-ONLY over the already-public pool: the page hands down only featured
// chapters + consented/curated editorials, so nothing unpublished/unfeatured/
// private can ever enter a result. This component adds no data access — it only
// filters and groups what it is given.

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Tile, type GalleryItem } from './gallery';
import { StorytellerTile } from '@/app/_components/storyteller-tile';
import type { StorytellerTileItem } from '@/lib/storytellers';

// The display gate constant (STORIES_SEARCH_MIN_POOL) lives in the server-safe
// lib/stories-search-config.ts — never exported from this 'use client' module,
// so the server page reads the real number and not a client-reference proxy.

/** Editorial result — a Chronicle tile item plus its resolved facet axes. */
export type EditorialSearchItem = GalleryItem & {
  /** Credited vendors' canonical service categories (facet axis). */
  serviceCategories: string[];
};

/** Chapter result — a Storyteller tile item plus its resolved facet axes. */
export type ChapterSearchItem = StorytellerTileItem & {
  /** The linked event's city (facet axis) — may be null for placeless kinds. */
  city: string | null;
  /** Credited substrate vendors' canonical service categories (facet axis). */
  serviceCategories: string[];
  /** Cross-rail: the consented editorial for this chapter's event, if any. */
  editorialHref: string | null;
};

// One normalized row per item so the three facet axes filter uniformly across
// both voices; the tagged union carries the original item to its own tile.
type Row =
  | { provenance: 'editorial'; key: string; kind: string | null; city: string | null; categories: string[]; text: string; editorial: EditorialSearchItem }
  | { provenance: 'chapter'; key: string; kind: string; city: string | null; categories: string[]; text: string; chapter: ChapterSearchItem };

function sortedUnique(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

// ── Facet chip row ──────────────────────────────────────────────────────────

function FacetRow({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: string[];
  active: string | null;
  onPick: (value: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
        {label}
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Filter by ${label.toLowerCase()}`}>
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-pressed={active === null}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            active === null
              ? 'bg-ink text-white'
              : 'border border-ink/15 bg-white/60 text-ink/65 hover:bg-white hover:text-ink'
          }`}
        >
          All
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(active === opt ? null : opt)}
            aria-pressed={active === opt}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              active === opt
                ? 'bg-ink text-white'
                : 'border border-ink/15 bg-white/60 text-ink/65 hover:bg-white hover:text-ink'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3 sm:mt-12">
      <h2 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{title}</h2>
      {note ? <span className="text-[11px] text-ink/45">{note}</span> : null}
    </div>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

export function StoriesSearch({
  editorials,
  chapters,
}: {
  editorials: EditorialSearchItem[];
  chapters: ChapterSearchItem[];
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  // Normalize both pools into filterable rows (voice preserved on the item).
  const rows = useMemo<Row[]>(() => {
    const ed: Row[] = editorials.map((e) => ({
      provenance: 'editorial' as const,
      key: e.href,
      kind: e.eventType ?? null,
      city: e.city ?? null,
      categories: e.serviceCategories ?? [],
      text: `${e.searchText} ${(e.serviceCategories ?? []).join(' ')}`.toLowerCase(),
      editorial: e,
    }));
    const ch: Row[] = chapters.map((c) => ({
      provenance: 'chapter' as const,
      key: c.publicId,
      kind: c.kindLabel,
      city: c.city ?? null,
      categories: c.serviceCategories ?? [],
      text: `${c.title} ${c.ownerName} @${c.ownerSlug} ${c.kindLabel} ${c.city ?? ''} ${(c.serviceCategories ?? []).join(' ')}`.toLowerCase(),
      chapter: c,
    }));
    return [...ed, ...ch];
  }, [editorials, chapters]);

  // Facet options — the UNION across both shelves (spanning is the point).
  const kinds = useMemo(
    () => sortedUnique(rows.map((r) => r.kind ?? '').filter(Boolean)),
    [rows],
  );
  const places = useMemo(
    () => sortedUnique(rows.map((r) => r.city ?? '').filter(Boolean)),
    [rows],
  );
  const services = useMemo(
    () => sortedUnique(rows.flatMap((r) => r.categories)),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (kind && r.kind !== kind) return false;
        if (place && r.city !== place) return false;
        if (service && !r.categories.includes(service)) return false;
        if (q && !r.text.includes(q)) return false;
        return true;
      }),
    [rows, kind, place, service, q],
  );

  const editorialResults = filtered.filter(
    (r): r is Extract<Row, { provenance: 'editorial' }> => r.provenance === 'editorial',
  );
  const chapterResults = filtered.filter(
    (r): r is Extract<Row, { provenance: 'chapter' }> => r.provenance === 'chapter',
  );

  const isFiltering = Boolean(q || kind || place || service);
  const activeFacets = [kind, place, service].filter(Boolean) as string[];

  return (
    <div>
      {/* Text search across every editorial + storyteller chapter. */}
      <div className="relative mt-8">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink/40"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place, a service, a name, a milestone…"
          aria-label="Search real stories and storyteller chapters"
          className="h-12 w-full rounded-full border border-ink/15 bg-white/70 pl-11 pr-11 text-[15px] text-ink outline-none transition placeholder:text-ink/40 focus:border-terracotta/50 focus:bg-white"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {/* Three facet axes — each spans BOTH shelves. */}
      <FacetRow label="Milestone" options={kinds} active={kind} onPick={setKind} />
      <FacetRow label="Place" options={places} active={place} onPick={setPlace} />
      <FacetRow label="Service" options={services} active={service} onPick={setService} />

      {isFiltering ? (
        <>
          <SectionHead
            title={
              filtered.length === 0
                ? 'No stories found'
                : `${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'}${
                    activeFacets.length > 0 ? ` · ${activeFacets.join(' · ')}` : ''
                  }${q ? ` for "${query}"` : ''}`
            }
            note="across editorials + storytellers"
          />
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white/50 p-8 text-center text-sm text-ink/55">
              No stories match yet — try a different place, service, or milestone.
            </p>
          ) : null}
        </>
      ) : null}

      {/* Editorial results — Chronicle voice. Header only when there is content. */}
      {editorialResults.length > 0 ? (
        <>
          <SectionHead
            title="From the Editorial Desk"
            note={`${editorialResults.length} ${editorialResults.length === 1 ? 'edition' : 'editions'}`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {editorialResults.map((r) => (
              <Tile key={r.key} item={r.editorial} size="card" />
            ))}
          </div>
        </>
      ) : null}

      {/* Storyteller results — byline voice. Kept visually distinct (the lock). */}
      {chapterResults.length > 0 ? (
        <section id="storytellers" className="scroll-mt-24">
          <SectionHead
            title="From Our Storytellers"
            note={`${chapterResults.length} ${chapterResults.length === 1 ? 'chapter' : 'chapters'}`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chapterResults.map((r) => (
              <StorytellerTile key={r.key} item={r.chapter} editorialHref={r.chapter.editorialHref} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
