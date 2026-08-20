/**
 * event-board.ts — the two shelves of the account's events board, and the one
 * question a card has to answer before you press it.
 *
 * ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
 * Two facts about the launcher board were decided in the page body, where
 * nothing could watch them:
 *
 *  1. WHICH SHELF. A finished event was hidden behind a `?show=all` query
 *     param. Owner 2026-08-13: split the board into COMING UP and FINISHED as
 *     two ALWAYS-PRESENT sections. **A thing you have to switch on reads as a
 *     thing that might not be there** — and prod's one finished event (a
 *     wedding whose day has passed) was exactly that: somebody's memories,
 *     behind a toggle. The definition of "finished" is unchanged; only the
 *     shelf it lands on and whether that shelf exists.
 *
 *  2. WHICH DOOR. `member_type` decides what a person can press. The couple's
 *     event dashboard admits `member_type = 'couple'` ONLY (see
 *     app/dashboard/[eventId]/layout.tsx) — so linking an INVITED person there
 *     is a 404 shown to somebody who was told they belong. Session 8 found
 *     that exact harm on an Alaala card 2026-08-12 and deliberately did not
 *     propagate it; `eventBoardHref` is where that decision now lives so the
 *     next surface inherits it instead of re-deriving it.
 *
 * 🔑 A GUEST'S EVENT PAGE IS THE PUBLIC ADDRESS, NOT A DASHBOARD. `/{slug}`
 * (and its `/{slug}/hub`) already show a guest their photos, their table and
 * their RSVP, and carry NO money or plan surfaces at all — absent, not
 * present-and-refused. Nothing new is built for the invited case; the card
 * simply stops pointing at a door that would slam.
 *
 * 🎟 AND THE PAGE RECOGNISES THEM FROM THEIR SEAT, NOT FROM A COOKIE. Guest
 * identity there was a cookie with a HARD 60-day life carrying exactly ONE event
 * id and no sliding refresh — so with save-the-dates going out 6–12 months ahead,
 * the ORDINARY invited guest was a stranger on the page by the wedding day, and
 * anyone invited to two events could only be recognised on one at a time. On a
 * `private` event (3 of 5 in prod) they met a screen telling them to scan the QR
 * they had already scanned. The page's own visibility gate now also admits a
 * signed-in person holding a seat on that event — see lib/guest-membership-session.ts.
 *
 * 🚨 THIS HREF MUST STAY A PLAIN PAGE. A first cut pointed it at a
 * `/{slug}/enter` GET route handler that minted the guest cookie — and a
 * Next.js `<Link>` PREFETCHES, so a card merely scrolling into view executed the
 * mint. For somebody invited to two weddings that silently rewrote which one
 * their single cookie named: standing at wedding A, B's card comes into view, and
 * going back to A they are a stranger. This repo had already written the rule
 * down for sign-out — *"a row that can sign you out by being NEAR the pointer"* —
 * and a form is what it used instead. **Never put a side effect behind a card.**
 *
 * 🪤 A SLUG CAN BE NULL AND ONE IS IN PROD TODAY (4 of 5 events have a slug;
 * the finished wedding is the one that does not). `eventBoardHref` returns
 * NULL for that case rather than `/null` — the caller renders the card without
 * a link. An invited person with nowhere to go is a true statement; a link to
 * `/null` is a broken product.
 *
 * ⚠ NOT A ZERO-CLAIM MODULE. `fetchUserEvents` graceful-degrades to `[]` on
 * EVERY error including RLS denial (lib/events.ts, 6th-pass hotfix 2026-05-23),
 * so a caller can never tell "no invited events" from "the read failed". Callers
 * must therefore never print a measured count of invited events, and the empty
 * FINISHED shelf must say what the shelf is FOR, never that you have none.
 */
import type { EventWithRole } from './events';

/** The two states a board card can be in. There is no third. */
export type EventStance = 'organiser' | 'invited';

/**
 * Which member types reach this board, and as what.
 *
 * `couple` is the canonical organiser member_type for EVERY event kind, not
 * just weddings (see app/onboarding/simple/actions.ts: "the canonical
 * 'organizer' member_type (event-agnostic)").
 *
 * `guest` is written by the scan-to-join flow (app/join/[eventId]/actions.ts),
 * by account linking (lib/link-guest-account.ts · lib/event-account-link.ts)
 * and by auto-surface (lib/account-autosurface.ts) — so invited memberships are
 * a real, reachable product state even though prod holds none today.
 *
 * `vendor` and `coordinator` are DELIBERATELY ABSENT. Both have their own
 * doorways, and a coordinator's access to the event shell comes from an
 * accepted `event_moderators` row rather than from the member_type — so putting
 * one on this board would be guessing which door works for them. Named, not
 * built.
 */
const STANCE_BY_MEMBER_TYPE: Partial<
  Record<EventWithRole['member_type'], EventStance>
> = {
  couple: 'organiser',
  guest: 'invited',
};

export function eventStance(
  memberType: EventWithRole['member_type'],
): EventStance | null {
  return STANCE_BY_MEMBER_TYPE[memberType] ?? null;
}

/**
 * What the card SAYS. Present tense, second person, and it names the thing the
 * person did — not the row's member_type, which means nothing to them.
 */
export function stanceLabel(stance: EventStance): string {
  return stance === 'organiser' ? 'You organise this' : 'You’re invited';
}

/**
 * Where the card GOES — the whole point of naming the stance.
 *
 * organiser → the event dashboard, which admits them.
 * invited   → the event's own public address: a PLAIN PAGE, safe to prefetch,
 *             which recognises them from their seat. NULL when the host has not
 *             opened a public address yet (a real prod state), so the caller
 *             renders no link at all.
 *
 * ⚠ NEVER RETURN A ROUTE-HANDLER PATH FROM HERE. Every value this function
 * produces ends up as the `href` of a `<Link>`, and App Router prefetches those —
 * so a handler with a side effect runs when a card scrolls past. A guard resolves
 * each href to a file and requires `page.tsx`, never `route.ts`.
 */
export function eventBoardHref(event: {
  event_id: string;
  slug?: string | null;
  member_type: EventWithRole['member_type'];
}): string | null {
  const stance = eventStance(event.member_type);
  if (stance === 'organiser') return `/dashboard/${event.event_id}`;
  if (stance !== 'invited') return null;
  const slug = event.slug?.trim();
  return slug ? `/${slug}` : null;
}

/**
 * The SAME stance question, asked by a card that opens an ALBUM rather than the
 * event's front page — Library › Photos & Videos.
 *
 * organiser → the Papic studio, the album surface the dashboard already admits
 *             them to.
 * invited   → the event's own public address. `/{slug}` is where an invited
 *             person's tagged photos already live; the studio is host-only, so
 *             pointing them at it is the 404 this module exists to stop.
 *
 * ⚠ THE SLUG PASSED HERE MUST BE THE EVENT'S ACTUAL ADDRESS, NOT A SHARE-GATED
 * ONE. `Album.slug` in the Library data layer is deliberately narrowed to
 * EFFECTIVELY-PUBLIC events because it anchors a broadcast Facebook link — a
 * different question with a different right answer. Reusing that value here
 * would strip the link from an invited person on an unlisted or not-yet-launched
 * wedding they can open perfectly well. Two questions, two values.
 */
export function eventAlbumHref(event: {
  event_id: string;
  slug?: string | null;
  member_type: EventWithRole['member_type'];
}): string | null {
  const stance = eventStance(event.member_type);
  if (stance === 'organiser') return `/dashboard/${event.event_id}/studio/papic`;
  if (stance !== 'invited') return null;
  const slug = event.slug?.trim();
  return slug ? `/${slug}` : null;
}

/**
 * What to SAY when there is no href — because silence reads as an unfinished
 * feature, and the board's existing "Ask an organizer to add you to this event"
 * is a lie told to somebody who was already added.
 *
 * The distinction that matters: a person with NO membership needs to be let in;
 * an invited person whose host has not opened a page yet is already in and has
 * nothing to press. Those are different sentences.
 */
export function stanceClosedReason(
  memberType: EventWithRole['member_type'],
): string {
  return eventStance(memberType) === 'invited'
    ? 'You’re invited — the organizer hasn’t opened this event’s page yet.'
    : 'Ask an organizer to add you to this event.';
}

/**
 * PH-local "today" as an ISO date. The board's finished/coming-up boundary is a
 * CALENDAR DAY in the venue's country, never an instant — a wedding is not
 * "finished" at 08:00 PH because it is still yesterday in UTC.
 * (See the 2026-08-04 wall-clock-vs-instant sweep.)
 */
export function manilaTodayISO(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/**
 * Finished = archived OR the event's locked date has passed. Unchanged from the
 * definition that shipped in the launcher body — only its home moved.
 *
 * Deliberately reads `event_date` (the LOCKED date) and never a candidate day:
 * a guess must not move somebody's celebration onto the Finished shelf.
 */
export function isFinishedEvent(
  event: Pick<EventWithRole, 'event_date' | 'archived'> & {
    event_end_date?: string | null;
  },
  todayISO: string,
): boolean {
  if (event.archived) return true;
  // A celebration that spans several days is not finished on its first day.
  // `event_end_date` is the last day when the type allows a range (see
  // event-type-profile.ts) — the SAME value the full-res retention floor reads,
  // so "when did this end" has one answer in the product, not two. Prod holds
  // no ranged event today, so this is provably behaviour-neutral right now and
  // correct the first time somebody sets one.
  const lastDay = event.event_end_date?.slice(0, 10) || event.event_date?.slice(0, 10);
  return !!lastDay && lastDay < todayISO;
}

/**
 * Whole calendar days from `todayISO` to `eventDateISO`. NULL when either is
 * unreadable.
 *
 * 🔴 WHY THIS EXISTS, AND IT WAS A LIVE BUG FOR THE LENGTH OF ONE PR.
 * The board's shelf boundary and the countdown ON THE SAME CARD were reducing
 * "now" with two different clocks: `manilaTodayISO()` collapses the instant in
 * **Asia/Manila**, while `lib/checklist.daysUntilEvent` collapses it with
 * `startOfDay(new Date())` — the **SERVER's** clock, which is UTC on Vercel.
 * Between Manila 00:00 and 08:00 the Manila calendar day is already one ahead of
 * the UTC one, so:
 *
 *     06:00 Manila on 12 Dec, event_date = 2026-12-12
 *       shelf  → "Coming up"      (manilaTodayISO = 2026-12-12) ✅
 *       card   → "Tomorrow"       (daysUntilEvent = 1)          ❌
 *
 * **On the morning of the wedding the card said "Tomorrow"** — measured, both
 * ways: under `TZ=UTC` it reads "Tomorrow", under `TZ=Asia/Manila` it reads
 * "Happening today". So it is correct on a Philippine laptop and wrong in
 * production, which is the mirror image of the 2026-08-04 sweep's trap and hides
 * from exactly the person most likely to test it.
 *
 * 🔑 THE FIX IS ONE CLOCK, NOT A BETTER ONE. Both sides are day STRINGS parsed
 * identically, so the arithmetic has no ambient timezone to disagree with — and
 * the `todayISO` passed in is the very same value the shelf split used, not
 * another derivation of it.
 */
export function daysUntilEventDay(
  eventDateISO: string | null | undefined,
  todayISO: string,
): number | null {
  const day = (iso: string | null | undefined): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const a = day(eventDateISO);
  const b = day(todayISO);
  if (a === null || b === null) return null;
  return Math.round((a - b) / 86_400_000);
}

export type EventBoard = {
  /** Date DESCENDING (furthest future first), UNDATED AT THE TAIL. */
  comingUp: EventWithRole[];
  /** Most recent past first → oldest last. */
  finished: EventWithRole[];
};

/**
 * Split the account's memberships into the board's two shelves.
 *
 * Ordering is the 2026-07-13 timeline rule, preserved verbatim: newest at the
 * top, older as you scroll down, across the coming-up → finished boundary.
 *
 * "Date to be set" is a REAL STATE, not a missing value — an undated event sits
 * at the TAIL of Coming up (it has not happened, so it is certainly not
 * finished) and the card prints that phrase rather than a blank.
 *
 * Rows whose member_type has no stance (vendor · coordinator) are dropped:
 * this board is the collection of events you organise or were invited to.
 */
export function splitEventBoard(
  events: readonly EventWithRole[],
  todayISO: string,
): EventBoard {
  const mine = events.filter((e) => eventStance(e.member_type) !== null);
  const dateKey = (e: EventWithRole) => e.event_date?.slice(0, 10) ?? '';

  const comingUp = mine
    .filter((e) => !isFinishedEvent(e, todayISO))
    .sort((a, b) => {
      const da = dateKey(a);
      const db = dateKey(b);
      // ⚠ These two undated branches are BELT-AND-BRACES, not the mechanism:
      // with the DESCENDING compare below, an empty key already sorts last on
      // its own. They are kept because they state the intent, and because they
      // are what would still hold the tail position if the direction ever
      // changed. Measured 2026-08-13: flipping only one of them changes no
      // observable order, so no guard fires on it — what the guard watches is
      // the RESULT (undated last), which a direction flip does break.
      if (!da && !db) return 0;
      if (!da) return 1; // undated → tail
      if (!db) return -1;
      return da < db ? 1 : da > db ? -1 : 0; // latest date first
    });

  const finished = mine
    .filter((e) => isFinishedEvent(e, todayISO))
    .sort((a, b) => {
      const da = dateKey(a);
      const db = dateKey(b);
      return da < db ? 1 : da > db ? -1 : 0; // most recent past first
    });

  return { comingUp, finished };
}

/**
 * De-duplicate across two membership reads. A person can hold BOTH a couple row
 * and a guest row on one event (the couple of one wedding can scan into it as a
 * guest to test their own QR) — the organiser stance wins, because it is the
 * door that opens onto more.
 */
export function mergeBoardMemberships(
  organiser: readonly EventWithRole[],
  invited: readonly EventWithRole[],
): EventWithRole[] {
  const byId = new Map<string, EventWithRole>();
  for (const e of invited) byId.set(e.event_id, e);
  for (const e of organiser) byId.set(e.event_id, e); // organiser overwrites
  return [...byId.values()];
}

/**
 * The FINISHED shelf, split by whether this account has turned the celebration
 * into a story yet (owner 2026-08-20: *"your story should be also integrated in
 * my events since we have a place there for finished. change it to unpublished
 * and published. They get to choose on the unpublish which they will make a
 * story of."*).
 *
 * 🔑 THE TWO WORDS DESCRIBE THE STORY, NOT THE CELEBRATION. A finished day is
 * finished either way; what is unpublished is the chapter about it. That is why
 * the shelves say what they are for in a sentence and never call a wedding
 * "unpublished" on its own.
 *
 * `storyEventIds` is the set of event ids this account has a POSTED chapter
 * for. It must be read with an error check by the caller: an unmeasured read
 * looks exactly like "no stories yet" and would move every finished celebration
 * onto the unpublished shelf with a Write-the-story button beside a story that
 * already exists. When the read fails, callers pass `null` and get ONE shelf
 * back — the state the board has today — rather than a confident wrong split.
 */
export function splitFinishedByStory(
  finished: readonly EventWithRole[],
  storyEventIds: ReadonlySet<string> | null,
): { unpublished: EventWithRole[]; published: EventWithRole[]; measured: boolean } {
  if (!storyEventIds) {
    return { unpublished: [...finished], published: [], measured: false };
  }
  return {
    unpublished: finished.filter((e) => !storyEventIds.has(e.event_id)),
    published: finished.filter((e) => storyEventIds.has(e.event_id)),
    measured: true,
  };
}

/**
 * May THIS account write the story of this celebration?
 *
 * Only the organiser. A guest's finished celebration still belongs on their
 * board — it is their memory — but the chapter composer will not offer them a
 * day they did not host or work, so a button that opens a picker their
 * celebration is missing from is a door onto nothing.
 *
 * ⚠ A booked supplier MAY attach (owner 2026-08-15) and is deliberately not
 * offered here: a supplier's celebrations do not reach this board at all
 * (`STANCE_BY_MEMBER_TYPE` admits couple + guest only), so answering for them
 * from a member_type would be guessing.
 */
export function canWriteStoryFor(event: {
  member_type: EventWithRole['member_type'];
}): boolean {
  return eventStance(event.member_type) === 'organiser';
}
