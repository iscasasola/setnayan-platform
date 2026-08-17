import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  loadShowcaseCandidatesForAdmin,
  SHOWCASE_ADMIN_CANDIDATE_CAP,
  type ShowcaseAdminRow,
} from '@/lib/showcase-db';
import { setShowcaseFeatured, setShowcaseRank } from '@/app/admin/real-stories/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable, type ConsoleColumn } from '@/app/admin/_components/console-table';

/**
 * RealStoriesSurface — the Real Stories featuring body of the tabbed
 * /admin/studio studio (Studio Studio slice 2). Curate which published,
 * consent-gated wedding editorials get FEATURED (pinned) + in what ORDER on the
 * public /realstories index, and which fills the hero slot.
 *
 * PR D of the Real Stories featuring program. The list mirrors the public page's
 * order (featured-first by rank, then newest) and only ever surfaces weddings
 * that already pass the RA 10173 consent gate — featuring is curation on top of
 * that gate, never a bypass. The curated SAMPLE ("Maria & Juan") is an in-code
 * constant, not in the database, so it can't be featured here; it stays clearly
 * labelled "Sample showcase" on the public page.
 *
 * Edits revalidate /realstories live — no redeploy.
 *
 * ── WHAT CHANGED 2026-08-17 ─────────────────────────────────────────────────
 * ⚖ THIS SURFACE WAS ALREADY HONEST ABOUT ERROR-VS-EMPTY, and that is worth
 * saying plainly: `loadShowcaseCandidatesForAdmin` returns a discriminated
 * result, so a refused read rendered a failure panel and never "no stories yet".
 * The conversion keeps that distinction and closes three things it did not have:
 *
 * 1 · ⛔ THE CAP WAS INVISIBLE BECAUSE IT WAS IN ANOTHER FILE. The loader
 *     `.limit(limit)`s at a defaulted 100, so a grep for `.limit(` on THIS file
 *     found nothing and the list read as every eligible wedding. The number is
 *     now one exported constant, used by the query and passed as `cap`.
 *
 * 2 · 🔇 THE REFUSAL HAD NO NAME. The old panel said "Couldn't load showcases
 *     right now. Try again in a moment," which describes a network blip. This
 *     failure class — phantom column, stale enum value, unapplied migration,
 *     missing grant — is not a blip and never fixes itself; the message is the
 *     only place it ever announces itself, so the loader now carries it through
 *     and ConsoleTable prints it.
 *
 * 3 · 🎨 TWO GOLDS, TWO RULES — three measured AA failures on this screen. The
 *     Feature button was `bg-terracotta text-cream`, and the `terracotta` slot
 *     holds the atelier GOLD #A9834B: a cream label on gold measures 3.37:1, an
 *     AA failure on the primary control of the page. The secondary button's
 *     hover turned its label gold on white (3.37:1) and both editorial links did
 *     the same. All four now use the CTA slot, `mulberry` #C24E25 — 4.61:1 light,
 *     6.29:1 dark for cream-on-fill. Measured in BOTH themes on purpose.
 *     The rank chips were failing too and are covered at their own call site.
 *
 * ⚠ ONE VISUAL THING IS DELIBERATELY LOST: featured rows carried a 4% gold row
 * tint. The archetype has no per-row class and MUST NOT GROW ONE for this — the
 * Featured column already renders a pill on exactly those rows, and the list is
 * sorted featured-first, so the signal survives twice over.
 *
 * ⚠ PROD HAS ZERO PUBLISHED REAL STORIES, so the empty state below is the
 * launch-day state and is what the owner will actually see. It teaches how the
 * shelf fills. It does not apologise for being empty — nothing is wrong.
 */

const INPUT = 'w-24 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink';
/**
 * 🎨 `bg-mulberry`, NOT `bg-terracotta`. The slot named `terracotta` is the
 * atelier gold #A9834B and a cream label on it measures 3.37:1 — below the 4.5:1
 * AA floor. The CTA colour #C24E25 lives in the slot named `mulberry`: 4.61:1 in
 * the light theme, 6.29:1 in the dark one. The names are inherited and backwards.
 */
const BTN_PRIMARY =
  'rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600';
const BTN_SECONDARY =
  'rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-mulberry/50 hover:text-mulberry';

export async function RealStoriesSurface({
  ok: okRaw,
  error: errorRaw,
}: {
  ok?: string;
  error?: string;
}) {
  const ok = okRaw ? decodeURIComponent(okRaw) : null;
  const error = errorRaw ? decodeURIComponent(errorRaw) : null;

  const result = await loadShowcaseCandidatesForAdmin();

  // The featuring columns not existing yet is a DIFFERENT answer from a refused
  // read: it names the exact migration to run, which is more useful than
  // anything the generic error state can say. It stays its own panel and returns
  // before the table.
  const migrationMissing = !result.ok && result.reason === 'migration';

  // NULL SURVIVES. A failed read is not an empty shelf.
  const rows: ShowcaseAdminRow[] | null = result.ok ? result.rows : null;
  const featuredCount = rows ? rows.filter((r) => r.featured).length : null;

  const columns: ConsoleColumn<ShowcaseAdminRow>[] = [
    {
      header: 'Wedding',
      cell: (r) => {
        const meta = [r.city, r.dateLabel].filter(Boolean).join(' · ');
        return (
          <div id={`rs-${r.eventId}`}>
            <Link
              href={`/${r.slug}`}
              className="font-medium text-ink hover:text-mulberry hover:underline"
            >
              {r.coupleNames}
            </Link>
            {meta ? <p className="mt-0.5 text-xs text-ink/70">{meta}</p> : null}
          </div>
        );
      },
    },
    {
      header: 'Featured',
      cell: (r) =>
        r.featured ? (
          <span className="inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-800">
            Featured
          </span>
        ) : (
          <span className="text-xs text-ink/70">—</span>
        ),
    },
    {
      // NOT hidden on a phone: this column IS a control. Hiding it below a
      // breakpoint would delete the only way to set the order on a phone, and
      // the archetype's wrapper already scrolls rather than crushing.
      header: 'Order',
      cell: (r) =>
        r.featured ? (
          <div className="space-y-1.5">
            {/* Plain-English meaning of the numeric rank: 0 = the hero cover,
                1–3 fill the "Most loved" slots on the public page.
                🎨 Both chips were AA failures and are measured now. `Cover` is a
                filled CTA chip (cream on #C24E25 → 4.61 light / 6.29 dark) and
                `Most loved` is the tint with `mulberry-600` (4.76 light / 6.33
                dark). What they were: gold-700 on a gold tint at 4.12:1, and
                plain `mulberry` on a mulberry tint at 4.03:1 — both under 4.5. */}
            <div className="text-[11px] font-medium uppercase tracking-wide">
              {r.featureRank == null ? (
                <span className="text-ink/70">Unranked</span>
              ) : r.featureRank === 0 ? (
                <span className="rounded-full bg-mulberry px-2 py-0.5 text-cream">Cover</span>
              ) : r.featureRank <= 3 ? (
                <span className="rounded-full bg-mulberry/10 px-2 py-0.5 text-mulberry-600">
                  Most loved #{r.featureRank}
                </span>
              ) : (
                <span className="text-ink/70">Featured · rank {r.featureRank}</span>
              )}
            </div>
            <form action={setShowcaseRank} className="flex items-center gap-2">
              <input type="hidden" name="event_id" value={r.eventId} />
              <input
                name="rank"
                type="number"
                min={0}
                max={9999}
                defaultValue={r.featureRank ?? ''}
                placeholder="—"
                aria-label={`Order for ${r.coupleNames} (0 = cover, 1–3 = most loved, lower shows first)`}
                className={INPUT}
              />
              <SubmitButton pendingLabel="Saving…" className={BTN_SECONDARY}>
                Save
              </SubmitButton>
            </form>
          </div>
        ) : (
          <span className="text-xs text-ink/70">—</span>
        ),
    },
    {
      header: '',
      align: 'right',
      cell: (r) =>
        r.featured ? (
          <ConfirmForm
            action={setShowcaseFeatured}
            title="Remove from Real Stories?"
            confirmLabel="Unfeature"
            message="This wedding stays published at its own page, but drops off the public Real Stories index. The cover and order reshuffle automatically; the couple isn't notified."
          >
            <input type="hidden" name="event_id" value={r.eventId} />
            <input type="hidden" name="feature" value="0" />
            <SubmitButton pendingLabel="Updating…" className={BTN_SECONDARY}>
              Unfeature
            </SubmitButton>
          </ConfirmForm>
        ) : (
          <ConfirmForm
            action={setShowcaseFeatured}
            title="Feature on Real Stories?"
            confirmLabel="Feature"
            destructive={false}
            message="This wedding goes live on the public Real Stories page and the couple is notified. You can set its order next."
          >
            <input type="hidden" name="event_id" value={r.eventId} />
            <input type="hidden" name="feature" value="1" />
            <SubmitButton pendingLabel="Updating…" className={BTN_PRIMARY}>
              Feature
            </SubmitButton>
          </ConfirmForm>
        ),
    },
  ];

  return (
    <div>
      <PageMasthead
        title="Real Stories"
        lede={
          <>
            Choose which real, consented wedding editorials get{' '}
            <strong className="font-semibold text-ink">featured</strong> on the public{' '}
            <Link href="/realstories" className="underline hover:text-mulberry">
              Real Stories
            </Link>{' '}
            page, and in what order. The lowest-numbered featured wedding fills the big hero slot
            at the top. Only weddings that are already public, finished (past the 30-day grace
            window), and whose couple opted in to showcasing appear below — featuring is a
            spotlight on top of their consent, never a way around it.
          </>
        }
        className="mb-8"
      />

      {ok ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          {ok}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800"
        >
          {error}
        </div>
      ) : null}

      {migrationMissing ? (
        /* The featuring columns don't exist yet — name the exact fix. */
        <div className="rounded-2xl border border-warn-200 bg-warn-50 p-6 text-sm text-warn-900">
          <p className="font-semibold">Almost there — one database step left.</p>
          <p className="mt-2">
            The Real Stories featuring columns haven&rsquo;t been added to the database yet. Run
            the migration{' '}
            <code className="rounded bg-warn-100 px-1 py-0.5 font-mono text-[12px]">
              20261221000000_realstories_featuring.sql
            </code>{' '}
            (
            <code className="rounded bg-warn-100 px-1 py-0.5 font-mono text-[12px]">
              supabase db push --db-url &quot;$SUPABASE_DB_URL&quot;
            </code>
            ), then reload this page. Until then, /realstories keeps showing the sample showcase
            exactly as before.
          </p>
        </div>
      ) : (
        <>
          {rows ? (
            <p className="mb-4 text-sm text-ink/70">
              {rows.length} eligible {rows.length === 1 ? 'wedding' : 'weddings'} · {featuredCount}{' '}
              featured
            </p>
          ) : null}

          <ConsoleTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.eventId}
            label="Real Stories candidates"
            readPermitted
            readError={result.ok ? null : { message: result.message }}
            reads="the eligible wedding editorials"
            cap={SHOWCASE_ADMIN_CANDIDATE_CAP}
            minWidth="46rem"
            empty={{
              Icon: Sparkles,
              title: 'No published Real Stories yet',
              blurb:
                'A wedding appears here on its own, once three things are true: its page is public, the celebration is finished and past its 30-day grace window, and the couple ticked “showcase our wedding”. Then you Feature it and it goes live on the public page — the labelled sample holds that space meanwhile. The first real one is expected around January 2027.',
              verifiedNote: 'Verified: read permitted · 0 weddings currently eligible',
            }}
          />

          {rows && rows.length > 0 ? (
            <p className="mt-4 text-xs text-ink/70">
              Lower order numbers show first; the lowest-numbered featured wedding is the hero.
              Leave the order blank to let it sort after the numbered ones (then by
              most-recently featured). Unfeaturing also clears the order.
            </p>
          ) : null}
        </>
      )}

      {/* Honesty note — the curated sample is not in this list. */}
      <div className="mt-10 rounded-2xl border border-ink/10 bg-white/50 p-5 text-sm text-ink/70">
        <p className="font-medium text-ink">About the sample showcase</p>
        <p className="mt-1">
          The &ldquo;Maria &amp; Juan&rdquo; entry on /realstories is a clearly labelled{' '}
          <strong className="font-semibold">sample</strong> — a built-in illustration of the
          format, not a real client — so it can&rsquo;t be featured here. It shows only while
          there are no real published Real Stories, and disappears on its own once a real one is
          featured.
        </p>
      </div>
    </div>
  );
}
