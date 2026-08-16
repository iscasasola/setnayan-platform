import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  buildYearMoments,
  buildSelfMoments,
  mergeSelfMoments,
  type MomentEvent,
  type SelfForMoments,
} from '@/lib/year-moments';
import { YearMomentsList, type YearMomentView } from './year-moments-list';

/**
 * "Your year" home strip (date-anchor model). A compact, self-fetching preview
 * of the DERIVED moments (own birthday · anniversaries · wedding countdowns),
 * surfaced on the launcher home so the lifecycle model is felt where users land
 * — the design's "Year view ≈ the Membership home surface".
 *
 * Holidays are intentionally excluded here (they live in the full /dashboard/year
 * view) so the home strip stays PERSONAL.
 *
 * The strip shows the first few moments and expands the rest INLINE via
 * <YearMomentsList>, AND carries that list's "See the year →" door to the full
 * /dashboard/year calendar (re-linked 2026-07-15 under the owner's "nothing
 * orphaned" directive, superseding the 2026-07-13 de-link that had left the
 * full Year view without an in-app doorway). Event moments still deep-link into
 * their dashboards.
 *
 * ── 🚨 IT USED TO RETURN null WHEN EMPTY, AND THAT SEALED THE ONLY DOOR ─────
 * The list this strip renders carries the ONLY in-app link to /dashboard/year
 * that exists — measured 2026-08-15: a repo-wide sweep for `dashboard/year`
 * finds one href, and it is inside <YearMomentsList>. So `return null` did not
 * merely hide a strip; it made the whole Year view unreachable by clicking, for
 * every person whose moments happened to be empty. Three real classes were
 * locked out: a brand-new account with no events, an account whose events are
 * all ones they were INVITED to (this strip reads organiser rows only), and one
 * whose events are all archived. The page they could not reach renders content
 * for them — its own call passes no options, so `includeHolidays` defaults true
 * and Christmas and Valentine's are sitting on it.
 *
 * 🔑 A DOORWAY THAT ONLY OPENS WHEN THERE IS ALREADY SOMETHING BEHIND IT IS NOT
 * A DOORWAY. The empty branch below is the fix, and it is deliberately the
 * branch that carries the two links: the page, and the profile field that fills
 * it. `Route_Wayfinding_Audit_2026-07-15`: a nav row is not a doorway; a
 * rendered link is.
 *
 * The "zero home clutter" instinct the null return came from is still honoured —
 * the empty branch is one small tile that says something true and offers the two
 * things that make it stop being empty, not a placeholder pretending to be data.
 *
 * ── THE ORGANISER FILTER STAYS, DELIBERATELY ────────────────────────────────
 * The event read below is `member_type = 'couple'` while the board above it
 * renders the MERGED organiser+invited set, and that mismatch is the reason an
 * invited-only person got no strip. It is NOT widened here, because every label
 * `buildYearMoments` produces is written in the first person — "Your 3rd wedding
 * anniversary", "your wedding" — and saying that to somebody who was a GUEST at
 * that wedding is worse than saying nothing. What actually fixed that person's
 * case is the own-birthday moment, which needs no event at all, plus the empty
 * branch's door. Widening the filter means rewriting the labels per membership
 * first; that is a product change, not a query change.
 */

const HOME_LIMIT = 3;

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
});

function fmt(iso: string): string {
  return FMT.format(new Date(`${iso}T12:00:00+08:00`));
}

function countdown(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'in ~1 month' : `in ~${months} months`;
}

export async function YearMomentsStrip({ userId }: { userId: string }) {
  const supabase = await createClient();
  const today = manilaToday();

  const [{ data: rows, error: rowsErr }, { data: selfRow, error: selfErr }] = await Promise.all([
    supabase
      .from('event_members')
      .select(
        `member_type,
       events:event_id (
         event_id, event_type, display_name, event_date,
         anchor_date, anchor_origin, recurs, recur_cadence, archived
       )`,
      )
      .eq('user_id', userId)
      .eq('member_type', 'couple'),
    // THEIR OWN birthday, from their own profile. Not gated on
    // `public_greeting_opt_in` — that flag governs greeting somebody PUBLICLY
    // (the admin social queue selects on it and must keep doing so); showing
    // you your own date on your own home publishes nothing.
    supabase.from('users').select('birth_date, sex').eq('user_id', userId).maybeSingle(),
  ]);

  // Supabase RESOLVES with an error, it does not throw. Logging it is half the
  // job; the other half is NOT STATING A FACT WE DID NOT ESTABLISH — see
  // <EmptyYear>'s `unsure` branch.
  if (rowsErr) logQueryError('YearMomentsStrip (event_members)', rowsErr);
  if (selfErr) logQueryError('YearMomentsStrip (users birthday)', selfErr);
  const readFailed = Boolean(rowsErr) || Boolean(selfErr);

  const events: MomentEvent[] = (rows ?? []).flatMap((r) => {
    const e = (r as { events: MomentEvent | MomentEvent[] | null }).events;
    return e ? (Array.isArray(e) ? e : [e]) : [];
  });

  // Personal anchor moments only — holidays stay in the full Year view. The own
  // birthday is folded in HERE rather than inside buildYearMoments because it
  // comes from the profile, not from an event: it is the one moment an account
  // can offer before it has a single event on it. `mergeSelfMoments` drops it
  // when an event already holds that day, so one date never prints twice.
  const moments = mergeSelfMoments(
    buildYearMoments(events, today, { includeHolidays: false }),
    buildSelfMoments((selfRow as SelfForMoments | null) ?? null, today),
  );

  if (moments.length === 0) return <EmptyYear unsure={readFailed} />;

  // Precompute display strings server-side (Asia/Manila) so the client list
  // never re-derives dates or timezones.
  const views: YearMomentView[] = moments.map((m) => ({
    key: `${m.kind}-${m.dateISO}-${m.label}`,
    isWedding: m.kind === 'wedding',
    label: m.label,
    dateLabel: fmt(m.dateISO),
    countdownLabel: countdown(m.daysUntil),
    isMilestone: m.isMilestone,
    eventId: m.eventId ?? null,
  }));

  // "This year" glass row — the strip renders INSIDE the Alaala section
  // (owner-approved final home design 2026-07-15); its old standalone
  // "Your year" section merged into Alaala, killing the events/year dupe.
  // The glass panel lives HERE (not around the call site) so the tile never
  // leaves an empty frame on the page.
  return (
    <Tile>
      <YearMomentsList moments={views} initial={HOME_LIMIT} />
    </Tile>
  );
}

/**
 * The one glass panel both branches render through. Shared on purpose: two
 * copies of the shell is how a heading, a radius or a padding change lands on
 * the populated tile and never on the empty one — and the empty one is the
 * tile a brand-new account actually sees.
 */
function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div className="sn-tile-glass sn-lift-3 rounded-2xl p-4 sm:p-[18px]">
      <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-700)]">
        This year
      </h3>
      {children}
    </div>
  );
}

/**
 * Nothing to show — say only what is true, and offer the two things that change
 * it. This branch exists because the alternative (`return null`) took the only
 * link to the Year view down with it; see the 🚨 note at the top of this file.
 *
 * ── 🚨 ITS FIRST CUT ASSERTED SOMETHING FALSE, TWICE OVER ───────────────────
 * It said *"Nothing comes back around yet."* — a claim about the person's whole
 * life, made from a list that is filtered to **366 days**. Two states reached
 * it and neither is "nothing":
 *
 *   · A couple whose wedding is more than a year out. Measured: a 2028-02-14
 *     wedding yields ZERO moments today. The board directly above the tile shows
 *     that wedding as a card with its date, and the tile underneath told them
 *     nothing comes back around. **Same screen, two contradictory statements**,
 *     and the sentence is the one a person believes.
 *   · A refused read. `return null` used to make that invisible — a silent
 *     absence, but never a false statement. Turning it into a tile turned it
 *     into a lie, and the comment at the read site had already named that exact
 *     risk while fixing only the logging half of it.
 *
 * 🔑 **A COMPONENT THAT REPLACES `null` INHERITS THE OBLIGATION TO BE TRUE.**
 * Hiding says nothing and is safe; speaking is a claim, and every state that
 * reaches it has to make the claim correct. The copy is now scoped to the window
 * the derivation actually used ("in the year ahead"), and `unsure` swaps the
 * claim out entirely for a read we could not complete — the doors stay in both,
 * because holding the door open is this branch's whole job.
 *
 * The invitation line states the RULE rather than the person's state, because it
 * also shows in the edge case where a birthday IS stored but unusable (a date in
 * the current or a future year — `buildSelfMoments` drops those rather than print
 * "turning 0"). "Add your birthday" is a correct instruction either way; "you
 * haven't added one" would not be.
 */
function EmptyYear({ unsure = false }: { unsure?: boolean }) {
  return (
    <Tile>
      {unsure ? (
        <p className="text-sm text-ink/70">We couldn’t load your dates just now.</p>
      ) : (
        <p className="text-sm text-ink/70">Nothing in the year ahead yet.</p>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-ink/50">
        {unsure
          ? 'Your year is still there — open it below, or try again in a moment.'
          : 'Your birthday, an anniversary, anything you mark as a yearly thing — it lands here and returns every year.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/dashboard/profile"
          className="text-xs font-semibold text-[color:var(--sn-gold-700)] underline-offset-4 hover:underline"
        >
          Add your birthday
        </Link>
        <Link
          href="/dashboard/year"
          className="text-xs font-semibold text-ink/55 underline-offset-4 hover:text-ink hover:underline"
        >
          See the year →
        </Link>
      </div>
    </Tile>
  );
}
