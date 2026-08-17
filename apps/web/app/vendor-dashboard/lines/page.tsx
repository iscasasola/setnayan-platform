import { redirect } from 'next/navigation';
import Link from 'next/link';
import { EyeOff, Link2, Mic } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { slotsIn } from '@/lib/emcee-lines';
import { updateLine, deleteLine, attachLineToActivity } from './actions';

export const metadata = { title: 'My lines · Vendor' };

/**
 * MY LINES — the emcee's script library.
 *
 * Owner-locked 2026-08-01, spec item 5. Sibling of
 * `/vendor-dashboard/activities` (his named segments) and deliberately the same
 * kind of screen: a vendor-owned reusable list, plain form posts, no client
 * state machine.
 *
 * ── WHY THIS SCREEN EXISTS ─────────────────────────────────────────────────
 *
 * Lines land here automatically as he writes them on a wedding — the save is
 * automatic precisely because an explicit "save to my lines" is curation
 * homework skipped 40×/year. This is where he sees what has accumulated, fixes
 * a phrasing he has outgrown, and retires one.
 *
 * ── THREE THINGS THIS SCREEN MUST NOT GET WRONG ────────────────────────────
 *
 *  1. SHOW THE TEMPLATE, SLOTS AND ALL. Not a filled preview. The whole promise
 *     is that a stored line carries no real person, and he should be able to
 *     SEE that — `⟨the couple⟩`, not "Bea & Marco". Seeing the slot is also how
 *     he learns to write one.
 *  2. PRIVATE LINES ARE SEPARATED AND LABELLED NEVER-REUSED. They are here so
 *     he can find them, not so they get used. `matchLines` refuses them at the
 *     source; this screen must not imply otherwise.
 *  3. EDITING HERE NEVER TOUCHES A WEDDING. The library is upstream of every
 *     event copy, never retroactive — rewriting a script he has already
 *     rehearsed would be the worst thing this screen could do.
 */

type LineRow = {
  line_id: string;
  activity_id: string | null;
  label_key: string | null;
  block_type: string | null;
  body: string;
  is_private_note: boolean;
  use_count: number;
  last_used_at: string | null;
};

type ActivityRow = { activity_id: string; label: string };

/** How a saved line will be found again — the rung, in his words not ours. */
function matchedBy(line: LineRow, activityLabel: string | null): string {
  if (line.activity_id) return `Your segment · ${activityLabel ?? 'a segment of yours'}`;
  if (line.label_key) return `When a moment is called “${line.label_key}”`;
  if (line.block_type) return `Any ${line.block_type.replace(/_/g, ' ')} — only when there is just one`;
  return 'Not matched to anything yet';
}

export default async function VendorLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/lines');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard/verify');

  const [linesRes, activitiesRes] = await Promise.all([
    supabase
      .from('vendor_lines')
      .select('line_id, activity_id, label_key, block_type, body, is_private_note, use_count, last_used_at')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .is('deleted_at', null)
      .order('last_used_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('vendor_activities')
      .select('activity_id, label')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('display_order', { ascending: true }),
  ]);

  const all = (linesRes.data ?? []) as LineRow[];
  const activities = (activitiesRes.data ?? []) as ActivityRow[];
  const activityLabel = new Map(activities.map((a) => [a.activity_id, a.label]));

  const spoken = all.filter((l) => !l.is_private_note);
  const notes = all.filter((l) => l.is_private_note);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/60">My lines</p>
        <h1 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          What you say, kept once
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink/70">
          Every line you write on a wedding is saved here automatically, with the couple&rsquo;s
          names swapped out for a blank. The next wedding opens already written in your words —
          you only change what is different. Nobody else ever sees this list.
        </p>
      </header>

      {sp.error ? (
        <p
          role="alert"
          className="border border-terracotta-700/40 bg-terracotta-700/5 px-4 py-3 text-sm text-terracotta-700"
        >
          {sp.error}
        </p>
      ) : null}

      {all.length === 0 ? (
        <div className="border border-ink/10 bg-paper-deep p-6 text-center">
          <Mic aria-hidden className="mx-auto h-6 w-6 text-ink/25" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-ink">Nothing here yet — and that is fine.</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink/65">
            Write your lines on your next wedding and they land here on their own. From the
            wedding after that, most of your script arrives already written.
          </p>
        </div>
      ) : null}

      {spoken.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
            Lines you say · {spoken.length}
          </h2>
          {spoken.map((line) => {
            const slots = slotsIn(line.body);
            return (
              <article key={line.line_id} className="border border-ink/10 bg-white p-4">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink/50">
                  {matchedBy(line, line.activity_id ? activityLabel.get(line.activity_id) ?? null : null)}
                  {line.use_count > 0 ? ` · used ${line.use_count}×` : ''}
                </p>

                <form action={updateLine} className="mt-2 space-y-2">
                  <input type="hidden" name="line_id" value={line.line_id} />
                  <label className="block">
                    <span className="sr-only">Your line</span>
                    <textarea
                      name="body"
                      defaultValue={line.body}
                      rows={3}
                      maxLength={2000}
                      className="w-full border border-ink/15 bg-white px-3 py-2 font-pahina text-[15px] leading-relaxed text-ink"
                    />
                  </label>
                  {slots.length > 0 ? (
                    <p className="text-xs text-ink/55">
                      Blanks filled per wedding: {slots.map((s) => `⟨${s}⟩`).join(' · ')}
                    </p>
                  ) : (
                    <p className="text-xs text-ink/45">
                      No blanks in this one — it reads the same at every wedding.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      className="border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-paper"
                    >
                      Save
                    </button>
                  </div>
                </form>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-3">
                  {/* rung 2 → rung 1: make a by-name guess into an exact match. */}
                  {activities.length > 0 ? (
                    <form action={attachLineToActivity} className="flex items-center gap-2">
                      <input type="hidden" name="line_id" value={line.line_id} />
                      <Link2 aria-hidden className="h-3.5 w-3.5 text-ink/45" />
                      <label className="sr-only" htmlFor={`act-${line.line_id}`}>
                        Attach to one of your segments
                      </label>
                      <select
                        id={`act-${line.line_id}`}
                        name="activity_id"
                        defaultValue={line.activity_id ?? ''}
                        className="border border-ink/15 bg-white px-2 py-1 text-xs text-ink"
                      >
                        <option value="">Not tied to a segment</option>
                        {activities.map((a) => (
                          <option key={a.activity_id} value={a.activity_id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs font-semibold text-gild underline">
                        Update match
                      </button>
                    </form>
                  ) : null}

                  <form action={deleteLine} className="ml-auto">
                    <input type="hidden" name="line_id" value={line.line_id} />
                    <button type="submit" className="text-xs text-ink/50 underline hover:text-terracotta-700">
                      Remove
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
            <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Notes to yourself · {notes.length}
          </h2>
          <p className="max-w-prose text-xs leading-relaxed text-ink/60">
            These were written on private moments, so they are kept for you to look back on but
            are <strong className="text-ink">never reused on another wedding</strong> — the
            coordinator, the cue, the room are different every time.
          </p>
          {notes.map((line) => (
            <article key={line.line_id} className="border border-ink/25 bg-ink/[0.03] p-4">
              <p className="inline-flex items-center gap-1.5 bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper">
                <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} />
                Never reused
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{line.body}</p>
              <form action={deleteLine} className="mt-3 border-t border-ink/10 pt-3">
                <input type="hidden" name="line_id" value={line.line_id} />
                <button type="submit" className="text-xs text-ink/50 underline hover:text-terracotta-700">
                  Remove
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : null}

      <p className="border-t border-ink/10 pt-4 text-xs leading-relaxed text-ink/55">
        Editing a line here changes what future weddings start from. It never changes a script
        you have already written for a couple —{' '}
        <Link href="/vendor-dashboard/clients" className="underline">
          those stay as you left them
        </Link>
        .
      </p>
    </section>
  );
}
