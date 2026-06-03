import { Music, Trash2, GitMerge, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { fetchSongsAdmin } from '@/lib/songs';
import { mergeSongsAction, deleteSongAction } from './actions';

export const metadata = { title: 'Songs · Admin' };

type Props = {
  searchParams: Promise<{ q?: string; merged?: string; deleted?: string; error?: string }>;
};

// The /admin layout 404s non-admins, so the page itself needs no extra gate.
export default async function AdminSongsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const supabase = await createClient();
  const songs = await fetchSongsAdmin(supabase, query);

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
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

      {sp.error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}
      {sp.merged || sp.deleted ? (
        <p role="status" className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.merged ? 'Songs merged — repertoires and picks re-pointed.' : 'Song removed.'}
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
      <form method="get" action="/admin/songs" className="flex gap-2">
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
