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
import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';

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

/**
 * EH5 · THE WORKROOM'S OWN FACTS — read when `event_editorial` was asked.
 * `measured` false means the row read was refused, not that the story is
 * empty; a genuinely absent row (the couple has not opened the workroom yet)
 * IS a measured absence (`maybeSingle` returns `data: null` with no error —
 * see `HubEventRead.measured`'s own doc for the same distinction).
 */
export type HubEditorialRead = {
  measured: boolean;
  /** `status` column — 'draft' | 'published'. Null only when unmeasured. */
  status: 'draft' | 'published' | null;
  /** Chapters the couple actually WROTE a line for — not the auto-built count. */
  chaptersWritten: number | null;
  /** Photos placed into the piece (`essay_photo_ids.length`). */
  photosIn: number | null;
  /** Whether Guest Columns is switched on at all (`guestColumnsActive()`). If
   *  off, `pending` was never asked and must not render as zero. */
  columnsOn: boolean;
  /** False ⇒ the pending count was refused, not that nobody has written. */
  columnsMeasured: boolean;
  columnsPending: number;
};

/** S2, when the live channel is the story: chapters · columns · photos · status. */
function resolveWorkroomFacts(editorial: HubEditorialRead): [HubFact, HubFact, HubFact, HubFact] {
  return [
    {
      label: 'Chapters',
      value: editorial.measured ? `${editorial.chaptersWritten ?? 0} written` : null,
      known: editorial.measured,
    },
    {
      label: 'Guest columns',
      value: !editorial.columnsOn
        ? 'Switched off'
        : editorial.columnsMeasured
          ? `${editorial.columnsPending} waiting on you`
          : null,
      known: !editorial.columnsOn || editorial.columnsMeasured,
    },
    {
      label: 'Photos in',
      value: editorial.measured ? `${editorial.photosIn ?? 0}` : null,
      known: editorial.measured,
    },
    {
      label: 'Status',
      value: editorial.measured
        ? editorial.status === 'published'
          ? 'Published'
          : 'Draft'
        : null,
      known: editorial.measured,
    },
  ];
}

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
  /**
   * EH5 — appended, never inserted before `nowMs`: every existing 3-arg call
   * site treats that slot as `nowMs`, and this keeps them all still doing
   * that rather than silently reinterpreting a timestamp as a read.
   */
  editorial?: HubEditorialRead | null,
): [HubFact, HubFact, HubFact, HubFact] {
  const stage = resolveHubStage(event, nowMs);
  /* THE WORKROOM'S OWN FACTS. On the story channel, the couple is not asking
     "did my guests reply" any more — replies belong to the channel that just
     closed. So the strip switches to what THIS channel is missing, through
     the same `HubFact[]` and the same render, never a second fact mechanism. */
  if (stage === 'editorial' && editorial) {
    return resolveWorkroomFacts(editorial);
  }
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
  /** EH5 — appended for the same reason as `resolveHubFacts`'s: every 3-arg
   *  call site keeps working unchanged. Optional: the 'after' branch below
   *  degrades to its prior generic copy when this was not asked for. */
  editorial?: HubEditorialRead | null,
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
    /*
      NAME THE REAL NEXT STEP. Guest columns are written to the couple, not the
      page — nothing a guest writes appears until the host says so, and that
      decision belongs on THIS screen, where the host is standing, not buried
      a click away. So when there is a real, measured pending count, it
      outranks the generic "write your story" copy.
    */
    if (editorial?.columnsOn && editorial.columnsMeasured && editorial.columnsPending > 0) {
      const n = editorial.columnsPending;
      return {
        key: 'story',
        headline: `${n} ${n === 1 ? 'guest' : 'guests'} wrote you a column.`,
        blurb:
          'Nothing they wrote is on your page yet — you decide what to keep before it ever shows.',
        ctaLabel: 'Review columns',
        ctaPath: '/studio/guest-columns',
      };
    }
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

/* ════════════════════════════════════════════════════════════════════════════
   VIEW AS — the couple CHECKS the § 3.2 matrix instead of trusting it
   ════════════════════════════════════════════════════════════════════════════

   Owner, 2026-09-02: "make sure it also has view as (they pick what each role
   sees)." Everyone opens the same address and what it shows depends on who they
   are. Until now the couple could only trust that. This is the switch that lets
   them check it.

   ── 🚨 THE DEFECT THIS SECTION IS WRITTEN AGAINST ──────────────────────────
   `loadHostMembership` once selected `member_type` and then NEVER COMPARED IT,
   returning `Boolean(memberRow)`. `event_members` is not a host table — 'guest'
   is one of its member_type values — so any row at all counted as a host, and a
   guest could open a PRIVATE site and use `?phase=` to jump to phases the couple
   had not launched, including their own unsent save-the-date.

   That override now goes to FIVE roles instead of one. So the offer list is
   computed in ONE function, `hubPreviewRoles`, it asks `isHostMemberType` —
   the same single definition of "host" the launch page, the check-in desk and
   the checklist RLS all ask — and `event-hub-roles.test.ts` feeds it a
   `guest`-typed row on every path. Relaxing that call to `Boolean(memberType)`
   is the sabotage the guard is written to catch, and it is measured there.

   ── AND: NO NEW ROUTE, NO NEW ENGINE, NO SECOND PHASE OPINION ──────────────
   Every door below is one that already ships and is already gated SERVER-side:
     · `/{slug}` .................... the host's own page (owner ribbon)
     · `/{slug}?phase=` ............. the four-value preview, gated by
                                      `loadHostMembership` in app/[slug]/page.tsx
     · `?as=replied` ................ the SIMULATED seat-holder, gated by a
                                      server-verified `OwnerCapability`
                                      (lib/simulated-guest-preview.ts)
   Nothing here mints a permission. A chip is a description plus, where an
   honest door exists, a link to a page that re-checks the viewer itself. The
   switcher is the UI; the DB is still the boundary.
*/

/**
 * The six ways in, as the couple picks between them.
 *
 * 🔑 `stranger` is the column nobody asked for and the most important one: a
 * refused shop's page and a stranger's page must be byte-identical, and the
 * only person who can usefully check that is the host. It costs no permission —
 * it is the LEAST privileged read — so it ships with the generic four.
 *
 * `named_guest` is the ONLY one behind a flag. See `hub-named-guest-flag.ts`.
 */
export const HUB_ROLES = [
  'host',
  'coordinator',
  'supplier',
  'guest',
  'stranger',
  'named_guest',
] as const;

export type HubRole = (typeof HUB_ROLES)[number];

/** The roles that describe a CLASS of viewer and name no person. Unflagged. */
export const HUB_GENERIC_ROLES: readonly HubRole[] = [
  'host',
  'coordinator',
  'supplier',
  'guest',
  'stranger',
];

/** One line of the § 3.2 matrix, as a person reads it. */
export type HubRoleCell = {
  /** ● full · ◐ partial or read-only · ○ nothing, on purpose. */
  mark: 'full' | 'partial' | 'none';
  text: string;
  /**
   * False ⇒ we could not measure what this role would see, so the line states
   * that rather than a shape guessed from a read that did not happen.
   */
  known: boolean;
};

/** What one role's read of the same address actually is. */
export type HubRoleView = {
  role: HubRole;
  /** The eyebrow — how this person got in. */
  who: string;
  /** The chip's word. */
  name: string;
  /** What the stage becomes when this chip is armed. */
  headline: string;
  blurb: string;
  /** The three lines that make this column differ from its neighbour. */
  cells: readonly [HubRoleCell, HubRoleCell, HubRoleCell];
  /** An existing, server-gated door — or null when there is honestly none. */
  previewHref: string | null;
  previewLabel: string | null;
  /** The one sentence that stops this column being confused with another. */
  footnote: string;
};

/**
 * WHICH ROLES MAY THIS VIEWER PREVIEW — the whole gate, in one place.
 *
 * 🔒 Asks `isHostMemberType`, never `Boolean(...)` on the row or on the string.
 * A `guest`-typed `event_members` row is a real row belonging to a real person
 * who is NOT a host, and it must come back with an EMPTY list: no chips, no
 * doors, nothing to arm. The launch page redirects such a viewer before this is
 * ever reached — this is the second half of the same guarantee, stated where a
 * test can hold it, because the first half was once exactly this comparison
 * being skipped.
 *
 * ⚠ It does not GRANT anything either. Every href a view carries is re-checked
 * server-side by the page it points at.
 */
export function hubPreviewRoles(input: {
  /** `event_members.member_type` for THIS viewer on THIS event. */
  memberType: string | null | undefined;
  /** `hubNamedGuestPreviewEnabled()`. Off in production — see that module. */
  namedGuestEnabled: boolean;
}): readonly HubRole[] {
  if (!isHostMemberType(input.memberType)) return [];
  return input.namedGuestEnabled ? HUB_ROLES : HUB_GENERIC_ROLES;
}

/** The reply line, which is the one cell that depends on a read that can be
 *  refused OR simply not shared. Three states, never two. */
function replyCell(guests: HubGuestRead, text: (n: number) => string): HubRoleCell {
  if (!guests.shared) return { mark: 'none', text: NOT_SHARED, known: true };
  if (!guests.measured) return { mark: 'partial', text: 'We could not read this', known: false };
  return { mark: 'full', text: text(Math.max(0, guests.invited - guests.replied)), known: true };
}

/**
 * ONE role's read of the one address.
 *
 * PURE. It performs no I/O, resolves no phase of its own (it is HANDED the
 * standing that `resolveHubStage`/`resolveHubPhase` already produced), and it
 * reads no guest by name — not even for `named_guest`, whose door is the
 * FABRICATED sample seat-holder that `lib/simulated-guest-preview.ts` already
 * ships. So even with the flag ON, no real guest's data flows down this path;
 * turning it on offers the couple the seat-holder SHAPE, and rendering an
 * actual named person remains unbuilt and unruled.
 *
 * ⛔ A null `slug` (or an unmeasured event) removes every door rather than
 * pointing one at `/null`. The description survives; the link does not.
 */
export function resolveHubRoleView(input: {
  role: HubRole;
  standing: HubStanding;
  slug: string | null;
  guests: HubGuestRead;
}): HubRoleView {
  const { role, standing, slug, guests } = input;
  /* No address, or an event we could not read, means no honest door. */
  const at = (query: string): string | null =>
    slug && standing.measured ? `/${slug}${query}` : null;
  /* The stage the guests are ACTUALLY on, so a preview opens where they are
     rather than on a page the couple has not launched. Falls back to the
     invitation only when we could not read the event, in which case `at()`
     has already withdrawn the link anyway. */
  const liveStage = standing.stage ?? 'rsvp';

  switch (role) {
    case 'host':
      return {
        role,
        who: 'Host',
        name: 'You',
        headline: 'Your own page, as yourself.',
        blurb:
          'Never "scan your QR" on your own wedding. A slim ribbon rides the top with the edit door and every stage behind it.',
        cells: [
          { mark: 'full', text: 'Everything a guest sees, at any stage', known: true },
          { mark: 'full', text: 'The ribbon, the print sheet, the four channels', known: true },
          { mark: 'full', text: 'Arms all three day-of services', known: true },
        ],
        previewHref: at(''),
        previewLabel: 'Open your page',
        footnote: 'The only role that may edit the site.',
      };

    case 'coordinator':
      return {
        role,
        who: 'Appointed co-host',
        name: 'Coordinator',
        headline: 'A host key — the same page, the same ribbon.',
        blurb:
          'They open exactly what you open. The edit button honestly sends them to the planning desk instead of the site editor, because that is where their work is.',
        cells: [
          { mark: 'full', text: 'Writes the announcements guests read where they stand', known: true },
          { mark: 'full', text: 'The only role that may advance the running order', known: true },
          { mark: 'none', text: 'Cannot edit the site itself', known: true },
        ],
        previewHref: at(''),
        previewLabel: 'Open the page they open',
        footnote: 'A coordinator you HIRED is a supplier, not this.',
      };

    case 'supplier':
      return {
        role,
        who: 'Booked shop',
        name: 'Supplier',
        headline: 'Their call sheet, where your guests see the invitation.',
        blurb:
          'The desk replaces the guest page entirely — the venue, the head-count, the running order as it moves, and their own private lines marked.',
        cells: [
          { mark: 'full', text: 'The desk, in four states: call sheet, today, look back, quiet', known: true },
          { mark: 'partial', text: 'Sees the programme move — cannot advance it', known: true },
          { mark: 'none', text: 'No gifts page. A supplier is not a guest.', known: true },
        ],
        /* No door, and that is the honest answer: a booked supplier's desk is
           minted from a booking this viewer does not hold, and there is no
           param that fabricates one. Describing it beats a link that would
           open the couple's own page and quietly claim to be the desk. */
        previewHref: null,
        previewLabel: null,
        footnote: 'Only genuinely booked. Shortlisted sees a stranger’s page.',
      };

    case 'guest':
      return {
        role,
        who: 'Scanned a QR',
        name: 'Guest',
        headline: 'The page as somebody who scanned their way in.',
        blurb:
          'No account, one scan, the whole door. Details, the programme, the camera, the wall, the gifts — and the seat FINDER, but no seat of their own.',
        cells: [
          { mark: 'full', text: 'Camera, watch live, the wall, gifts, the album', known: true },
          { mark: 'partial', text: 'The seat finder — they type their own name', known: true },
          replyCell(guests, (pending) =>
            pending === 0 ? 'Everyone has replied' : `${pending} of them have not replied`,
          ),
        ],
        previewHref: at(`?phase=${liveStage}`),
        previewLabel: 'Open the stage they are on',
        footnote: 'Your ribbon still rides this preview — you cannot un-be the host.',
      };

    case 'stranger':
      return {
        role,
        who: 'Nobody you invited',
        name: 'Stranger',
        headline: 'What somebody who found the link sees.',
        blurb:
          'On a private event: the lock screen and nothing else — not a name, not a date, not a hint that there is anything behind it. A refused shop gets this page byte for byte.',
        cells: [
          { mark: 'none', text: 'No guest list, no seats, no photos, no gifts', known: true },
          { mark: 'none', text: 'No hint that any of it exists', known: true },
          { mark: 'partial', text: 'On a PUBLIC event, the same page a guest opens', known: true },
        ],
        /* Deliberately no link: a host cannot stop being signed in, and a
           "stranger preview" that quietly carried their session would be the
           most dangerous lie on this page. Open the address in a private
           window — that is the real check, and it is one the couple can do. */
        previewHref: null,
        previewLabel: null,
        footnote: 'Check it in a private window — a signed-in preview cannot tell you this.',
      };

    case 'named_guest':
      return {
        role,
        who: 'Seat-holder',
        name: 'Seat-holder',
        headline: 'One person’s own page — their seat, their photos, their QR.',
        blurb:
          'Four cells apart from a plain guest, and every one of them is theirs by name. This preview uses a SAMPLE seat-holder, not one of your guests.',
        cells: [
          { mark: 'full', text: 'Their seat, and the walk to it', known: true },
          { mark: 'full', text: 'Photos of them, arriving live', known: true },
          { mark: 'full', text: 'Their QR, bound to their name; a +1 confirms itself', known: true },
        ],
        /* `?as=replied` — the shipped, FABRICATED seat-holder. Every value it
           renders is a literal in `lib/simulated-guest-preview.ts`, which is
           why this door needs no DPO ruling: there is no query for a reviewer
           to audit, because by construction no real guest can flow down it. */
        previewHref: at('?phase=rsvp&as=replied'),
        previewLabel: 'Open the sample seat-holder',
        footnote: 'Naming a REAL guest here is a privacy call, and it is not made yet.',
      };
  }
}

/**
 * WHICH ROLE IS ARMED — the `?viewas=` param, resolved against the offer list.
 *
 * 🔒 The param is NOT the authority. It is a string from the address bar, so it
 * is checked against the list `hubPreviewRoles` produced for THIS viewer, and
 * anything else — a misspelling, an array from a repeated param, a role this
 * viewer may not preview, `named_guest` while the flag is off — falls back to
 * the first offered role rather than being honoured.
 *
 * ⚠ Returns null when the offer list is EMPTY. A viewer with no roles has no
 * armed role, and the switcher must not render at all. Defaulting to 'host'
 * here would hand a non-host the host read on a page whose gate had somehow
 * been passed — small, but it is the exact shape of the defect this whole
 * section is written against.
 *
 * ⛔ Deliberately NOT `?as=`: the public site already owns that param for the
 * simulated seat-holder (`lib/simulated-guest-preview.ts`), and two params with
 * one name that mean different things on two routes is how a gate gets read by
 * the wrong reader.
 */
export function resolveArmedHubRole(input: {
  param: string | string[] | undefined;
  offered: readonly HubRole[];
}): HubRole | null {
  const { param, offered } = input;
  if (offered.length === 0) return null;
  if (typeof param === 'string') {
    const match = offered.find((r) => r === param);
    if (match) return match;
  }
  /* `?? null` is not defensive noise: `noUncheckedIndexedAccess` types this as
     `HubRole | undefined`, and TypeScript cannot narrow it from the length
     guard above. An `undefined` armed role would render as "no switcher" —
     which is the safe direction, and it is why the type says `null`. */
  return offered[0] ?? null;
}
