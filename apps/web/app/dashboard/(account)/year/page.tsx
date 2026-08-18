import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarHeart, Sparkles, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import {
  buildYearMoments,
  buildSelfMoments,
  mergeSelfMoments,
  type MomentEvent,
  type SelfForMoments,
  type YearMoment,
} from '@/lib/year-moments';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { buildDependentMoments, type DependentForMoments } from '@/lib/dependent-moments';
import { buildDependentRiteMoments, type DependentForRites } from '@/lib/faith-rites';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { logQueryError } from '@/lib/supabase/error-detect';

export const metadata = { title: 'Your year' };

/**
 * "Your year" — the account-level MOMENTS calendar (date-anchor model, PR-F).
 * Every entry is DERIVED at read time from the couple's anchors (+ a small
 * authored holiday set): anniversaries recur off their anchor date, an
 * on-platform wedding surfaces its own anniversary or a countdown, Christmas
 * and Valentine's return every year. Nothing here is a stored row — a moment
 * becomes an event only when the couple taps to plan it (the go-signal).
 *
 * Deterministic + free (Rule 1).
 *
 * ⚠ PII: this docblock used to say "zero PII in this first cut (no birthdate
 * path)" and that stopped being true on 2026-08-15, twelve lines above the read
 * that broke it. It reads ONE birthdate — `users.birth_date`, the SIGNED-IN
 * PERSON'S OWN, typed by them into their own profile and rendered only to them
 * (the self-consented Phase-1 slate, un-gated). Somebody ELSE's birthdate still
 * arrives only with the counsel-gated dependent People layer below, which is
 * why that gate is still here and still closed. Corrected because the DPO is
 * the owner and the next person auditing which surfaces touch personal data
 * greps this page, reads the old sentence, and stops.
 */

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatMoment(iso: string): string {
  // iso is a plain YYYY-MM-DD; render at Manila noon so the civil day is stable.
  return FMT.format(new Date(`${iso}T12:00:00+08:00`));
}

function countdown(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'in about a month' : `in about ${months} months`;
}

function MomentIcon({ kind }: { kind: YearMoment['kind'] }) {
  if (kind === 'holiday') return <Gift aria-hidden className="h-5 w-5" />;
  if (kind === 'wedding') return <Sparkles aria-hidden className="h-5 w-5" />;
  return <CalendarHeart aria-hidden className="h-5 w-5" />;
}

export default async function YearPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Events the user co-hosts, with just the anchor columns the derivation needs.
  const { data: rows, error: rowsError } = await supabase
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         event_id, event_type, display_name, event_date,
         anchor_date, anchor_origin, recurs, recur_cadence, archived
       )`,
    )
    .eq('user_id', user.id)
    .eq('member_type', 'couple');
  // ⚠ the events this person belongs to. Refused, their year reads as empty — every
  // ⚠ celebration they are part of disappears from the one page that lists them all.
  if (rowsError) {
    logQueryError('YearPage.rows', rowsError, {}, 'graceful_degrade');
  }

  const events: MomentEvent[] = (rows ?? [])
    .flatMap((r) => {
      const e = (r as { events: MomentEvent | MomentEvent[] | null }).events;
      return e ? (Array.isArray(e) ? e : [e]) : [];
    })
    .filter(Boolean);

  const today = manilaToday();

  // Family graph (Phase 3, flag-off): fold the guardian's dependents' next
  // milestones (a child's 7th/debut, an elder's 60th) into the year. Gated —
  // inert until dependentPeopleEnabled() + counsel clearance. Each of the two
  // RA 10173 data-privacy controls is ANDed in: `dependent_minor_profiles` gates
  // reading dependents at all, and `faith_religion_graph` separately gates the
  // religion→rite moments (religion is sensitive PI). Fail-closed on both.
  let dependentMoments: YearMoment[] = [];
  if (dependentPeopleEnabled() && (await isDataPrivacyControlActive('dependent_minor_profiles'))) {
    const { data: deps, error: depsError } = await supabase
      .from('dependents')
      // `dependent_kind` is selected because the milestone ladder below is the
      // HUMAN one — without it a business's founding date would surface as its
      // "debut". buildDependentMoments skips every non-person kind.
      .select('dependent_id, name, birth_date, sex, religion, claimed_user_id, dependent_kind');
    // ⚠ their dependents' occasions. Refused, those drop out of the year too.
    if (depsError) {
      logQueryError('YearPage.deps', depsError, {}, 'graceful_degrade');
    }
    // Exclude the row I CLAIMED as my own profile (post hand-over, owner =
    // claimant) — my own debut isn't an "alaga moment". A former guardian's
    // read-only history rows still nudge (their kid's birthday is still theirs
    // to celebrate).
    const rows = ((deps ?? []) as (DependentForMoments & {
      religion: string | null;
      claimed_user_id: string | null;
    })[]).filter((d) => d.claimed_user_id !== user.id);
    const faithEnabled = await isDataPrivacyControlActive('faith_religion_graph');
    dependentMoments = [
      ...buildDependentMoments(rows as DependentForMoments[], today),
      ...(faithEnabled ? buildDependentRiteMoments(rows as DependentForRites[], today) : []),
    ];
  }

  // Their OWN birthday — the one date an account carries before it carries a
  // single event. Un-gated on purpose: it is self-consented data on the
  // person's own screen, unlike the dependents above. See buildSelfMoments.
  const { data: selfRow, error: selfErr } = await supabase
    .from('users')
    .select('birth_date, sex')
    .eq('user_id', user.id)
    .maybeSingle();
  // Its twin in year-moments-strip.tsx checks this and this one did not, in the
  // same change. A rejected read (a column revoke, a policy narrowing) resolves
  // with `error` and never throws, so it would leave `selfMoments` empty and
  // print "Add your birthday" to somebody who typed theirs months ago — forever,
  // with nothing in the logs to find it by.
  if (selfErr) logQueryError('YearPage (users birthday)', selfErr);

  const selfMoments = buildSelfMoments((selfRow as SelfForMoments | null) ?? null, today);

  // mergeSelfMoments drops the profile birthday when an event already holds that
  // calendar day, so one date never prints twice (a birthday created through
  // onboarding is `recurs: true` by default and collides exactly).
  const moments = [
    ...mergeSelfMoments(buildYearMoments(events, today), selfMoments),
    ...dependentMoments,
  ].sort((a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
  const nudges = moments.filter((m) => m.isMilestone);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="sn-chip sn-press w-fit" href="/dashboard">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Back to events
      </Link>

      <header className="mt-6 space-y-2">
        <p className="sn-eye">
          <CalendarHeart aria-hidden strokeWidth={1.75} />
          The dates ahead
        </p>
        <h1 className="sn-h1">Your year</h1>
        <p className="max-w-prose text-base text-ink/65">
          The moments ahead — anniversaries, and the dates worth gathering for. Nothing here is
          on your plate yet; tap one when you’re ready to plan it.
        </p>
      </header>

      {/* The one date this page can offer before the account has any events —
          and the only reason it would be missing is that nobody has typed it.
          Shown only when it IS missing, so it disappears the moment it is
          answered rather than nagging someone who already did. */}
      {selfMoments.length === 0 ? (
        <p className="sn-row mt-6 px-4 py-3 text-sm text-ink/65">
          <Link className="font-medium text-ink underline underline-offset-4" href="/dashboard/profile">
            Add your birthday
          </Link>{' '}
          and it will be here every year.
        </p>
      ) : null}

      {nudges.length > 0 ? (
        <section className="mt-8">
          <h2 className="sn-sec">Worth planning for</h2>
          <ul className="mt-3 space-y-3">
            {nudges.map((m) => (
              <li key={`${m.kind}-${m.dateISO}-${m.label}`}>
                <MomentCard moment={m} highlight />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="sn-sec">The year ahead</h2>
        {moments.length === 0 ? (
          <p className="sn-tile mt-3 px-4 py-8 text-center text-sm text-ink/55">
            Nothing on your calendar yet. Create an anniversary or a celebration and it’ll appear
            here every year.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {moments.map((m) => (
              <li key={`all-${m.kind}-${m.dateISO}-${m.label}`}>
                <MomentCard moment={m} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MomentCard({ moment: m, highlight = false }: { moment: YearMoment; highlight?: boolean }) {
  const inner = (
    <div
      className={[
        'sn-row flex items-center gap-4 px-4 py-3.5 transition-colors',
        highlight
          ? 'border-gold/40 bg-gold/[0.08] hover:bg-gold/[0.12]'
          : 'hover:bg-white/85',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          highlight ? 'bg-gold/15 text-gold-deep' : 'bg-ink/[0.06] text-ink/55',
        ].join(' ')}
      >
        <MomentIcon kind={m.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{m.label}</p>
        <p className="truncate text-sm text-ink/55">
          <span className="font-mono">{formatMoment(m.dateISO)}</span>
          {m.detail ? <span className="text-ink/40"> · {m.detail}</span> : null}
        </p>
      </div>
      <span
        className={[
          'shrink-0 whitespace-nowrap font-mono text-xs font-medium',
          highlight ? 'text-gold-deep' : 'text-ink/45',
        ].join(' ')}
      >
        {countdown(m.daysUntil)}
      </span>
    </div>
  );

  // A moment tied to an event links to it; a holiday prompts a create flow.
  const href = m.eventId ? `/dashboard/${m.eventId}` : '/dashboard/create-event';
  return (
    <Link className="sn-press block" href={href}>
      {inner}
    </Link>
  );
}
