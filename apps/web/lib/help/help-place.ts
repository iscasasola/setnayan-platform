import type { HelpCoverage } from '@/lib/help-ask-core';

/**
 * 🧭 WHICH HELP THIS IS, AND THE ADDRESS THAT KEEPS IT — one reading for every Help page (/help, a topic, all topics,
 * a guide), so moving from one to the next never drops the account the person came from (approved Help 13 Nov 2026,
 * "Help coverage = active account"; the Guide & Help drawing of 21 Nov adds the topic and guide pages).
 *
 * COVERAGE = THE ACTIVE ACCOUNT, NO PICKER. The account sheet that opened Help says which account is active: a shop's
 * sheet opens `?for=shop` (the shop's help), an invite opens `?for=guest` (guest answers, no account switch), anything
 * else signed in is the user account (host AND guest answers). Signed out, no invite: About Setnayan only. An old
 * `?role=` address lands on the same coverage it used to narrow to. `?refer=<event>` is the event Help was opened from
 * (an event's sheet) — the only event a "Take me there" may open; with none, an event screen has no door.
 */
export type HelpPlace = {
  coverage: HelpCoverage;
  /** The `for` the address carries ('shop' · 'guest'), or none for the user's own help and the public one. */
  forParam: 'shop' | 'guest' | undefined;
  referEvent: string | null;
  /** Whose "Take me there" doors: the shop's or the user's. */
  account: 'shop' | 'user';
};

export type HelpSearch = { for?: string; role?: string; refer?: string };

export function coverageFor(search: { for?: string; role?: string }, signedIn: boolean): HelpCoverage {
  const f = search.for ?? (search.role === 'vendor' ? 'shop' : search.role === 'guest' ? 'guest' : undefined);
  if (f === 'guest') return 'guest';
  if (!signedIn) return 'public';
  return f === 'shop' ? 'supplier' : 'user';
}

/** Only an event's public id travels in `refer` — anything else is dropped, never echoed into a link. */
export function referFrom(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(raw) ? raw : null;
}

export function helpPlace(search: HelpSearch, signedIn: boolean): HelpPlace {
  const coverage = coverageFor(search, signedIn);
  return {
    coverage,
    forParam: coverage === 'supplier' ? 'shop' : coverage === 'guest' ? 'guest' : undefined,
    referEvent: referFrom(search.refer),
    account: coverage === 'supplier' ? 'shop' : 'user',
  };
}

/** The params every Help address keeps: `for` and `refer`, plus any extra (`q`, a prefill). */
export function helpKeep(place: HelpPlace): { for?: string; refer?: string } {
  return { for: place.forParam, refer: place.referEvent ?? undefined };
}

/** `path` with this help's `for` / `refer` (and any extras) — e.g. `/help/topics/guests?for=shop`. */
export function inHelp(path: string, place: HelpPlace, extra: Record<string, string | undefined> = {}, hash = ''): string {
  const params = new URLSearchParams(
    Object.entries({ ...helpKeep(place), ...extra }).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return `${path}${params ? `?${params}` : ''}${hash ? `#${hash}` : ''}`;
}
