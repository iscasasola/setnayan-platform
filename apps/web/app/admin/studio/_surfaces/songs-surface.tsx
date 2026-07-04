import { Music, Trash2, GitMerge, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { fetchSongsAdmin } from '@/lib/songs';
import { mergeSongsAction, deleteSongAction } from '@/app/admin/songs/actions';

/**
 * SongsSurface — the master song catalogue body, re-homed byte-identical from
 * app/admin/songs/page.tsx into the tabbed /admin/studio studio (Studio Studio
 * slice 2). Behaviour is unchanged: merge near-duplicates + remove junk from
 * the shared song list vendors and couples pick from.
 *
 * Two mechanical changes vs the legacy page:
 *   1. It accepts the surface's own searchParams (q, merged, deleted, error) as
 *      props from the /admin/studio shell instead of awaiting them itself.
 *   2. The GET search form posts to /admin/studio with a hidden tab=songs input
 *      so searching stays on the Songs tab. The mergeSongsAction /
 *      deleteSongAction server actions still redirect back to /admin/songs
 *      (which now redirects in), so their banners surface on the Songs tab — no
 *      action rewrite needed there. The outer max-w-4xl container is dropped
 *      (the studio shell provides layout); space-y-6 is kept for section
 *      spacing.
 */

export async function SongsSurface({
  q,
  merged,
  deleted,
  error,
}: {
  q?: string;
  merged?: string;
  deleted?: string;
  error?: string;
}) {
  const query = (q ?? '').trim();
  const supabase = await createClient();
  const songs = await fetchSongsAdmin(supabase, query);

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Music aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Master song catalogue</h1>
        <p className="max-w-prose text-base text-ink/65">
          The shared song list vendors and couples pick from. Merge near-duplicates
          (vendor-typed variants like &quot;Perfect&quot; vs &quot;Perfect - Ed Sheeran&quot;) so the
          compatibility overlap stays clean, and remove junk entries.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {decodeURIComponent(error)}
        </p>
      ) : null}
      {merged || deleted ? (
        <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800">
          {merged ? 'Songs merged — repertoires and picks re-pointed.' : 'Song removed.'}
        </p>
      ) : null}

      {/* Merge two songs */}
      <form action={mergeSongsAction} className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4">
        <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          <GitMerge aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Merge duplicates
        </h2>
        <p className="text-sm text-ink/60">
          The <strong>duplicate</strong> is deleted; every repertoire / pick that used it
          re-points to the <strong>canonical</strong>. Find both IDs in the list below.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Duplicate ID</span>
            <input name="dup_id" inputMode="numeric" required className="input-field w-28" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Canonical ID (keep)</span>
            <input name="canonical_id" inputMode="numeric" required className="input-field w-28" />
          </label>
          <SubmitButton className="button-primary">Merge</SubmitButton>
        </div>
      </form>

      {/* Search */}
      <form method="get" action="/admin/studio" className="flex gap-2">
        <input type="hidden" name="tab" value="songs" />
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" strokeWidth={1.75} />
          <input type="search" name="q" defaultValue={query} placeholder="Search songs by title…" className="input-field w-full pl-9" />
        </div>
        <SubmitButton className="button-primary">Search</SubmitButton>
      </form>

      {/* List */}
      <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-cream">
        {songs.length === 0 ? (
          <li className="px-4 py-6 text-sm text-ink/50">No songs match.</li>
        ) : (
          songs.map((s) => (
            <li key={s.song_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-[11px] text-ink/40">#{s.song_id}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink/90">{s.title}</span>
                  <span className="block truncate text-xs text-ink/55">
                    {s.artist || '—'}
                    <span className="ml-2 text-ink/35">
                      {s.source}
                      {s.is_curated_pick ? ' · curated' : ''}
                    </span>
                  </span>
                </span>
              </span>
              <form action={deleteSongAction} className="shrink-0">
                <input type="hidden" name="song_id" value={s.song_id} />
                <SubmitButton
                  className="inline-flex items-center justify-center rounded-full p-1.5 text-ink/40 hover:bg-terracotta/10 hover:text-terracotta"
                  aria-label={`Delete ${s.title}`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </SubmitButton>
              </form>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
