import Link from 'next/link';
import { BookOpen, TrendingUp } from 'lucide-react';
import {
  loadStorytellerCandidatesForAdmin,
  STORYTELLER_ADMIN_CANDIDATE_CAP,
  type StorytellerAdminRow,
} from '@/lib/storytellers';
import { setChapterFeatured, setChapterRank } from '@/app/admin/storytellers/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  fetchInfluencerAnalyticsForAdmin,
  ADMIN_INFLUENCER_ANALYTICS_MIN_UNLOCKS,
  ADMIN_INFLUENCER_TOP_CREATORS_CAP,
  type InfluencerAnalytics,
  type TopCreatorInfluence,
} from '@/lib/creator-analytics';
import { PageMasthead } from '@/app/_components/page-masthead';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { ConsoleTable, type ConsoleColumn } from '@/app/admin/_components/console-table';

/**
 * StorytellersSurface — the chapter-featuring body of the tabbed /admin/studio
 * hub (Storytellers council verdict 2026-07-16 · PR-D), the next sibling beside
 * real-stories-surface.tsx in the established tab-hub pattern.
 *
 * Candidate list = ALL published chapters on public-profile accounts, newest
 * first (featured rows sorted to the top exactly as the public shelf orders
 * them), each with its preview — the YouTube-derived thumb when there is a
 * video, a "Written" chip and the story's opening line when there is not — plus
 * owner, kind, view count and open-report count inline. THE FEATURING CLICK IS
 * THE MODERATION REVIEW, so what it takes to review must be on screen.
 *
 * Deny-by-default: publishing never lists a chapter; only rows the owner
 * Features here ever render in the "From Our Storytellers" shelf on
 * /realstories. Edits revalidate /realstories live — no redeploy.
 *
 * ⚠ THIS DOCBLOCK USED TO SAY the action "refuses them serverside too" for
 * non-YouTube chapters. That was true until 2026-08-12 and then was not, and it
 * was the stated justification for gating the Feature button on a thumbnail —
 * the reasoning a later reader would have used to put the gate back. A stale
 * comment kept the face-tagging switch shut for seven weeks; this one hid a
 * button. Every chapter with something to read is featurable now.
 *
 * ── THIS FILE HOLDS TWO TABLES, and both are converted 2026-08-17 ────────────
 * The bill in `admin-console-is-one-table.test.ts` is per FILE, not per table, so
 * its line only comes off with both: the candidate list, and the top-storytellers
 * leaderboard inside the influencer-analytics panel.
 *
 * ⚖ THE CANDIDATE LIST WAS ALREADY HONEST about error-vs-empty — the loader
 * returns a discriminated result, so a refused read never printed "no chapters
 * yet". What it did not have, and now does:
 *   • ⛔ ITS CAP WAS IN ANOTHER FILE. The loader `.limit(limit)`s at a defaulted
 *     100, so grepping THIS file for `.limit(` found nothing and the list read as
 *     every published chapter. One exported constant now feeds the query and `cap`.
 *   • 🔇 THE REFUSAL HAD NO NAME — "Try again in a moment" describes a blip, and
 *     a phantom column or a missing grant is not one. The loader carries the
 *     message through now and ConsoleTable prints it.
 *
 * 🚨 THE LEADERBOARD PANEL WAS THE DISHONEST HALF, and it did not look it. Every
 * count in `InfluencerAnalytics` defaults to 0 on a failed read, and the panel
 * renders the gate metric as the sentence "So far: 0 of 25" — a claim about
 * platform activity, printed from a query that may have returned nothing at all.
 * The aggregate now reports whether it was MEASURED, and an unmeasured panel says
 * so instead of quoting a number. Its `.slice(0, 10)` was silent too.
 *
 * 🔴 AND ITS THREE `AdminStat` TILES WERE ANOTHER LOCAL STAT RE-DECLARATION —
 * typed `value: number`, so they had no way to render "unknown". They are
 * KpiStatCard now, which renders `null` as an em-dash. Two of the 22 hand-rolled
 * admin stat tiles were in this lane; both are gone.
 *
 * 🎨 TWO GOLDS, TWO RULES. `BTN_PRIMARY` was `bg-terracotta text-cream`, and the
 * slot named `terracotta` holds the atelier GOLD #A9834B — a cream label on it
 * measures 3.37:1, an AA failure on the Feature button, which is the whole point
 * of this screen. Four link/button hovers turned their label gold on white at the
 * same 3.37:1. All now use the CTA slot `mulberry` #C24E25: 4.61:1 light and
 * 6.29:1 dark for cream-on-fill, measured in BOTH themes.
 *
 * ⚠ ONE VISUAL THING IS DELIBERATELY LOST: featured rows carried a 4% gold row
 * tint, and the archetype has no per-row class and MUST NOT GROW ONE for this.
 * The Featured column renders a pill on exactly those rows and they sort to the
 * top, so the signal survives twice.
 */

const INPUT = 'w-24 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink';
/**
 * 🎨 `bg-mulberry`, NOT `bg-terracotta` — see the docblock. The slot named
 * `terracotta` is the atelier gold #A9834B (3.37:1 under a cream label, an AA
 * failure); the CTA #C24E25 lives in the slot named `mulberry` (4.61 light /
 * 6.29 dark). The names are inherited and backwards.
 */
const BTN_PRIMARY =
  'rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600';
const BTN_SECONDARY =
  'rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-mulberry/50 hover:text-mulberry';

export async function StorytellersSurface({
  ok: okRaw,
  error: errorRaw,
}: {
  ok?: string;
  error?: string;
}) {
  const ok = okRaw ? decodeURIComponent(okRaw) : null;
  const error = errorRaw ? decodeURIComponent(errorRaw) : null;

  const [result, analytics] = await Promise.all([
    loadStorytellerCandidatesForAdmin(),
    fetchInfluencerAnalyticsForAdmin(),
  ]);

  // The featuring columns not existing yet is a DIFFERENT answer from a refused
  // read — it names the exact migration to run — so it keeps its own panel.
  const migrationMissing = !result.ok && result.reason === 'migration';

  // NULL SURVIVES. A failed read is not an empty candidate list.
  const rows: StorytellerAdminRow[] | null = result.ok ? result.rows : null;
  const featuredCount = rows ? rows.filter((r) => r.featured).length : null;

  const columns: ConsoleColumn<StorytellerAdminRow>[] = [
    {
      header: 'Chapter',
      cell: (r) => {
        const meta = [
          `@${r.ownerSlug}`,
          r.kindLabel,
          `${r.viewCount} ${r.viewCount === 1 ? 'view' : 'views'}`,
        ].join(' · ');
        return (
          <div id={`st-${r.publicId.toLowerCase()}`} className="flex items-start gap-3">
            {/* Preview — the YouTube thumb when there is a video, otherwise a
                "Written" chip. A chapter told in writing is a first-class
                chapter, not a video with a missing image. */}
            {r.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.thumbUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-12 w-20 shrink-0 rounded-md border border-ink/10 object-cover"
              />
            ) : (
              <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-ink/[0.03] text-center font-mono text-[9px] uppercase leading-tight tracking-wide text-ink/70">
                {r.embedProvider ?? 'Written'}
              </span>
            )}
            <div className="min-w-0">
              {r.href ? (
                <Link
                  href={r.href}
                  className="font-medium text-ink hover:text-mulberry hover:underline"
                >
                  {r.title}
                </Link>
              ) : (
                <span className="font-medium text-ink">{r.title}</span>
              )}
              <p className="mt-0.5 text-xs text-ink/70">{meta}</p>
              {r.openReportCount > 0 ? (
                <p className="mt-1">
                  <Link
                    href="/admin/user-reports"
                    className="inline-flex items-center rounded-full bg-danger-100 px-2 py-0.5 text-[11px] font-medium text-danger-800 hover:underline"
                  >
                    {r.openReportCount} open{' '}
                    {r.openReportCount === 1 ? 'report' : 'reports'}
                  </Link>
                </p>
              ) : null}
              {/* This line used to declare a thumbnail-less chapter ineligible
                  for the shelf. That stopped being true on 2026-08-12 and, worse,
                  it made the hidden Feature button look deliberate. A written
                  chapter IS eligible; its shelf tile simply leads with the
                  writing. The phrase is banned from this file outright — see the
                  sibling guard — because the sentence is what taught the wrong
                  thing. */}
              {!r.thumbUrl ? (
                <p className="mt-1 text-[11px] text-ink/70">
                  {r.excerpt
                    ? `Told in writing — the shelf tile will lead with: “${r.excerpt}”`
                    : 'Told in writing — the shelf tile leads with the story, not a thumbnail.'}
                </p>
              ) : null}
            </div>
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
      // breakpoint deletes the only way to set the order on a phone, and the
      // archetype's wrapper already scrolls rather than crushing.
      header: 'Order',
      cell: (r) =>
        r.featured ? (
          <form action={setChapterRank} className="flex items-center gap-2">
            <input type="hidden" name="public_id" value={r.publicId} />
            <input
              name="rank"
              type="number"
              min={0}
              max={9999}
              defaultValue={r.featureRank ?? ''}
              placeholder="—"
              aria-label={`Order for ${r.title} (lower shows first)`}
              className={INPUT}
            />
            <SubmitButton pendingLabel="Saving…" className={BTN_SECONDARY}>
              Save
            </SubmitButton>
          </form>
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
            action={setChapterFeatured}
            title="Remove from the Storytellers shelf?"
            confirmLabel="Unfeature"
            message="The chapter stays published on the creator's own page, but drops off the public Real Stories shelf. If it was the last featured chapter, the whole shelf disappears. The creator isn't notified."
          >
            <input type="hidden" name="public_id" value={r.publicId} />
            <input type="hidden" name="feature" value="0" />
            <SubmitButton pendingLabel="Updating…" className={BTN_SECONDARY}>
              Unfeature
            </SubmitButton>
          </ConfirmForm>
        ) : (
          /* 🚨 THIS BUTTON USED TO RENDER ONLY `? r.thumbUrl :`, i.e. only for a
             chapter with a YouTube video — every story told in WRITING showed a
             greyed-out ineligible label and there was nothing to click. The
             server action's refusal was lifted on 2026-08-12 but the control was
             never restored, so the fix was unreachable. A fix nobody can reach is
             no fix. The action re-asserts every condition, so rendering the
             button is safe by construction. */
          <ConfirmForm
            action={setChapterFeatured}
            title="Feature in From Our Storytellers?"
            confirmLabel="Feature"
            destructive={false}
            message={
              r.thumbUrl
                ? 'This chapter goes live in the Storytellers shelf on the public Real Stories page and the creator is notified. Featuring is the moderation review — watch it first. You can set its order next.'
                : 'This chapter goes live in the Storytellers shelf on the public Real Stories page and the creator is notified. It is told in writing, so its tile leads with the story instead of a thumbnail. Featuring is the moderation review — read it first. You can set its order next.'
            }
          >
            <input type="hidden" name="public_id" value={r.publicId} />
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
      {/* Same as Real Stories: the only link to the shelf this page controls
          lived inside the retired (i) sentence. A door outlives the sentence
          that happened to contain it. NOTE the anchor — the route-level control
          guard passes on `/realstories` alone because a SIBLING surface links
          there, so it could not have told us this one went missing. */}
      <PageMasthead
        title="Storytellers"
        actions={
          <Link
            href="/realstories#storytellers"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/10"
          >
            <BookOpen aria-hidden className="h-4 w-4" strokeWidth={2} />
            View the shelf
          </Link>
        }
        className="mb-6"
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

      {/* Influencer analytics (P3) — read-only platform aggregate, gated to
          >=25 attributed unlocked inquiries. Ledger facts + aggregate-only:
          never who booked, no "discount given". */}
      <InfluencerAnalyticsPanel analytics={analytics} />

      {migrationMissing ? (
        /* The featuring columns don't exist yet — name the exact fix. */
        <div className="rounded-2xl border border-warn-200 bg-warn-50 p-6 text-sm text-warn-900">
          <p className="font-semibold">Almost there — one database step left.</p>
          <p className="mt-2">
            The chapter-featuring columns haven&rsquo;t been added to the database yet. Run the
            migration{' '}
            <code className="rounded bg-warn-100 px-1 py-0.5 font-mono text-[12px]">
              20270818771487_storytellers_chapter_featuring.sql
            </code>{' '}
            (
            <code className="rounded bg-warn-100 px-1 py-0.5 font-mono text-[12px]">
              supabase db push --db-url &quot;$SUPABASE_DB_URL&quot;
            </code>
            ), then reload this page. Until then, /realstories renders exactly as before — no
            Storytellers shelf.
          </p>
        </div>
      ) : (
        <>
          {rows ? (
            <p className="mb-4 text-sm text-ink/70">
              {rows.length} published {rows.length === 1 ? 'chapter' : 'chapters'} ·{' '}
              {featuredCount} featured
            </p>
          ) : null}

          <ConsoleTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.publicId}
            label="Storyteller chapters"
            readPermitted
            readError={result.ok ? null : { message: result.message }}
            reads="the published storyteller chapters"
            cap={STORYTELLER_ADMIN_CANDIDATE_CAP}
            minWidth="48rem"
            empty={{
              Icon: BookOpen,
              title: 'No published chapters yet',
              blurb:
                'A chapter appears here the moment a storyteller with a public profile publishes one — every published chapter is a candidate, newest first. Then you Feature the ones worth showing and the “From Our Storytellers” shelf appears on the public Real Stories page; with none featured, that shelf doesn’t render at all.',
            }}
          />

          {rows && rows.length > 0 ? (
            <p className="mt-4 text-xs text-ink/70">
              Lower order numbers show first on the shelf. Leave the order blank to sort after the
              numbered ones (then by most-recently featured). Unfeaturing also clears the order. A
              report resolved as &ldquo;hide&rdquo; in User Reports unfeatures the chapter
              automatically.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Influencer analytics — read-only platform aggregate (Creator Economy P3).
// Below the >=25 attributed-unlock gate it shows a plain "not enough activity
// yet" state with the progress toward the gate; above it, the platform-wide top
// creators + vendor participation. Aggregate-only: no couple/event is ever
// named. No "discount given" — off-platform, unknowable.
//
// 🔑 AND IT NOW DISTINGUISHES "NOTHING HAPPENED" FROM "NOTHING WAS READ". The
// gated state used to print "So far: 0 of 25" unconditionally, which is a claim,
// not a reading — see the file docblock.
// ---------------------------------------------------------------------------
function InfluencerAnalyticsPanel({ analytics: a }: { analytics: InfluencerAnalytics }) {
  const columns: ConsoleColumn<TopCreatorInfluence>[] = [
    {
      header: 'Storyteller',
      cell: (c) =>
        c.creatorSlug ? (
          <Link href={`/u/${c.creatorSlug}`} className="hover:text-mulberry hover:underline">
            {c.creatorName}
          </Link>
        ) : (
          c.creatorName
        ),
    },
    {
      header: 'Inquiries driven',
      align: 'right',
      mono: true,
      cell: (c) => c.inquiriesDriven,
    },
  ];

  return (
    <section className="mb-8 rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
      <header className="mb-4 space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70">
          Influencer analytics · platform-wide
        </p>
        <h2 className="text-lg font-semibold text-ink">How storytellers drive business</h2>
      </header>

      {!a.measured ? (
        /* The aggregate could not be read. It must NOT say "0 of 25" — that is a
           statement about the platform, and nothing was counted. */
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-800"
        >
          <p className="font-semibold">Couldn&rsquo;t read the storyteller aggregate.</p>
          <p className="mt-1">
            Nothing loaded, so this is not a statement that no storyteller has driven business —
            it is a statement that we do not know. Reload. If it repeats, the query is being
            rejected rather than returning nothing.
          </p>
        </div>
      ) : !a.unlocked ? (
        /* Gated "not enough activity yet" state — shows progress, no numbers. */
        <div className="rounded-xl border border-dashed border-ink/15 bg-ink/[0.02] p-5 text-sm text-ink/70">
          <p className="font-medium text-ink/80">Not enough activity yet.</p>
          <p className="mt-1">
            Influencer analytics unlock once storytellers have driven{' '}
            <strong className="text-ink">{ADMIN_INFLUENCER_ANALYTICS_MIN_UNLOCKS}</strong>{' '}
            attributed, vendor-unlocked inquiries platform-wide. So far:{' '}
            <strong className="text-ink">{a.totalInquiriesDriven}</strong> of{' '}
            {ADMIN_INFLUENCER_ANALYTICS_MIN_UNLOCKS}.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Aggregate stat row — ledger facts only. KpiStatCard, not a local
              tile: the three `AdminStat`s this replaces were typed `value:
              number` and could not render "unknown". */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <KpiStatCard label="Inquiries driven" value={a.totalInquiriesDriven} />
            <KpiStatCard label="Participating vendors" value={a.participatingVendorCount} />
            <KpiStatCard label="Active storytellers" value={a.activeCreatorCount} />
          </div>
          {/* The fourth stat here was "Influencer tokens spent", split into
              reach + lead-unlock. Both are ₱0 now: answering an inquiry has been
              free since #3531 and creator outreach became free with the token
              retirement (2026-08-07), so the figure could only ever read 0 while
              implying outreach still costs something. */}
          <p className="text-xs text-ink/70">
            Reaching a storyteller and unlocking a creator-referred inquiry are both free.
            Discounts settle off-platform and are never shown.
          </p>

          {/* Top creators by inquiries driven — aggregate names only. */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Top storytellers by inquiries driven
            </h3>
            <ConsoleTable
              rows={a.topCreators}
              columns={columns}
              rowKey={(c) => c.creatorUserId}
              label="Top storytellers by inquiries driven"
              readPermitted
              reads="the storyteller leaderboard"
              cap={ADMIN_INFLUENCER_TOP_CREATORS_CAP}
              minWidth="24rem"
              empty={{
                Icon: TrendingUp,
                title: 'No attributed inquiries yet',
                blurb:
                  'A storyteller lands on this board when a couple reaches a supplier through their chapter and that supplier opens the inquiry. The board is aggregate only — it never names a couple or an event.',
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
