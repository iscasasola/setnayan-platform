/**
 * lib/services-glance.ts — EVERY PAID SERVICE AT A GLANCE: what Home's "Your
 * services" row and each service page's ONE band say, for the Planner (Setnayan
 * AI), Live stream (Live Watch), Music (Music Maker), Video booth (Patiktok) and
 * Event Hub Pro (pure, no I/O). Guest photos (Papic) keeps its own file,
 * `lib/papic-glance.ts`, whose shape this one wears.
 *
 * ✅ Owner "APPROVE ALL", 2026-10-14 (DECISION_LOG ✅ "THE SERVICES PROTOTYPE —
 * HOME ROWS + TOP BANDS FOR ALL SIX", over 🧩 and 🧾 the same day) — prototype
 * `Setnayan/prototypes/services_home_rows_and_bands_2026-10-14_fable.html`,
 * whose `glance(k)` this file translates, state by state:
 *
 *   owned        → a FULL row: the status line (the count bold) · one quiet line
 *                  · its doors (at most two) — and the page's band: the big
 *                  count (or a word, never a clock) · what it is · the line ·
 *                  the page's ONE main button · the second door
 *   waiting      → bought, not yet approved: "Waiting for payment · switches on
 *                  once approved" (the same words the services menu uses)
 *   not added    → a SLIM row: the price under the name · Add on the right; its
 *                  band shows the price and "Add for ₱…" is the main button
 *
 * The three calls the owner left open take the controller's suggestions
 * (DECISION_LOG ✅): (1) on the event day "Live now" takes Home's Next card for
 * that day only; (2) after the day Live stream keeps "download a copy to keep
 * it"; (3) after the day the Planner row says "N final bills to settle".
 *
 * 🔑 NOTHING HERE IS A NEW RULE OR A NEW READ. Ownership is the entitlement
 * gates' own answer (`eventSkuActive` / `eventOwnsSku`); the figures come from
 * ONE read (`event_service_figures`), the prices from the catalog only.
 *
 * 🔴 A read that did not happen is "—", never 0 (S41b): `null` here always means
 * NOT MEASURED, and every sentence says so rather than count it as nothing.
 *
 * ⛔ FREE TOOLS ARE NEVER ROWS (owner 2026-10-14 🧾, "Paid + Event Hub Pro"):
 * Budget, Date finder, the Maker, Chat, Guest list, Seating live in the menu,
 * the Next card and Home's numbers — `SERVICE_ROW_ORDER` is the whole list.
 */
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import { formatRecordingDuration } from '@/lib/live-studio-recordings';
import type { GlanceLine, ServiceMood } from '@/lib/service-glance';

/** The six rows, in the ONE order (owner 2026-10-14): owned first, each in this order. */
export const SERVICE_ROW_ORDER = ['papic', 'ai', 'live', 'music', 'booth', 'hub'] as const;
export type ServiceRowKey = (typeof SERVICE_ROW_ORDER)[number];

/**
 * The free tools the owner named (🧾 2026-10-14) — never a "Your services" row.
 * A guard holds `SERVICE_ROW_ORDER` and Home's rows apart from these.
 */
export const FREE_TOOLS_NEVER_ROWS = ['budget', 'date-finder', 'maker', 'chat', 'guest-list', 'seating'] as const;

/** The catalog code each row sells (Papic sells credit sizes, read on the tap). */
export const SERVICE_ROW_SKU: Readonly<Record<Exclude<ServiceRowKey, 'papic'>, string>> = {
  ai: 'SETNAYAN_AI',
  live: 'LIVE_STUDIO',
  music: 'PAKANTA',
  booth: 'PATIKTOK_COMPILER',
  hub: 'COUPLE_WEBSITE_PRO',
};
/** Live stream's "Add a venue screen" — the hosted channel, per day. */
export const VENUE_SCREEN_SKU = 'LIVE_STUDIO_HOSTED_CHANNEL';

/** on = unlocked · waiting = bought, payment not yet approved · none = not added. */
export type ServiceOwnership = 'on' | 'waiting' | 'none';

/** Where the event is in its life — the menu's one phase, in a row's words. */
export type ServiceDay = 'before' | 'day' | 'after';
export function serviceDayOf(phase: 'plan' | 'dayof' | 'after'): ServiceDay {
  return phase === 'dayof' ? 'day' : phase === 'after' ? 'after' : 'before';
}

/**
 * A door on a row or a band. The DESTINATION is not decided here: each kind's
 * link is an `href:` literal in the component that draws it, where the
 * port-controls scan can see it (the rule `home-first-screen.tsx` already keeps).
 */
export type ServiceDoorKind =
  | 'shortlist'
  | 'controller'
  | 'recording'
  | 'hear'
  | 'brief'
  | 'booth'
  | 'reels'
  | 'maker'
  | 'add'
  | 'more-screen'
  | 'more-song';
export type ServiceDoor = { kind: ServiceDoorKind; label: string };

/** A door that buys (opens the Add / Buy more sheet) — never drawn in the store shell. */
export function doorBuys(d: ServiceDoor): boolean {
  return d.kind === 'add' || d.kind === 'more-screen' || d.kind === 'more-song';
}

export type ServiceBand = {
  /** The count, a price, or a word ("In production", "Live") — never a clock. */
  big: string;
  /** True when `big` is a word, drawn smaller. */
  bigWord: boolean;
  /** What the big thing is ("suppliers watched"). */
  word: string;
  /** The second half of that line ("never expires"), or null. */
  of: string | null;
  /** The status line under it. */
  line: string;
  /** The page's ONE main button. */
  main: ServiceDoor | null;
  /** The second door. */
  second: ServiceDoor | null;
};

/** The Home Next card's service moments (owner 2026-10-14 ✅). */
export type ServiceMoment = 'live-now' | 'song-ready';

export type ServiceRowGlance = {
  key: Exclude<ServiceRowKey, 'papic'>;
  ownership: ServiceOwnership;
  mood: ServiceMood;
  /** The full row's status line, the count bold. */
  line: GlanceLine;
  /** The full row's one quiet line, or null. */
  say: string | null;
  /** The slim row's line (not added / waiting): price under the name. */
  slim: { lead: string | null; price: string | null; tail: string } | null;
  /** The row's doors — at most two. */
  doors: ServiceDoor[];
  band: ServiceBand;
  /** The Home Next card's moment, if this is one. */
  moment: ServiceMoment | null;
  /** The catalog price of the thing Add buys — null when not on sale / unread. */
  price: number | null;
  /** The price of its "buy more" (a venue-screen day · another song) — null when none. */
  morePrice: number | null;
  /** Drop the row from Home altogether (nothing to show or to buy). */
  hidden: boolean;
};

/** "₱2,499" — or null when the catalog had no live price (never a guess). */
export function priceWords(php: number | null | undefined): string | null {
  return typeof php === 'number' && Number.isFinite(php) && php > 0 ? formatPhpRounded(php) : null;
}

/** "Waiting for payment" — the services menu's own words for a pending order. */
export const WAITING_WORDS = 'Waiting for payment · switches on once approved';

function addDoor(price: number | null): ServiceDoor {
  const p = priceWords(price);
  return { kind: 'add', label: p ? `Add for ${p}` : 'Add' };
}

function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** Shared shape of the not-added and waiting states. */
function notYet(input: {
  key: ServiceRowGlance['key'];
  ownership: 'none' | 'waiting';
  price: number | null;
  slim: { lead: string | null; tail: string };
  band: { word: string; line: string; second?: ServiceDoor | null };
  waitingLine?: string;
}): ServiceRowGlance {
  const waiting = input.ownership === 'waiting';
  const p = priceWords(input.price);
  const waitingLine = input.waitingLine ?? WAITING_WORDS;
  return {
    key: input.key,
    ownership: input.ownership,
    mood: waiting ? 'wait' : 'plain',
    line: { lead: waiting ? waitingLine : 'Not added' },
    say: null,
    slim: waiting ? { lead: null, price: null, tail: waitingLine } : { lead: input.slim.lead, price: p, tail: input.slim.tail },
    doors: waiting ? [] : [{ kind: 'add', label: 'Add' }],
    band: {
      big: p ?? '—',
      bigWord: false,
      word: input.band.word,
      of: null,
      line: waiting ? waitingLine : input.band.line,
      main: waiting ? null : addDoor(input.price),
      second: input.band.second ?? null,
    },
    moment: null,
    price: input.price,
    morePrice: null,
    hidden: false,
  };
}

/* ─── Planner · Setnayan AI ─────────────────────────────────────────────── */

export type PlannerGlanceInput = {
  ownership: ServiceOwnership;
  /** The price this event would pay (per event type, comeback included) — null when not on sale. */
  price: number | null;
  day: ServiceDay;
  /** Suppliers it watches (non-archived on the list); null = unread. */
  suppliers: number | null;
  /** After the day: suppliers with money still owing; null = unread. */
  finalBills?: number | null;
  /** Payments due in 30 days — known on the Planner's own page only. */
  paymentsDue30d?: number | null;
  /** "Plan it myself" is on — the Planner rests (it still never expires). */
  manual?: boolean;
};

export function plannerGlance(input: PlannerGlanceInput): ServiceRowGlance {
  if (input.ownership !== 'on') {
    const g = notYet({
      key: 'ai',
      ownership: input.ownership,
      price: input.price,
      slim: { lead: null, tail: ' · one-time' },
      band: { word: 'one-time · never expires', line: 'Not added · ranks suppliers, watches payments and deadlines' },
    });
    // Not on sale for this event (no price — e.g. a type with no suppliers): nothing to show.
    return { ...g, hidden: input.ownership === 'none' && priceWords(input.price) === null };
  }
  const shortlist: ServiceDoor = { kind: 'shortlist', label: 'Open your shortlist' };
  const of = input.manual ? 'Plan it myself is on · the Planner rests' : 'never expires · watching this event';
  const n = input.suppliers;
  const big = n === null ? '—' : formatCount(n);
  const base = {
    key: 'ai' as const,
    ownership: 'on' as const,
    mood: 'ok' as ServiceMood,
    slim: null,
    doors: [shortlist],
    moment: null,
    price: input.price,
    morePrice: null,
    hidden: false,
  };
  if (input.day === 'after') {
    const bills = input.finalBills ?? null;
    const strong = bills === null ? null : bills === 0 ? 'every bill settled' : plural(bills, 'final bill to settle', 'final bills to settle');
    return {
      ...base,
      line: strong ? { lead: 'Planner on · ', strong } : { lead: 'Planner on · your day is done' },
      say: 'Your day is done · the Planner keeps your shortlist',
      band: {
        big,
        bigWord: false,
        word: 'suppliers watched',
        of,
        line: strong ? `Your day is done · ${strong}` : 'Your day is done',
        main: shortlist,
        second: null,
      },
    };
  }
  const watched = n === null ? '— suppliers watched' : plural(n, 'supplier watched', 'suppliers watched');
  const due = input.paymentsDue30d ?? null;
  return {
    ...base,
    line: { lead: 'Planner on · ', strong: watched },
    say: n === 0 ? 'Add a supplier to your shortlist and the Planner starts watching it.' : null,
    band: {
      big,
      bigWord: false,
      word: 'suppliers watched',
      of,
      line:
        n === 0
          ? 'Planner on · nothing to watch yet'
          : due !== null && due > 0
            ? `Planner on · ${plural(due, 'payment', 'payments')} due in 30 days`
            : 'Planner on · watching your suppliers',
      main: shortlist,
      second: null,
    },
  };
}

/**
 * Owner call 3 (2026-10-14): after the day, the Planner row counts the FINAL
 * BILLS TO SETTLE — the suppliers with money still owing, from the one money
 * resolver Home already holds (`resolveEventMoney`, `lib/budget-truth.ts`). A
 * supplier read that failed makes the count unknown (null → not "0 to settle").
 */
export function finalBillsToSettle(
  money: { reads: { suppliers: 'ok' | 'failed' }; lines: ReadonlyArray<{ vendorId: string | null; stillOwedPhp: number }> } | null,
): number | null {
  if (!money || money.reads.suppliers !== 'ok') return null;
  const owing = new Set<string>();
  for (const l of money.lines) if (l.vendorId && l.stillOwedPhp > 0) owing.add(l.vendorId);
  return owing.size;
}

/* ─── Live stream · Live Watch ──────────────────────────────────────────── */

export type LiveGlanceInput = {
  ownership: ServiceOwnership;
  price: number | null;
  /** The hosted venue-screen channel, per day — null when not on sale. */
  screenPrice: number | null;
  day: ServiceDay;
  /** Cameras set up (channels not switched off); null = unread. */
  cameras: number | null;
  live: boolean | null;
  /** When it went live (ISO) — "since 3:02 pm". */
  liveSince?: string | null;
  recorded: boolean | null;
  recordedMinutes?: number | null;
  /** The event day in words ("Saturday, 19 December") — null with no date. */
  dayWords: string | null;
  nowMs?: number;
};

function cameraWord(n: number | null): string {
  return n === null ? '— cameras' : plural(n, 'camera', 'cameras');
}

function sinceWords(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const at = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
    .format(new Date(t))
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return `since ${at}`;
}

export function liveGlance(input: LiveGlanceInput): ServiceRowGlance {
  const controller: ServiceDoor = { kind: 'controller', label: 'Open controller' };
  const screenP = priceWords(input.screenPrice);
  const moreScreen: ServiceDoor | null = screenP ? { kind: 'more-screen', label: 'Add a venue screen' } : null;
  if (input.ownership !== 'on') {
    const g = notYet({
      key: 'live',
      ownership: input.ownership,
      price: input.price,
      slim: { lead: '1 camera free · ', tail: ' for more' },
      band: {
        word: 'one-time · more cameras and venue screens',
        line: '1 camera is free — try it from the controller',
        second: { kind: 'controller', label: 'Open controller' },
      },
    });
    // The buy path closes after the day (`addOnSellableNow`); nothing to add then.
    return { ...g, hidden: input.ownership === 'none' && (input.day === 'after' || priceWords(input.price) === null) };
  }
  const base = { key: 'live' as const, ownership: 'on' as const, slim: null, price: input.price, morePrice: screenP ? input.screenPrice : null, hidden: false };
  const goesLive = input.dayWords ? `Goes live ${input.dayWords}` : 'Goes live on your day';
  if (input.live === true) {
    const since = sinceWords(input.liveSince);
    return {
      ...base,
      mood: 'live',
      line: { strong: 'Live now', tail: ` · ${cameraWord(input.cameras)}` },
      say: 'Your guests are watching on your Event Hub.',
      doors: [controller],
      band: {
        big: 'Live',
        bigWord: true,
        word: 'on your Event Hub',
        of: [cameraWord(input.cameras), since].filter(Boolean).join(' · '),
        line: 'Live now · on your Event Hub',
        main: controller,
        second: null,
      },
      // Owner call 1: Live now takes the Next card ON THE DAY only.
      moment: input.day === 'day' ? 'live-now' : null,
    };
  }
  if (input.recorded === true && input.day !== 'before') {
    const mins = input.recordedMinutes ?? null;
    const length = mins !== null && mins > 0 ? formatRecordingDuration(mins * 60) : null;
    const recording: ServiceDoor = { kind: 'recording', label: 'See the recording' };
    return {
      ...base,
      mood: 'ok',
      line: length ? { lead: 'Recorded · ', strong: length } : { strong: 'Recorded' },
      // Owner call 2: YouTube unlisted links are not forever — say so.
      say: 'Unlisted on YouTube · download a copy to keep it',
      doors: [recording],
      band: {
        big: length ?? 'Recorded',
        bigWord: length === null,
        word: 'recorded',
        of: [input.dayWords, cameraWord(input.cameras)].filter(Boolean).join(' · ') || null,
        line: 'Unlisted on YouTube · download a copy to keep it',
        main: recording,
        second: null,
      },
      moment: null,
    };
  }
  if (input.day === 'after') {
    return {
      ...base,
      mood: 'plain',
      line: { lead: 'Your day is done · no recording' },
      say: null,
      doors: [controller],
      band: { big: '—', bigWord: false, word: 'no recording', of: input.dayWords, line: 'Your day is done · no recording', main: controller, second: null },
      moment: null,
    };
  }
  const n = input.cameras;
  const ready = n !== null && n > 0;
  return {
    ...base,
    mood: 'wait',
    line: ready
      ? { strong: cameraWord(n), tail: ` ready · ${goesLive}` }
      : n === 0
        ? { strong: 'No cameras', tail: ` set up yet · ${goesLive}` }
        : { strong: '— cameras', tail: ` · ${goesLive}` },
    say: ready ? 'Rehearse any time from the controller.' : 'Pair a phone or a DSLR from the controller.',
    doors: moreScreen ? [moreScreen, controller] : [controller],
    band: {
      big: n === null ? '—' : formatCount(n),
      bigWord: false,
      word: ready || n === null ? 'cameras ready' : 'cameras set up',
      of: 'never expires for this event',
      line: `${goesLive} · you press Go live`,
      main: controller,
      second: moreScreen ? { kind: 'more-screen', label: `Add a venue screen · ${screenP} a day` } : null,
    },
    moment: null,
  };
}

/* ─── Music · Music Maker ───────────────────────────────────────────────── */

export type MusicGlanceInput = {
  ownership: ServiceOwnership;
  price: number | null;
  day: ServiceDay;
  /** Offered for this event type at all (the Studio's own surface gate). */
  offered: boolean;
  /** `events.pakanta_song_status` — 'ready' only with a delivered file. */
  song: 'in_production' | 'ready' | null;
  /** The song plays on the Event Hub (`pakanta_song_adopted_as_site_music`). */
  playing: boolean;
};

export function musicGlance(input: MusicGlanceInput): ServiceRowGlance {
  const p = priceWords(input.price);
  if (input.ownership !== 'on') {
    const g = notYet({
      key: 'music',
      ownership: input.ownership,
      price: input.price,
      slim: { lead: null, tail: ' · one song' },
      band: { word: 'one original song, from your story', line: 'Not added · tell us your story, we write and produce it' },
      waitingLine: 'Waiting for payment · we start once approved',
    });
    return { ...g, hidden: input.ownership === 'none' && (!input.offered || p === null) };
  }
  const base = { key: 'music' as const, ownership: 'on' as const, slim: null, price: input.price, morePrice: p ? input.price : null, hidden: false };
  const another: ServiceDoor | null = p ? { kind: 'more-song', label: 'Another song' } : null;
  const hear: ServiceDoor = { kind: 'hear', label: 'Hear your song' };
  if (input.song !== 'ready') {
    // 🔑 NO CLOCK, NO PROMISE (owner 2026-10-14 🧩 4): "In production" — nothing more.
    const brief: ServiceDoor = { kind: 'brief', label: 'See your brief' };
    return {
      ...base,
      mood: 'wait',
      line: { strong: 'Song in production' },
      say: 'You’ll see Ready here first.',
      doors: [brief],
      band: { big: 'In production', bigWord: true, word: 'one original song', of: null, line: 'In production · you will see Ready here first', main: null, second: brief },
      moment: null,
    };
  }
  const playing = input.playing ? 'Playing on your Event Hub.' : 'Not playing on your Event Hub.';
  if (input.day === 'after') {
    return {
      ...base,
      mood: 'ok',
      line: { strong: '1', tail: ' song · yours to keep' },
      say: 'Download it any time.',
      doors: another ? [another, hear] : [hear],
      band: { big: '1', bigWord: false, word: 'song, yours to keep', of: null, line: 'Yours to keep · download it any time', main: hear, second: another ? { kind: 'more-song', label: `Another song · ${p}` } : null },
      moment: null,
    };
  }
  return {
    ...base,
    mood: 'ok',
    line: { strong: 'Ready', tail: ' · 1 song' },
    say: playing,
    doors: another ? [another, hear] : [hear],
    band: {
      big: 'Ready',
      bigWord: true,
      word: '1 song',
      of: null,
      line: input.playing ? 'Playing on your Event Hub' : 'Ready · not playing on your Event Hub',
      main: hear,
      second: another ? { kind: 'more-song', label: `Another song · ${p}` } : null,
    },
    // No email goes out (owner 2026-10-11), so the Next card is the one "ready" signal —
    // until it is heard (the card's own once-only marker, on the device).
    moment: 'song-ready',
  };
}

/* ─── Video booth · Patiktok ────────────────────────────────────────────── */

export type BoothGlanceInput = {
  ownership: ServiceOwnership;
  price: number | null;
  day: ServiceDay;
  /** Reels finished; null = unread. */
  reels: number | null;
  dayWords: string | null;
};

export function boothGlance(input: BoothGlanceInput): ServiceRowGlance {
  const booth: ServiceDoor = { kind: 'booth', label: 'Open booth' };
  if (input.ownership !== 'on') {
    const g = notYet({
      key: 'booth',
      ownership: input.ownership,
      price: input.price,
      slim: { lead: 'Free to record · ', tail: ' to save & share' },
      band: {
        // Owner 2026-10-14 🧩 3: PER EVENT.
        word: 'per event · save, download and share every reel',
        line: 'Free to record — previews carry a watermark',
        second: booth,
      },
    });
    return { ...g, hidden: input.ownership === 'none' && (input.day === 'after' || priceWords(input.price) === null) };
  }
  const base = { key: 'booth' as const, ownership: 'on' as const, slim: null, price: input.price, morePrice: null, hidden: false, moment: null };
  const n = input.reels;
  const seeReels = (lead: string): ServiceDoor => ({ kind: 'reels', label: `${lead} ${n === null ? '' : formatCount(n) + ' '}${n === 1 ? 'reel' : 'reels'}`.replace(/\s+/g, ' ') });
  if (input.day === 'after') {
    return {
      ...base,
      mood: 'ok',
      line: { strong: n === null ? '— reels' : plural(n, 'reel', 'reels'), tail: ' · your day is done' },
      say: 'Yours to keep — download all.',
      doors: [seeReels('See your')],
      band: { big: n === null ? '—' : formatCount(n), bigWord: false, word: n === 1 ? 'reel, yours to keep' : 'reels, yours to keep', of: input.dayWords ? `recorded ${input.dayWords}` : null, line: 'Yours to keep · download all any time', main: seeReels('See your'), second: null },
    };
  }
  if (n === 0) {
    const when = input.dayWords ? `Guests record on your day · ${input.dayWords}` : 'Guests record on your day';
    return {
      ...base,
      mood: 'wait',
      line: { lead: 'On · ', strong: '0', tail: ' reels yet' },
      say: when,
      doors: [booth],
      band: { big: '0', bigWord: false, word: 'reels yet', of: 'save & share on', line: when, main: booth, second: null },
    };
  }
  return {
    ...base,
    mood: 'ok',
    line: { lead: 'On · ', strong: n === null ? '— reels' : plural(n, 'reel', 'reels') },
    say: null,
    doors: [booth],
    band: {
      big: n === null ? '—' : formatCount(n),
      bigWord: false,
      word: n === 1 ? 'reel' : 'reels',
      of: 'save & share on',
      line: 'On · guests record free, you save and share',
      main: booth,
      second: n === null ? null : seeReels('See your'),
    },
  };
}

/* ─── Event Hub Pro ─────────────────────────────────────────────────────── */

export type HubProGlanceInput = {
  ownership: ServiceOwnership;
  price: number | null;
  /** The applied theme's name ("Vintage") — null when unread. */
  theme: string | null;
  /** What is behind the page, in words ("video background") — null when unread. */
  background: string | null;
};

export function hubProGlance(input: HubProGlanceInput): ServiceRowGlance {
  const maker: ServiceDoor = { kind: 'maker', label: 'Open the Maker' };
  if (input.ownership !== 'on') {
    const g = notYet({
      key: 'hub',
      ownership: input.ownership,
      price: input.price,
      slim: { lead: null, tail: ' · one-time' },
      // ◆ marks Pro and never blocks: the free Maker stays open.
      band: { word: 'one-time · never expires', line: 'Not added · every ◆ theme, photo and video backgrounds', second: maker },
    });
    return { ...g, hidden: input.ownership === 'none' && priceWords(input.price) === null };
  }
  const look = [input.theme ? `${input.theme} theme` : null, input.background].filter(Boolean).join(' · ');
  return {
    key: 'hub',
    ownership: 'on',
    mood: 'ok',
    line: { strong: 'Pro on', tail: look ? ` · ${look}` : '' },
    say: 'Every ◆ theme and background is yours to apply.',
    slim: null,
    doors: [maker],
    band: { big: 'On', bigWord: true, word: look || 'Event Hub Pro', of: 'never expires', line: 'Pro on · themes, photo and video backgrounds', main: maker, second: null },
    moment: null,
    price: input.price,
    morePrice: null,
    hidden: false,
  };
}

/**
 * NEVER TWICE (owner 2026-10-14) — what a row draws that its own Next card
 * already offers: the music row's two doors while "Your song is ready" is on
 * screen; Live stream's controller while "Live now" is. Drawn, but marked
 * `data-while-next` so they stand down only while that card is visible — a
 * "Later" brings them straight back (the Papic rule, walk-b6 F1).
 */
export function serviceRowDoubled(row: ServiceRowGlance, next: ServiceMoment | null): boolean {
  return next !== null && row.moment === next;
}
