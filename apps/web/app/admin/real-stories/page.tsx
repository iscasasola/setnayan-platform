import Link from 'next/link';
import { loadShowcaseCandidatesForAdmin } from '@/lib/showcase-db';
import { setShowcaseFeatured, setShowcaseRank } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Real Stories · Admin' };
// Top-level admin-client DB read — keep this route dynamic (same rationale as
// /admin/event-types).
export const dynamic = 'force-dynamic';

/**
 * Setnayan HQ · Real Stories — curate which published, consent-gated wedding
 * editorials get FEATURED (pinned) + in what ORDER on the public /realstories
 * index, and which fills the hero slot.
 *
 * PR D of the Real Stories featuring program. The list mirrors the public
 * page's order (featured-first by rank, then newest) and only ever surfaces
 * weddings that already pass the RA 10173 consent gate — featuring is curation
 * on top of that gate, never a bypass. The curated SAMPLE ("Maria & Juan") is
 * an in-code constant, not in the database, so it can't be featured here — it
 * stays clearly labelled "Sample showcase" on the public page.
 *
 * Until a real wedding qualifies (first = the founder's Dec 2026 wedding →
 * editorial ~Jan 2027) this page shows the empty state, and /realstories keeps
 * showing the sample. Edits revalidate /realstories live — no redeploy.
 */

type SearchParams = Promise<{ ok?: string; error?: string }>;

const INPUT =
  'w-24 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink';
const BTN_PRIMARY =
  'rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta/90';
const BTN_SECONDARY =
  'rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta';

export default async function AdminRealStoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ok = params.ok ? decodeURIComponent(params.ok) : null;
  const error = params.error ? decodeURIComponent(params.error) : null;

  const result = await loadShowcaseCandidatesForAdmin();
  const rows = result.ok ? result.rows : [];
  const featuredCount = rows.filter((r) => r.featured).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Setnayan HQ · Platform
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Real Stories
        </h1>
        <p className="max-w-3xl text-base text-ink/65">
          Choose which real, consented wedding editorials get{' '}
          <strong className="font-semibold text-ink">featured</strong> on the
          public{' '}
          <Link href="/realstories" className="underline hover:text-terracotta">
            Real Stories
          </Link>{' '}
          page, and in what order. The lowest-numbered featured wedding fills the
          big hero slot at the top. Only weddings that are already public,
          finished (past the 30-day grace window), and whose couple opted in to
          showcasing appear below — featuring is a spotlight on top of their
          consent, never a way around it.
        </p>
      </header>

      {ok ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {ok}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}

      {/* Migration-not-applied state — the featuring columns don't exist yet. */}
      {!result.ok && result.reason === 'migration' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">Almost there — one database step left.</p>
          <p className="mt-2">
            The Real Stories featuring columns haven&rsquo;t been added to the
            database yet. Run the migration{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[12px]">
              20261221000000_realstories_featuring.sql
            </code>{' '}
            (
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[12px]">
              supabase db push --db-url &quot;$SUPABASE_DB_URL&quot;
            </code>
            ), then reload this page. Until then, /realstories keeps showing the
            sample showcase exactly as before.
          </p>
        </div>
      ) : !result.ok ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          Couldn&rsquo;t load showcases right now. Try again in a moment.
        </div>
      ) : rows.length === 0 ? (
        /* Empty state — no qualifying real showcases yet. */
        <div className="rounded-2xl border border-ink/10 bg-white/60 p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">
            No published Real Stories yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink/65">
            Couples&rsquo; editorials appear here once they&rsquo;re live and
            consented — a finished wedding (past its 30-day grace window) with a
            public page and the couple opted in to showcasing. The public Real
            Stories page shows the labelled sample meanwhile. The first real one
            is expected around January 2027.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink/55">
            {rows.length} eligible{' '}
            {rows.length === 1 ? 'wedding' : 'weddings'} · {featuredCount}{' '}
            featured
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
                <tr>
                  <th className="px-4 py-3 font-medium">Wedding</th>
                  <th className="px-4 py-3 font-medium">Featured</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {rows.map((r) => {
                  const meta = [r.city, r.dateLabel].filter(Boolean).join(' · ');
                  return (
                    <tr
                      key={r.eventId}
                      id={`rs-${r.eventId}`}
                      className={r.featured ? 'bg-terracotta/[0.04]' : undefined}
                    >
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/${r.slug}`}
                          className="font-medium text-ink hover:text-terracotta hover:underline"
                        >
                          {r.coupleNames}
                        </Link>
                        {meta ? (
                          <p className="mt-0.5 text-xs text-ink/55">{meta}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.featured ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                            Featured
                          </span>
                        ) : (
                          <span className="text-xs text-ink/45">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.featured ? (
                          <form
                            action={setShowcaseRank}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="event_id"
                              value={r.eventId}
                            />
                            <input
                              name="rank"
                              type="number"
                              min={0}
                              max={9999}
                              defaultValue={r.featureRank ?? ''}
                              placeholder="—"
                              aria-label={`Order for ${r.coupleNames} (lower shows first)`}
                              className={INPUT}
                            />
                            <SubmitButton pendingLabel="Saving…" className={BTN_SECONDARY}>
                              Save
                            </SubmitButton>
                          </form>
                        ) : (
                          <span className="text-xs text-ink/45">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <form action={setShowcaseFeatured}>
                          <input
                            type="hidden"
                            name="event_id"
                            value={r.eventId}
                          />
                          <input
                            type="hidden"
                            name="feature"
                            value={r.featured ? '0' : '1'}
                          />
                          <SubmitButton
                            pendingLabel="Updating…"
                            className={r.featured ? BTN_SECONDARY : BTN_PRIMARY}
                          >
                            {r.featured ? 'Unfeature' : 'Feature'}
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-ink/50">
            Lower order numbers show first; the lowest-numbered featured wedding
            is the hero. Leave the order blank to let it sort after the numbered
            ones (then by most-recently featured). Unfeaturing also clears the
            order.
          </p>
        </>
      )}

      {/* Honesty note — the curated sample is not in this list. */}
      <div className="mt-10 rounded-2xl border border-ink/10 bg-white/50 p-5 text-sm text-ink/65">
        <p className="font-medium text-ink">About the sample showcase</p>
        <p className="mt-1">
          The &ldquo;Maria &amp; Juan&rdquo; entry on /realstories is a clearly
          labelled <strong className="font-semibold">sample</strong> — a built-in
          illustration of the format, not a real client — so it can&rsquo;t be
          featured here. It shows only while there are no real published Real
          Stories, and disappears on its own once a real one is featured.
        </p>
      </div>
    </div>
  );
}
