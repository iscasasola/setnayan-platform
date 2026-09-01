/**
 * dependent-timeline.ts — the history of ONE alaga: a child, a pet, a business,
 * a car. Pure; the caller does every read.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Until this module an alaga was a row in a list and nothing else. There was no
 * route to one anywhere under `apps/web/app` — so a business had no history AND
 * a CHILD had none either, for the same reason: neither had a page. Building the
 * page once solves both, which is why the timeline is written against the KIND
 * rather than against businesses.
 *
 * ⚠ THIS IS NOT `lib/vendor-timeline.ts`. That is a day-of lens ranking which
 * schedule blocks matter to a caterer versus a DJ — a view over one event's
 * run-of-show, not a history of anything. Nothing here reuses it.
 *
 * ── A REFUSED READ IS NOT AN EMPTY LIFE ────────────────────────────────────
 * Three of the sources below are separate queries that RLS or an outage can
 * refuse, and a refused read returns `[]` from PostgREST — byte-identical to a
 * child who genuinely has no events. Rendering that as "Nothing has happened
 * yet" is this codebase's oldest disease (see `guests-read-is-honest.test.ts`,
 * `reads-are-honest.test.ts`, `kinship-read-core.ts`). So every optional source
 * arrives as `T[] | null`, NULL meaning WE DO NOT KNOW, and the result carries
 * an `unmeasured` list the page MUST render. A log line never changed a pixel.
 *
 * ── NOTHING IS INVENTED ────────────────────────────────────────────────────
 * Every entry is a date already on file. A business whose founding date nobody
 * typed gets NO founding entry — not one dated from `created_at`, which would
 * print "founded today" as though it were a fact about the company.
 */
import { DEPENDENT_DATE_LABELS, isPersonDependent, type DependentKind } from './dependent-people';

export type DependentTimelineKindEntry =
  | 'anchor'
  | 'added'
  | 'shop'
  | 'event'
  | 'godparent'
  | 'handover';

export type DependentTimelineEntry = {
  /** Stable within one build — used as the React key. */
  id: string;
  kind: DependentTimelineKindEntry;
  /** `yyyy-mm-dd`. Every entry has one; undated facts are not timeline entries. */
  dateISO: string;
  label: string;
  detail: string | null;
  /** Where this entry leads, when it leads anywhere. */
  href: string | null;
  /** TRUE when the date is still ahead — the page draws these as plans, not history. */
  upcoming: boolean;
};

/** The alaga itself. Always readable — it is the row the page was found by. */
export type TimelineDependent = {
  name: string;
  dependent_kind: DependentKind | string | null;
  birth_date: string | null;
  created_at: string;
  handed_over_at: string | null;
  vendor_profile_id: string | null;
};

export type TimelineEventRow = {
  event_id: string;
  display_name: string | null;
  event_type: string | null;
  /** The locked date, when one exists. */
  event_date: string | null;
  created_at: string;
  archived: boolean | null;
};

export type TimelineGodparentRow = {
  godparent_id: string;
  godparent_name: string | null;
  role: string | null;
  created_at: string;
};

export type TimelineShopRow = {
  business_name: string | null;
  business_slug: string | null;
  created_at: string;
};

export type BuildDependentTimelineInput = {
  dependent: TimelineDependent;
  /** Events naming this alaga. NULL = the read was refused. */
  events: readonly TimelineEventRow[] | null;
  /** Ninong / ninang edges (person case only). NULL = the read was refused. */
  godparents: readonly TimelineGodparentRow[] | null;
  /** The shop this alaga IS, when it is one. NULL = refused OR not a shop — see `shopExpected`. */
  shop: TimelineShopRow | null;
  /**
   * TRUE when the alaga carries a `vendor_profile_id`, i.e. a shop row SHOULD
   * have come back. Without this a refused shop read and "this alaga is not a
   * shop" are the same NULL, and the page would quietly drop a business's whole
   * origin rather than say it could not read it.
   */
  shopExpected: boolean;
};

export type DependentTimeline = {
  entries: DependentTimelineEntry[];
  /**
   * Sources whose read was REFUSED — not sources that are empty. The page
   * renders one honest line per name; an empty array means everything was read.
   */
  unmeasured: ('events' | 'godparents' | 'shop')[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** `yyyy-mm-dd` from an ISO date or timestamptz, or NULL if it is neither. */
export function isoDay(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!DATE_RE.test(raw)) return null;
  return raw.slice(0, 10);
}

function godparentLabel(row: TimelineGodparentRow): string {
  const name = (row.godparent_name ?? '').trim();
  const role = row.role === 'ninong' || row.role === 'ninang' ? row.role : null;
  if (!name) return role ? `A ${role} was named` : 'A godparent was named';
  return role ? `${name} became ${role}` : `${name} became a godparent`;
}

/**
 * The alaga's history, oldest first.
 *
 * OLDEST FIRST is deliberate: this reads as a life story ("founded · added ·
 * their first party · their debut"), and the entries still ahead sit at the
 * bottom flagged `upcoming`, which is where a plan belongs. Ties break on the
 * entry kind then the id, so the order is stable across renders.
 *
 * ⚠ `todayISO` IS A PARAMETER, NEVER A CLOCK READ HERE. "Upcoming" is the only
 * judgement this module makes, and a module that reads its own clock cannot be
 * asserted about the day either side of a boundary. The caller passes
 * `manilaToday()` — the same Manila day the rest of the surface uses.
 */
export function buildDependentTimeline(
  input: BuildDependentTimelineInput,
  todayISO: string,
): DependentTimeline {
  const { dependent, events, godparents, shop, shopExpected } = input;
  const entries: DependentTimelineEntry[] = [];
  const unmeasured: DependentTimeline['unmeasured'] = [];

  const kind = (dependent.dependent_kind ?? 'person') as DependentKind;
  const isPerson = isPersonDependent(dependent.dependent_kind);

  // 1 · The anchor date, named for what it MEANS to this kind. A business is not
  //     born and a car has no birthday — the column is `birth_date` for all of
  //     them, and calling it a birthday for a sari-sari store is the exact thing
  //     `DEPENDENT_DATE_LABELS` exists to stop.
  const anchor = isoDay(dependent.birth_date);
  if (anchor) {
    entries.push({
      id: 'anchor',
      kind: 'anchor',
      dateISO: anchor,
      label: DEPENDENT_DATE_LABELS[kind] ?? DEPENDENT_DATE_LABELS.other,
      detail: dependent.name,
      href: null,
      upcoming: anchor > todayISO,
    });
  }

  // 2 · The shop, when this alaga IS one. `shopExpected` separates "not a shop"
  //     from "we could not read the shop" — the same NULL otherwise.
  if (shopExpected) {
    if (!shop) {
      unmeasured.push('shop');
    } else {
      const opened = isoDay(shop.created_at);
      if (opened) {
        entries.push({
          id: 'shop-opened',
          kind: 'shop',
          dateISO: opened,
          label: 'Shop opened on Setnayan',
          detail: (shop.business_name ?? '').trim() || dependent.name,
          href: shop.business_slug ? `/${shop.business_slug}` : '/vendor-dashboard/shop',
          upcoming: false,
        });
      }
    }
  }

  // 3 · The day the record itself was made. Always known — it is the row we were
  //     found by — so it is the one entry that can never be missing, and it is
  //     what keeps a brand-new alaga's page from being blank.
  const added = isoDay(dependent.created_at);
  if (added) {
    entries.push({
      id: 'added',
      kind: 'added',
      dateISO: added,
      label: 'Added to your People',
      detail: null,
      href: null,
      upcoming: false,
    });
  }

  // 4 · The events that NAME this alaga (`events.honoree_dependent_id`). An
  //     archived event still happened, so it stays on the history and says so.
  if (events == null) {
    unmeasured.push('events');
  } else {
    for (const e of events) {
      const day = isoDay(e.event_date) ?? isoDay(e.created_at);
      if (!day) continue;
      const dated = isoDay(e.event_date) != null;
      entries.push({
        id: `event:${e.event_id}`,
        kind: 'event',
        dateISO: day,
        label: (e.display_name ?? '').trim() || 'An event',
        detail: e.archived
          ? 'Archived'
          : dated
            ? null
            : 'Date not set yet — shown from when it was created',
        href: `/dashboard/${e.event_id}`,
        upcoming: dated && day > todayISO,
      });
    }
  }

  // 5 · Godparents — the PERSON case only. A sari-sari store has no ninong, so
  //     the read is not even expected for the other kinds and its absence is
  //     never reported as unmeasured.
  if (isPerson) {
    if (godparents == null) {
      unmeasured.push('godparents');
    } else {
      for (const g of godparents) {
        const day = isoDay(g.created_at);
        if (!day) continue;
        entries.push({
          id: `godparent:${g.godparent_id}`,
          kind: 'godparent',
          dateISO: day,
          label: godparentLabel(g),
          detail: null,
          href: null,
          upcoming: false,
        });
      }
    }
  }

  // 6 · The hand-over / rehome. The end of THIS account's custody, and the last
  //     thing that can honestly be said about the record from here.
  const handed = isoDay(dependent.handed_over_at);
  if (handed) {
    entries.push({
      id: 'handover',
      kind: 'handover',
      dateISO: handed,
      label: isPerson ? 'They took over their own profile' : 'Care was handed over',
      detail: null,
      href: null,
      upcoming: false,
    });
  }

  entries.sort(
    (a, b) => a.dateISO.localeCompare(b.dateISO) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  );
  return { entries, unmeasured };
}

/** One honest sentence per refused source, for the page to render. */
export const UNMEASURED_COPY: Record<DependentTimeline['unmeasured'][number], string> = {
  events: 'We couldn’t load the events for this record — this history may be incomplete.',
  godparents: 'We couldn’t load the godparents for this record — this history may be incomplete.',
  shop: 'We couldn’t load the shop this record belongs to — this history may be incomplete.',
};
