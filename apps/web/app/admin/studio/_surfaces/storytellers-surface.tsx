import Link from 'next/link';
import { loadStorytellerCandidatesForAdmin } from '@/lib/storytellers';
import { setChapterFeatured, setChapterRank } from '@/app/admin/storytellers/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';

/**
 * StorytellersSurface — the chapter-featuring body of the tabbed /admin/studio
 * hub (Storytellers council verdict 2026-07-16 · PR-D), the next sibling
 * beside real-stories-surface.tsx in the established tab-hub pattern.
 *
 * Candidate list = ALL published chapters on public-profile accounts, newest
 * first (featured rows sorted to the top exactly as the public shelf orders
 * them), each with its YouTube-derived embed preview, owner, kind, view count,
 * and open-report count inline — THE FEATURING CLICK IS THE MODERATION REVIEW.
 *
 * Deny-by-default: publishing never lists a chapter; only rows the owner
 * Features here ever render in the "From Our Storytellers" shelf on
 * /realstories. Non-YouTube chapters show an honest "not featurable (V1)"
 * note — the thumbnail curation rule — and the action refuses them serverside
 * too. Edits revalidate /realstories live — no redeploy.
 */

const INPUT =
  'w-24 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink';
const BTN_PRIMARY =
  'rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta/90';
const BTN_SECONDARY =
  'rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta';

export async function StorytellersSurface({
  ok: okRaw,
  error: errorRaw,
}: {
  ok?: string;
  error?: string;
}) {
  const ok = okRaw ? decodeURIComponent(okRaw) : null;
  const error = errorRaw ? decodeURIComponent(errorRaw) : null;

  const result = await loadStorytellerCandidatesForAdmin();
  const rows = result.ok ? result.rows : [];
  const featuredCount = rows.filter((r) => r.featured).length;

  return (
    <div>
      <header className="mb-8 space-y-2">
        <p className="sn-eye">Setnayan HQ · Platform</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Storytellers
        </h1>
        <p className="max-w-3xl text-base text-ink/65">
          Choose which published creator chapters get{' '}
          <strong className="font-semibold text-ink">featured</strong> in the
          &ldquo;From Our Storytellers&rdquo; shelf on the public{' '}
          <Link
            href="/realstories#storytellers"
            className="underline hover:text-terracotta"
          >
            Real Stories
          </Link>{' '}
          page, and in what order. Publishing never lists a chapter by itself —
          your Feature click here is the moderation review (deny-by-default).
          With zero featured chapters the shelf doesn&rsquo;t render at all. V1
          shelf thumbnails are YouTube-derived, so only chapters with a YouTube
          embed are featurable.
        </p>
      </header>

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

      {/* Migration-not-applied state — the featuring columns don't exist yet. */}
      {!result.ok && result.reason === 'migration' ? (
        <div className="rounded-2xl border border-warn-200 bg-warn-50 p-6 text-sm text-warn-900">
          <p className="font-semibold">Almost there — one database step left.</p>
          <p className="mt-2">
            The chapter-featuring columns haven&rsquo;t been added to the
            database yet. Run the migration{' '}
            <code className="rounded bg-warn-100 px-1 py-0.5 font-mono text-[12px]">
              20270818771487_storytellers_chapter_featuring.sql
            </code>{' '}
            (
            <code className="rounded bg-warn-100 px-1 py-0.5 font-mono text-[12px]">
              supabase db push --db-url &quot;$SUPABASE_DB_URL&quot;
            </code>
            ), then reload this page. Until then, /realstories renders exactly
            as before — no Storytellers shelf.
          </p>
        </div>
      ) : !result.ok ? (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-6 text-sm text-danger-800">
          Couldn&rsquo;t load chapters right now. Try again in a moment.
        </div>
      ) : rows.length === 0 ? (
        /* Empty state — no published chapters on public profiles yet. */
        <div className="rounded-2xl border border-ink/10 bg-white/60 p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">
            No published chapters yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink/65">
            Chapters appear here the moment a storyteller with a public profile
            publishes one — every published chapter is a candidate, newest
            first. Until you feature one, the public Real Stories page shows no
            Storytellers shelf at all.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink/55">
            {rows.length} published {rows.length === 1 ? 'chapter' : 'chapters'} ·{' '}
            {featuredCount} featured
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
                <tr>
                  <th className="px-4 py-3 font-medium">Chapter</th>
                  <th className="px-4 py-3 font-medium">Featured</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {rows.map((r) => {
                  const anchor = `st-${r.publicId.toLowerCase()}`;
                  const meta = [
                    `@${r.ownerSlug}`,
                    r.kindLabel,
                    `${r.viewCount} ${r.viewCount === 1 ? 'view' : 'views'}`,
                  ].join(' · ');
                  return (
                    <tr
                      key={r.publicId}
                      id={anchor}
                      className={r.featured ? 'bg-terracotta/[0.04]' : undefined}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-3">
                          {/* Embed preview — the YouTube-derived thumb (the V1
                              featurability signal doubles as the preview). */}
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
                            <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-ink/[0.03] text-center font-mono text-[9px] uppercase leading-tight tracking-wide text-ink/40">
                              {r.embedProvider ?? 'no embed'}
                            </span>
                          )}
                          <div className="min-w-0">
                            {r.href ? (
                              <Link
                                href={r.href}
                                className="font-medium text-ink hover:text-terracotta hover:underline"
                              >
                                {r.title}
                              </Link>
                            ) : (
                              <span className="font-medium text-ink">{r.title}</span>
                            )}
                            <p className="mt-0.5 text-xs text-ink/55">{meta}</p>
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
                            {!r.thumbUrl ? (
                              <p className="mt-1 text-[11px] text-ink/50">
                                Not featurable (V1) — no YouTube thumbnail to
                                derive. It stays live on the creator&rsquo;s page.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.featured ? (
                          <span className="inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-800">
                            Featured
                          </span>
                        ) : (
                          <span className="text-xs text-ink/45">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.featured ? (
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
                          <span className="text-xs text-ink/45">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {r.featured ? (
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
                        ) : r.thumbUrl ? (
                          <ConfirmForm
                            action={setChapterFeatured}
                            title="Feature in From Our Storytellers?"
                            confirmLabel="Feature"
                            destructive={false}
                            message="This chapter goes live in the Storytellers shelf on the public Real Stories page and the creator is notified. Featuring is the moderation review — watch it first. You can set its order next."
                          >
                            <input type="hidden" name="public_id" value={r.publicId} />
                            <input type="hidden" name="feature" value="1" />
                            <SubmitButton pendingLabel="Updating…" className={BTN_PRIMARY}>
                              Feature
                            </SubmitButton>
                          </ConfirmForm>
                        ) : (
                          <span className="text-xs text-ink/45">Not featurable</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-ink/50">
            Lower order numbers show first on the shelf. Leave the order blank
            to sort after the numbered ones (then by most-recently featured).
            Unfeaturing also clears the order. A report resolved as
            &ldquo;hide&rdquo; in User Reports unfeatures the chapter
            automatically.
          </p>
        </>
      )}
    </div>
  );
}
