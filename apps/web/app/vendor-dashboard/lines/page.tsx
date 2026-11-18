import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Check, CircleOff, EyeOff, Link2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateFail, TemplateSection } from '@/app/_components/template-rows';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { slotsIn } from '@/lib/emcee-lines';
import { updateLine, deleteLine, attachLineToActivity } from './actions';
import { StayForm } from '@/app/_components/stay-form';

export const metadata = { title: 'My lines · Supplier' };

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
    <section className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6">
      {/* Rule 1 — the pinned row names the page; the heading stays for a screen reader only. */}
      <h1 className="sr-only">What you say, kept once</h1>

      {sp.error ? (
        <p role="alert" className="py-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
          {sp.error}
        </p>
      ) : null}

      {linesRes.error ? (
        <TemplateFail data="lines">
          We couldn&rsquo;t load your lines just now — they have not been deleted. Reload in a moment.
        </TemplateFail>
      ) : all.length === 0 ? (
        <TemplateSection
          label="Lines you say"
          first
          tip="Every line you write on a wedding lands here, names blanked. The next wedding opens already written. Only you see it."
        >
          <TemplateEmpty data="lines">
            Nothing here yet — write your lines on your next wedding and they land here on their own.
          </TemplateEmpty>
        </TemplateSection>
      ) : null}

      {spoken.length > 0 ? (
        <TemplateSection
          label={`Lines you say · ${spoken.length}`}
          first
          tip="Every line you write on a wedding lands here, names blanked. The next wedding opens already written. Only you see it."
        >
          <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
            {spoken.map((line) => {
              const slots = slotsIn(line.body);
              return (
                <li key={line.line_id} className="py-3">
                  <p className={TEMPLATE_SUBLINE}>
                    {matchedBy(line, line.activity_id ? activityLabel.get(line.activity_id) ?? null : null)}
                    {line.use_count > 0 ? ` · used ${line.use_count}×` : ''}
                  </p>

                  <StayForm door="supLines.updateLine" action={updateLine} className="mt-2 space-y-2">
                    <input type="hidden" name="line_id" value={line.line_id} />
                    <label className="block">
                      <span className="sr-only">Your line</span>
                      <textarea
                        name="body"
                        defaultValue={line.body}
                        rows={3}
                        maxLength={2000}
                        className="w-full rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] leading-relaxed text-ink" // no-card-ok: the textarea's own outline
                      />
                    </label>
                    <p className={TEMPLATE_SUBLINE}>
                      {slots.length > 0
                        ? `Blanks filled per wedding: ${slots.map((s) => `⟨${s}⟩`).join(' · ')}`
                        : 'No blanks in this one — it reads the same at every wedding.'}
                    </p>
                    <ActionButton type="submit" tone="brand" icon={<Check aria-hidden />} label="Save" />
                  </StayForm>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* rung 2 → rung 1: make a by-name guess into an exact match. */}
                    {activities.length > 0 ? (
                      <StayForm door="supLines.attachLineToActivity" action={attachLineToActivity} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="line_id" value={line.line_id} />
                        <Link2 aria-hidden className="h-4 w-4 text-[color:var(--m-slate-2)]" />
                        <label className="sr-only" htmlFor={`act-${line.line_id}`}>
                          Attach to one of your segments
                        </label>
                        <select
                          id={`act-${line.line_id}`}
                          name="activity_id"
                          defaultValue={line.activity_id ?? ''}
                          className="min-h-11 rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 text-[14px] text-ink"
                        >
                          <option value="">Not tied to a segment</option>
                          {activities.map((a) => (
                            <option key={a.activity_id} value={a.activity_id}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                        <ActionButton type="submit" tone="neutral" icon={<Link2 aria-hidden />} label="Update match" />
                      </StayForm>
                    ) : null}

                    <StayForm door="supLines.deleteLine" action={deleteLine} className="ml-auto">
                      <input type="hidden" name="line_id" value={line.line_id} />
                      <ActionButton type="submit" tone="neutral" quiet icon={<CircleOff aria-hidden />} label="Remove" />
                    </StayForm>
                  </div>
                </li>
              );
            })}
          </ul>
        </TemplateSection>
      ) : null}

      {notes.length > 0 ? (
        <TemplateSection
          label={`Notes to yourself · ${notes.length}`}
          tip="Written on private moments, so they are kept for you but never reused on another wedding."
        >
          <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
            {notes.map((line) => (
              <li key={line.line_id} className="py-3">
                <Badge tone="quiet">
                  <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Never reused
                </Badge>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">{line.body}</p>
                <StayForm door="supLines.deleteLine" action={deleteLine} className="mt-2">
                  <input type="hidden" name="line_id" value={line.line_id} />
                  <ActionButton type="submit" tone="neutral" quiet icon={<CircleOff aria-hidden />} label="Remove" />
                </StayForm>
              </li>
            ))}
          </ul>
        </TemplateSection>
      ) : null}

      <p className={`border-t border-[color:var(--m-line)] pt-4 ${TEMPLATE_SUBLINE}`}>
        Editing a line here changes what future weddings start from. It never changes a script
        you have already written for a couple —{' '}
        <Link href="/vendor-dashboard/clients" className="text-link underline">
          those stay as you left them
        </Link>
        .
      </p>
    </section>
  );
}
