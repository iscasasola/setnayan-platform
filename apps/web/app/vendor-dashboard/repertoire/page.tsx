import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Music, Plus, Trash2, Search, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  fetchVendorSongs,
  searchSongs,
  fetchCuratedSongs,
  isMusicVendor,
  type Song,
} from '@/lib/songs';
import { addRepertoireSong, removeRepertoireSong } from './actions';

export const metadata = { title: 'Your repertoire · Vendor' };

type Props = {
  searchParams: Promise<{ q?: string; saved?: string; error?: string }>;
};

export default async function RepertoirePage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Not a music act → explain the surface rather than 404 (best-UX over a
  // silent redirect). Nav-level hiding for non-music vendors is a follow-up.
  if (!isMusicVendor(profile.services)) {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16 sm:px-6 lg:px-8">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Music aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Your repertoire</h1>
        <p className="max-w-prose text-base text-ink/65">
          This is for music acts — bands, singers, orchestras, choirs, and DJs. Add a
          music service to your profile and your set list will appear here, so couples
          whose chosen songs you play see you as a better match.
        </p>
        <Link href="/vendor-dashboard/services" className="button-primary inline-flex w-fit">
          Add a music service
        </Link>
      </section>
    );
  }

  // The vendor's own repertoire + the browse/search results are independent
  // (results keys off `query`, not the repertoire) — one parallel batch instead
  // of two serial reads (owner perf pass 2026-06-03).
  const [repertoire, results] = await Promise.all([
    fetchVendorSongs(supabase, profile.vendor_profile_id),
    query ? searchSongs(supabase, query) : fetchCuratedSongs(supabase),
  ]);
  const repertoireIds = new Set(repertoire.map((s) => s.song_id));

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Music aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {repertoire.length} {repertoire.length === 1 ? 'song' : 'songs'}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your repertoire</h1>
        <p className="max-w-prose text-base text-ink/65">
          The songs you perform. When a couple&apos;s chosen songs overlap your set list,
          you rank as a <strong className="text-ink/80">better match</strong> for their
          wedding — we promote you, never hide anyone else.
        </p>
      </header>

      {sp.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}
      {sp.saved ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Repertoire updated.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Add songs ── */}
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Add from the song library
          </h2>
          <form method="get" action="/vendor-dashboard/repertoire" className="flex gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
                strokeWidth={1.75}
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search by title…"
                className="input-field w-full pl-9"
              />
            </div>
            <SubmitButton className="button-primary">Search</SubmitButton>
          </form>

          <ul className="space-y-1.5">
            {results.length === 0 ? (
              <li className="px-1 py-2 text-sm text-ink/50">
                {query ? 'No songs match — add it below.' : 'No songs yet.'}
              </li>
            ) : (
              results.map((song) => {
                const added = repertoireIds.has(song.song_id);
                return (
                  <li
                    key={song.song_id}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink/90">
                        {song.title}
                      </span>
                      {song.artist ? (
                        <span className="block truncate text-xs text-ink/55">{song.artist}</span>
                      ) : null}
                    </span>
                    {added ? (
                      <span className="inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-emerald-700">
                        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Added
                      </span>
                    ) : (
                      <form action={addRepertoireSong} className="shrink-0">
                        <input type="hidden" name="song_id" value={song.song_id} />
                        <input type="hidden" name="q" value={query} />
                        <SubmitButton className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta">
                          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Not in the library → add your own (joins the master catalogue). */}
          <form
            action={addRepertoireSong}
            className="space-y-2 border-t border-ink/10 pt-4"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Not listed? Add your own
            </p>
            <input type="hidden" name="q" value={query} />
            <input name="title" required placeholder="Song title" className="input-field w-full" />
            <input name="artist" placeholder="Artist (optional)" className="input-field w-full" />
            <SubmitButton className="button-primary inline-flex items-center gap-1">
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add to my set list
            </SubmitButton>
          </form>
        </div>

        {/* ── Your set list ── */}
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Your set list ({repertoire.length})
          </h2>
          {repertoire.length === 0 ? (
            <p className="px-1 py-2 text-sm text-ink/50">
              Add the songs you perform — search the library or type your own. The more
              complete your set list, the more couples you match.
            </p>
          ) : (
            <ul className="space-y-1">
              {repertoire.map((song) => (
                <li
                  key={song.song_id}
                  className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink/90">
                      {song.title}
                    </span>
                    {song.artist ? (
                      <span className="block truncate text-xs text-ink/55">{song.artist}</span>
                    ) : null}
                  </span>
                  <form action={removeRepertoireSong} className="shrink-0">
                    <input type="hidden" name="song_id" value={song.song_id} />
                    <input type="hidden" name="q" value={query} />
                    <SubmitButton
                      className="inline-flex items-center justify-center rounded-full p-1.5 text-ink/40 hover:bg-terracotta/10 hover:text-terracotta"
                      aria-label={`Remove ${song.title}`}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
