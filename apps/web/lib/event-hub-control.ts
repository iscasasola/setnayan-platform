/**
 * apps/web/lib/event-hub-control.ts
 *
 * Pure resolvers for the **Event Hub controller** — the couple's side of their
 * one public address. Design: `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md`
 * (§ 2 the five jobs, § 3.3 the seven slots, § 6 the twelve inputs);
 * drawing: `prototypes/event_hub_controller_2026-09-02.html`.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 * It is NOT a new page and NOT a new engine. `app/dashboard/[eventId]/launch/
 * page.tsx` already renders the three day-of services AND the four public
 * stages; this module gives that page the control-centre ORDER (stage · four
 * facts · one next step · the parts) and makes its copy correct in all three
 * dashboard phases instead of only on the wedding day. Every ownership
 * predicate, every route and every card stays exactly where it already is.
 *
 * Shaped after `lib/live-studio-control.ts`: the decisions are PURE functions
 * so the page and the tests share one source of truth and cannot drift.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🚨 THE TRAP THIS MODULE EXISTS TO HOLD SHUT — TWO RESOLVERS, ONE IMPORT APART
 * ══════════════════════════════════════════════════════════════════════════
 * `getLifecyclePhase` (lib/invitation-widgets) answers **"which of the four
 * public pages is my link showing right now?"** — `save_the_date → rsvp →
 * event → editorial`. It reaches `editorial` by a second path (`getDayOfPhase`
 * === 'post'), so it is NOT a has-it-happened test.
 *
 * `getMenuLifecyclePhase` (lib/day-of-mode) answers **"has this celebration
 * happened?"** — `plan · dayof · after`. That one IS.
 *
 * They are NOT two spellings of one fact, and the everyday proof is the months
 * before the day, which is the whole stretch this build exists for:
 *
 *     107 days out ......... stage = save_the_date   phase = plan
 *      31 days out ......... stage = rsvp            phase = plan
 *
 * Two couples in the SAME dashboard phase whose guests are looking at DIFFERENT
 * pages. Resolve the stage from the menu resolver and both are told their
 * save-the-date is live while their guests are on the RSVP — a page that is
 * confidently wrong, and that no type checker can see because both sides are
 * strings. So: `resolveHubStage` asks the first, `resolveHubPhase` asks the
 * second, neither is derived from the other, and `event-hub-control.test.ts`
 * pins the disagreement.
 *
 * ── AND: UNREAD IS NOT EMPTY ────────────────────────────────────────────────
 * A refused read returning `[]` and a genuinely empty event are byte-identical,
 * and a couple with 180 guests was once told "No guests yet." So every fact
 * below carries `known`, and a fact that was not measured renders as an em-dash
 * — never as a zero, never as a phase guessed from a null date.
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL: the measurement has to reach the RENDER.
 * The shipped pattern this copies: `lib/guests.ts` + `guests-read-is-honest.test.ts`.
 */
import { getLifecyclePhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { getMenuLifecyclePhase, type MenuLifecyclePhase } from '@/lib/day-of-mode';
import { daysUntilEventDay } from '@/lib/event-board';

/** What the controller knows about the event row it was handed. */
export type HubEventRead = {
  /**
   * FALSE when the `events` read was refused. Everything downstream is then
   * unknown — and unknown must not be spoken.
   *
   * ⚠ Without this the defect is silent and total: a refused read yields a null
   * `event_date`, `getLifecyclePhase(null)` returns 'save_the_date' and
   * `getMenuLifecyclePhase(null)` returns 'plan' — so a wedding that happened
   * last month renders as "Save-the-Date · Stage 1 of 4", in output identical
   * to a brand-new event. Both resolvers are behaving correctly; the page is
   * the liar.
   */
  measured: boolean;
  eventDate: string | null;
  eventEndDate?: string | null;
  clearedAt?: string | null;
  timezone?: string | null;
  slug?: string | null;
};

/**
 * The RSVP side of the guest list — and the TWO different reasons it can be
 * absent, which the controller must never merge.
 *
 * 🔑 THREE STATES, NOT TWO. `event-viewer.ts` says it in its own header: a
 * stranger and a delegate-without-the-grant both read nothing, and the screen
 * has to say different things to them. So:
 *
 *   shared:false ....... the host never shared the guest list with this
 *                        coordinator. A FACT, and we may state it.
 *   measured:false ..... the read was refused or failed. We do NOT know, and
 *                        must say only that.
 *   both true .......... the counts are real, including a real zero.
 *
 * Collapsing the first two into one em-dash tells a coordinator the system is
 * broken when the truth is that this part was not shared with them.
 */
export type HubGuestRead = {
  /** False when the host has not shared the guest list with this viewer. */
  shared: boolean;
  /** False when the guest read was refused — the counts are unknown, not zero. */
  measured: boolean;
  invited: number;
  replied: number;
};

/**
 * S1 + the copy split. `stage` is what the GUESTS are looking at; `phase` is
 * where the COUPLE is in the life of the event. Both null when unmeasured.
 */
export type HubStanding = {
  /** Which of the four public pages the one link resolves to right now. */
  stage: LifecyclePhase | null;
  /** plan · dayof · after — drives the copy, the next step and the offers. */
  phase: MenuLifecyclePhase | null;
  /** False when the event read was refused. */
  measured: boolean;
};

/** Today, in the VENUE's clock — not the server's. */
function venueTodayISO(timezone: string | null | undefined, nowMs?: number): string {
  /*
    Same mechanism as `manilaTodayISO` (lib/event-board.ts), generalised to the
    event's own zone rather than copied with a different one: production runs in
    UTC on Vercel, so asking the server what day it is at a wedding in Manila is
    off by up to eight hours — the exact defect `getLifecyclePhase` grew its `tz`
    argument to close. `manilaTodayISO` is deliberately left where it is; moving
    a symbol is how this repo turns path-pinned guards red.
  */
  const now = nowMs === undefined ? new Date() : new Date(nowMs);
  return now.toLocaleDateString('en-CA', { timeZone: timezone ?? 'Asia/Manila' });
}

/**
 * WHICH OF THE FOUR PUBLIC PAGES IS LIVE — the stage the miniature shows.
 *
 * 🔒 Asks `getLifecyclePhase` and ONLY `getLifecyclePhase`. See the trap at the
 * head of this file: the menu resolver cannot answer this, because its 'plan'
 * covers both the save-the-date and the invitation.
 */
export function resolveHubStage(read: HubEventRead, nowMs?: number): LifecyclePhase | null {
  if (!read.measured) return null;
  return getLifecyclePhase(
    read.eventDate,
    read.timezone ?? undefined,
    read.eventEndDate ?? null,
    nowMs,
  );
}

/**
 * HAS THIS CELEBRATION HAPPENED — the copy, the next step and the offers.
 *
 * 🔒 Asks `getMenuLifecyclePhase` and ONLY `getMenuLifecyclePhase`. It is the
 * one the whole dashboard already agrees with (Overview, the rail, the guest
 * list, the Hosts page, the Suite), and it is the only one that reads
 * `cleared_at` — a host who has closed out their day is 'after' even if the
 * public page has not turned over yet.
 */
export function resolveHubPhase(read: HubEventRead, nowMs?: number): MenuLifecyclePhase | null {
  if (!read.measured) return null;
  return getMenuLifecyclePhase(
    read.eventDate,
    read.clearedAt ?? null,
    read.timezone ?? undefined,
    nowMs,
    read.eventEndDate ?? null,
  );
}

/** Both, together — the shape the page renders from. */
export function resolveHubStanding(read: HubEventRead, nowMs?: number): HubStanding {
  return {
    stage: resolveHubStage(read, nowMs),
    phase: resolveHubPhase(read, nowMs),
    measured: read.measured,
  };
}

/**
 * ⛔ NO OFFERS ON THE EVENT DAY (design § 5.1 rule 3). On the day the upsell
 * branch collapses to nothing — an offer never outranks the day. After the day
 * the row closes rather than sells (the shipped "Event over" chip). And an
 * UNMEASURED phase sells nothing either: we do not know whether it is their
 * wedding day.
 */
export function hubOffersAllowed(phase: MenuLifecyclePhase | null): boolean {
  return phase === 'plan';
}

/** S2 — one of the four facts riding the lower edge of the stage. */
export type HubFact = {
  label: string;
  /** Null when the read behind it did not happen. Renders as an em-dash. */
  value: string | null;
  /** False ⇒ unknown. A caller that renders this as 0 has restored the defect. */
  known: boolean;
};

/** What a fact says when the host simply has not shared that part. */
export const NOT_SHARED = 'Not shared with you';

const STAGE_FACT: Record<LifecyclePhase, string> = {
  save_the_date: 'Save-the-Date live',
  rsvp: 'Invitation live',
  event: 'The day itself',
  editorial: 'The story',
};

/** "In 14 days" · "Today" · "Last week" — never a bare negative number. */
function dayFact(read: HubEventRead, nowMs?: number): HubFact {
  const label = 'The day';
  if (!read.measured) return { label, value: null, known: false };
  if (!read.eventDate) return { label, value: 'Not set yet', known: true };
  const days = daysUntilEventDay(read.eventDate, venueTodayISO(read.timezone, nowMs));
  if (days === null) return { label, value: 'Not set yet', known: true };
  if (days === 0) return { label, value: 'Today', known: true };
  if (days === 1) return { label, value: 'Tomorrow', known: true };
  if (days > 1) return { label, value: `In ${days} days`, known: true };
  if (days === -1) return { label, value: 'Yesterday', known: true };
  return { label, value: `${Math.abs(days)} days ago`, known: true };
}

/**
 * THE FOUR FACTS — the stage it is in · replies in of invited · who hasn't
 * replied · days to go. They are the first TEXT on the page even though the
 * stage is the first PAINT.
 *
 * The two reads are independent: the event can be measured while the guest list
 * is refused, and the strip must then state the first two and withhold the
 * other two rather than printing "0 of 0".
 */
export function resolveHubFacts(
  event: HubEventRead,
  guests: HubGuestRead,
  nowMs?: number,
): [HubFact, HubFact, HubFact, HubFact] {
  const stage = resolveHubStage(event, nowMs);
  const pending = Math.max(0, guests.invited - guests.replied);
  return [
    {
      label: 'Stage',
      value: stage ? STAGE_FACT[stage] : null,
      known: stage !== null,
    },
    {
      label: 'Replies',
      value: !guests.shared
        ? NOT_SHARED
        : guests.measured
          ? `${guests.replied} of ${guests.invited} in`
          : null,
      known: !guests.shared || guests.measured,
    },
    {
      label: 'Still quiet',
      value: !guests.shared
        ? NOT_SHARED
        : guests.measured
          ? pending === 0
            ? 'Everyone replied'
            : `${pending} ${pending === 1 ? 'has' : 'have'} not replied`
          : null,
      known: !guests.shared || guests.measured,
    },
    dayFact(event, nowMs),
  ];
}

/** S3 — the single card naming the one thing to do now. */
export type HubNextStep = {
  /** Stable key for tests and for the render's animation identity. */
  key: 'unreadable' | 'link' | 'guests' | 'replies' | 'ready' | 'day' | 'story' | 'preview';
  headline: string;
  blurb: string;
  ctaLabel: string;
  /** Path RELATIVE to `/dashboard/<eventId>`, or '' for the event's own hub. */
  ctaPath: string;
};

/**
 * ONE next step, derived only from what was actually read.
 *
 * 🔑 The order of the branches IS the ruling. An unmeasured read yields the
 * "we could not load this" step and never an instruction: telling a couple with
 * 180 guests to "add the people you are inviting" because a query was refused
 * is the same defect as telling them they have none, wearing a verb.
 *
 * ⛔ And on the day it names the day, never a purchase — friction and offers
 * both lose to the ceremony.
 */
export function resolveHubNextStep(
  standing: HubStanding,
  event: HubEventRead,
  guests: HubGuestRead,
): HubNextStep {
  if (!standing.measured || standing.phase === null) {
    return {
      key: 'unreadable',
      headline: 'We could not load your event just now.',
      blurb:
        'Nothing has been lost — your page, your guests and your services are all still there. We just could not reach them this time.',
      ctaLabel: 'Try again',
      ctaPath: '/launch',
    };
  }

  if (standing.phase === 'dayof') {
    return {
      key: 'day',
      headline: 'It is the day.',
      blurb:
        'Everything below is one press — no confirmations, nothing to buy. Your page has already turned itself over to the day.',
      ctaLabel: 'Open as a guest',
      ctaPath: '',
    };
  }

  if (standing.phase === 'after') {
    return {
      key: 'story',
      headline: 'The day, as it will be told.',
      blurb:
        'Your link keeps going: it becomes the story and the album your guests come back to. Write it while you still remember the small things.',
      ctaLabel: 'Open the story',
      ctaPath: '/website/editorial',
    };
  }

  if (!event.slug) {
    return {
      key: 'link',
      headline: 'Your one link is not set yet.',
      blurb:
        'Everything your guests ever see lives at one address. Choose it once and it carries the save-the-date, the invitation, the day and the story.',
      ctaLabel: 'Set your link',
      ctaPath: '/website/editor',
    };
  }

  if (!guests.shared) {
    /*
      A coordinator the host never gave the guest list to. Their replies are not
      theirs to see — but the rest of this page IS, so they get a next step
      about the part they do hold rather than a locked screen or, worse, an
      instruction built on rows they were refused.
    */
    return {
      key: 'preview',
      headline: 'Look at the page the way a guest does.',
      blurb:
        'The guest list has not been shared with you, so the replies are not yours to see. Everything else on this page is.',
      ctaLabel: 'Open as a guest',
      ctaPath: '',
    };
  }

  if (!guests.measured) {
    return {
      key: 'unreadable',
      headline: 'We could not load your guest list just now.',
      blurb:
        'Nothing has been lost — everyone you have added is still there. We just could not reach them this time, so the reply counts above are blank rather than wrong.',
      ctaLabel: 'Try again',
      ctaPath: '/launch',
    };
  }

  if (guests.invited === 0) {
    return {
      key: 'guests',
      headline: 'Add the people you are inviting.',
      blurb:
        'Your page is ready before they are. Once names are in, the replies land here and each guest gets their own way in.',
      ctaLabel: 'Add guests',
      ctaPath: '/guests',
    };
  }

  const pending = Math.max(0, guests.invited - guests.replied);
  if (pending > 0) {
    return {
      key: 'replies',
      headline: `${pending} ${pending === 1 ? 'guest has' : 'guests have'} not replied yet.`,
      blurb: 'A gentle nudge goes a long way — see who is still quiet and ask them again.',
      ctaLabel: 'See who',
      ctaPath: '/guests',
    };
  }

  return {
    key: 'ready',
    headline: 'Every reply is in.',
    blurb:
      'Your list is settled. Look at the day the way your guests will see it, and change anything that reads wrong.',
    ctaLabel: 'Preview the day',
    ctaPath: '/launch',
  };
}
