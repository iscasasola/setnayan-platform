/**
 * discover-events-core.ts — WHICH PUBLIC EVENTS DISCOVER SHOWS, AND IN WHAT
 * ORDER. Pure: no I/O, no `server-only`, so every rule here is executed by a
 * test rather than read out of source by a regex.
 *
 * Owner, 2026-09-29 (DECISION_LOG "DISCOVER IS THE DOOR TO THE WHOLE SETNAYAN
 * UNIVERSE"): *"the discover is their access to the rest of the setnayan
 * universe. It of course starts with the people they follow, to the rest of the
 * world"* — then "yes to all": the world layer is ordered **soonest first, the
 * viewer's own region first**, and signed-out visitors see it. "DISCOVER BUILD —
 * TWO LAST ANSWERS": the viewer's region is **the region of their most recent
 * event** (`events.region` of their latest membership that has one). `users`
 * has no region column and none is added.
 *
 * The I/O half is `lib/discover-events.ts`. It READS; this module DECIDES.
 *
 * ─── THE ALLOW-LIST — EVERY CONDITION MUST HOLD ──────────────────────────
 *   1 · `listablePublicly(resolveEffectiveVisibility(e))` — the shipped
 *       allow-list. Only 'public' is ever listed: never 'unlisted' (link only),
 *       'invited_accounts' or 'private'. An unknown value normalises to
 *       'private', so a sixth visibility added tomorrow is CLOSED here until
 *       somebody opens it in `lib/event-visibility.ts`.
 *   2 · not archived.
 *   3 · has a slug — the card is a door to `/{slug}`; no slug, no door.
 *   4 · not finished by the Manila calendar day (`isFinishedEvent` with
 *       `manilaTodayISO()` handed in) — the product's one answer to "is this
 *       over", including a multi-day event's last day.
 *   5 · HAS A DATE. ⚠ A deliberate narrowing of `isFinishedEvent`, which calls
 *       a dateless event "not finished". That is right for a profile's "Coming
 *       up" (its own celebrations, which it will date later); it is wrong for a
 *       shelf whose whole order IS the date. A card here promises "this is
 *       coming, on this day" — an event with no day cannot keep that promise.
 *   6 · the viewer is not already a member — it is on their own Events page.
 *
 * The loader applies the SAME gate the public profile does
 * (`filterPubliclyVisibleEvents`: visibility + the event type's website
 * surface) before rows reach here; condition 1 is re-applied so this module is
 * safe on its own and the rule is held by an executing test.
 *
 * ─── TWO LAYERS, ONE EVENT IN ONE PLACE ─────────────────────────────────
 * An event hosted (`event_members.member_type = 'couple'`) by somebody the
 * viewer follows or is connected to goes on the FIRST shelf, soonest first.
 * Every other eligible event goes on the SECOND, region first, then soonest.
 * An event never appears on both.
 */
import { listablePublicly } from './event-visibility';
import { resolveEffectiveVisibility } from './launch-save-the-date';
import { isFinishedEvent } from './event-board';
import { splitComingUpAndPast } from './coming-up-and-past';
import { anyoneMayAskToJoin } from './rsvp-ask';
import { resolveRegion, regionLabel } from './region-source';
import { shopInitials } from './shop-initials';
import type { EventPosterFacts, SceneCover } from './event-poster';

/**
 * How many cards each shelf shows. Two full rows of the four-across grid for
 * the world, one for each of the other two — a shelf is a taste of what is
 * there, never a paginator.
 */
export const DISCOVER_CAPS = {
  people: 8,
  world: 12,
  peopleToFollow: 8,
} as const;

/** One `events` row as the loader reads it. Nothing here reaches the browser. */
export type DiscoverEventRow = {
  event_id: string;
  slug: string | null;
  display_name: string | null;
  event_date: string | null;
  event_end_date: string | null;
  event_date_precision: string | null;
  event_type: string | null;
  region: string | null;
  archived: boolean | null;
  landing_page_visibility: string | null;
  scheduled_launch_at: string | null;
  monogram_text: string | null;
  /** `anon=-` column — reduced to ONE boolean below, never carried out. */
  rsvp_ask_config: unknown;
};

/** What `<EventPoster>` needs to draw the paper card — all resolved server-side. */
export type DiscoverPaper = {
  poster: EventPosterFacts;
  /** `resolveMonogram(event).text` — drawn when there is no logo. */
  markText: string;
  /** `resolveEventMonogramSvg(event)` — the read-gated logo markup, or null. */
  markSvg: string | null;
  /** `logoPlaysFor(eventId, markSvg)` — the logo moves and the animation is on. */
  markPlays: boolean;
};

/** A host of a listed event. `publicSlug` is set ONLY for a public profile. */
export type DiscoverHost = {
  userId: string;
  /** Rendered ONLY when `publicSlug` is set — see `pickHost`. */
  name: string | null;
  publicSlug: string | null;
};

/** How the viewer is tied to a host. `connected` outranks `follow`. */
export type DiscoverRelation = 'connected' | 'follow';

/** What a card renders — plain, serializable, and free of any user id. */
export type DiscoverEventCard = {
  key: string;
  href: string;
  title: string;
  typeLabel: string | null;
  datePlate: string;
  /** The event's mark — the cover when it has chosen no look (`scene` null). */
  cover: string;
  /**
   * 🖼 THE EVENT'S LOOK — `sceneCoverFor(resolveEventPoster(…))`, the dashboard
   * card's own cover (hero photo → Save-the-Date background → theme still).
   * The core never decides it: it is `null` here and filled by the loader ONLY
   * for a card that already passed `isDiscoverable`, so no event that is not
   * public ever has its photo read, let alone shown. `null` (or a `quiet`
   * cover) = the card wears `cover`, the mark.
   */
  scene: SceneCover | null;
  /**
   * 🃏 THE DASHBOARD'S PAPER INVITATION CARD — for an event whose poster is
   * `invitation` (Classic, no hero photo: no picture to wear). Owner
   * 2026-10-03, ruling (A) "Paper invitation card": the Discover card draws the
   * same card its dashboard card does (`<EventPoster>`), not a bare monogram.
   * Filled by the loader with `scene`, under the same allow-list; `null` here.
   */
  paper: DiscoverPaper | null;
  /** A host with a PUBLIC profile — their name is the card's second door. */
  host: { name: string; slug: string } | null;
  regionLabel: string | null;
  relation: DiscoverRelation | null;
  /**
   * The request door (`/join/{eventId}`) when the host chose "Anyone, I
   * approve"; null otherwise — the card then offers nothing to press. Public
   * (who may SEE the page) and "Anyone, I approve" (who may ASK) are two
   * shipped switches; the shelf lists on the first and offers the button on
   * the second, never merged into one.
   */
  askHref: string | null;
};

export type DiscoverSelectInput = {
  events: readonly DiscoverEventRow[];
  hostsByEvent: ReadonlyMap<string, readonly DiscoverHost[]>;
  /** user id → how the viewer is tied to them. Empty for a stranger. */
  people: ReadonlyMap<string, DiscoverRelation>;
  memberEventIds: ReadonlySet<string>;
  /** Canonical region slug (`resolveRegion(...).slug`), or null. */
  viewerRegion: string | null;
  todayISO: string;
  now: number;
  typeLabels?: ReadonlyMap<string, string>;
  caps?: { people: number; world: number };
};

export type DiscoverShelves = {
  people: DiscoverEventCard[];
  world: DiscoverEventCard[];
};

/** The whole allow-list, in one place. See the module docblock. */
export function isDiscoverable(
  e: DiscoverEventRow,
  ctx: { todayISO: string; now: number; memberEventIds: ReadonlySet<string> },
): boolean {
  const visibility = resolveEffectiveVisibility(
    {
      landing_page_visibility: e.landing_page_visibility as never,
      scheduled_launch_at: e.scheduled_launch_at,
    },
    ctx.now,
  );
  if (!listablePublicly(visibility)) return false;
  if (e.archived) return false;
  if (!e.slug || !e.slug.trim()) return false;
  if (!e.event_date) return false;
  if (isFinishedEvent(e, ctx.todayISO)) return false;
  if (ctx.memberEventIds.has(e.event_id)) return false;
  return true;
}

/**
 * The viewer's region: `events.region` of their MOST RECENT membership that
 * has one a region resolver recognises. Null when none does — the world layer
 * is then soonest first only.
 */
export function pickViewerRegion(
  memberships: ReadonlyArray<{ region: string | null; joined_at: string | null }>,
): string | null {
  const sorted = [...memberships].sort((a, b) =>
    (b.joined_at ?? '').localeCompare(a.joined_at ?? ''),
  );
  for (const m of sorted) {
    const r = resolveRegion(m.region);
    if (r) return r.slug;
  }
  return null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * The card's date plate — "Sat 17 Oct". Honours `event_date_precision`: a
 * month-precision date prints "Oct 2026" and a year-precision one "2026",
 * because a weekday under a placeholder day is a Saturday nobody chose. The
 * year is added to a day plate only when it is not this (Manila) year.
 * Parsed by parts, never `new Date(iso)`, so a DATE column cannot drift a day.
 */
export function datePlate(
  iso: string | null,
  precision: string | null,
  todayISO: string,
): string {
  if (!iso) return 'Date to come';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 'Date to come';
  if (precision === 'year') return String(y);
  const month = MONTHS[m - 1] ?? '';
  if (precision === 'month') return `${month} ${y}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const sameYear = todayISO.slice(0, 4) === String(y);
  return sameYear ? `${weekday} ${d} ${month}` : `${weekday} ${d} ${month} ${y}`;
}

function bestRelation(
  hosts: readonly DiscoverHost[],
  people: ReadonlyMap<string, DiscoverRelation>,
): DiscoverRelation | null {
  let best: DiscoverRelation | null = null;
  for (const h of hosts) {
    const r = people.get(h.userId);
    if (r === 'connected') return 'connected';
    if (r === 'follow') best = 'follow';
  }
  return best;
}

/**
 * The host the card names. ⛔ ONLY A PUBLIC PROFILE IS EVER NAMED: a host
 * without `public_profile_enabled` has no `/u` page and never consented to
 * being listed, so the card then names nobody. Among public hosts, one of the
 * viewer's own people is preferred, so "You follow them" is about the name
 * printed above it.
 */
function pickHost(
  hosts: readonly DiscoverHost[],
  people: ReadonlyMap<string, DiscoverRelation>,
): { name: string; slug: string } | null {
  const named = hosts.filter(
    (h): h is DiscoverHost & { publicSlug: string; name: string } =>
      !!h.publicSlug && !!h.name && h.name.trim().length > 0,
  );
  const mine = named.find((h) => people.has(h.userId));
  const h = mine ?? named[0];
  return h ? { name: h.name.trim(), slug: h.publicSlug } : null;
}

function toCard(
  e: DiscoverEventRow & { slug: string },
  input: DiscoverSelectInput,
  relation: DiscoverRelation | null,
): DiscoverEventCard {
  const hosts = input.hostsByEvent.get(e.event_id) ?? [];
  const title = (e.display_name ?? '').trim() || 'A public event';
  const mono = (e.monogram_text ?? '').trim();
  return {
    key: e.event_id,
    href: `/${e.slug}`,
    title,
    typeLabel: e.event_type ? (input.typeLabels?.get(e.event_type) ?? null) : null,
    datePlate: datePlate(e.event_date, e.event_date_precision, input.todayISO),
    cover: mono && mono.length <= 4 ? mono : shopInitials(title, 2, '·'),
    scene: null,
    paper: null,
    host: pickHost(hosts, input.people),
    regionLabel: regionLabel(e.region),
    relation,
    askHref: anyoneMayAskToJoin(e.rsvp_ask_config) ? `/join/${e.event_id}` : null,
  };
}

/**
 * Split eligible events into the two layers and order each.
 *
 *   people — soonest first (`splitComingUpAndPast`'s own order, reused).
 *   world  — events in the viewer's region first, each group soonest first.
 */
export function selectDiscoverShelves(input: DiscoverSelectInput): DiscoverShelves {
  const caps = input.caps ?? DISCOVER_CAPS;
  const seen = new Set<string>();
  const eligible: Array<DiscoverEventRow & { slug: string }> = [];
  for (const e of input.events) {
    if (seen.has(e.event_id)) continue;
    seen.add(e.event_id);
    if (
      isDiscoverable(e, {
        todayISO: input.todayISO,
        now: input.now,
        memberEventIds: input.memberEventIds,
      })
    ) {
      eligible.push(e as DiscoverEventRow & { slug: string });
    }
  }

  const { comingUp } = splitComingUpAndPast(eligible, input.todayISO);

  const people: DiscoverEventCard[] = [];
  const inRegion: DiscoverEventCard[] = [];
  const elsewhere: DiscoverEventCard[] = [];
  for (const e of comingUp) {
    const relation = bestRelation(input.hostsByEvent.get(e.event_id) ?? [], input.people);
    if (relation) {
      people.push(toCard(e, input, relation));
      continue;
    }
    const card = toCard(e, input, null);
    const region = resolveRegion(e.region)?.slug ?? null;
    if (input.viewerRegion && region === input.viewerRegion) inRegion.push(card);
    else elsewhere.push(card);
  }

  return {
    people: people.slice(0, caps.people),
    world: [...inRegion, ...elsewhere].slice(0, caps.world),
  };
}

/** A public profile as the loader reads it. The user id never leaves the server. */
export type PersonCandidate = {
  userId: string;
  slug: string | null;
  displayName: string | null;
  followersCount: number | null;
  publicId: string | null;
  publicProfileEnabled: boolean | null;
  deletedAt: string | null;
};

/**
 * "People to follow": public profiles only, never the viewer, never somebody
 * they already follow (or deliberately unfollowed), most-followed first.
 */
export function selectPeopleToFollow(
  candidates: readonly PersonCandidate[],
  opts: { viewerId: string | null; exclude: ReadonlySet<string>; cap?: number },
): PersonCandidate[] {
  const cap = opts.cap ?? DISCOVER_CAPS.peopleToFollow;
  return candidates
    .filter(
      (c) =>
        c.publicProfileEnabled === true &&
        !c.deletedAt &&
        !!c.slug &&
        !!(c.displayName ?? '').trim() &&
        c.userId !== opts.viewerId &&
        !opts.exclude.has(c.userId),
    )
    .sort(
      (a, b) =>
        (b.followersCount ?? 0) - (a.followersCount ?? 0) ||
        (a.displayName ?? '').localeCompare(b.displayName ?? ''),
    )
    .slice(0, cap);
}
