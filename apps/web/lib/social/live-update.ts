/**
 * apps/web/lib/social/live-update.ts — the 2 PM live composer's words. Pure: no I/O, no env.
 *
 * Owner, 28 Nov 2026 (specs DECISION_LOG "WHAT EACH FACEBOOK SLOT CARRIES"): 2 PM carries the posts that only matter
 * at the last minute — recognitions, new verified shops, events done, Sunday weekly totals — from REAL data only.
 * When a 14:00 slot has no post, the flush asks this file for one (`lib/social/live-update.server.ts`).
 *
 *   • A fact that could not be read is null and is never guessed.
 *   • No small-number milestones: a count is shown only as a round total (the milestone ladder, 10 and up), and
 *     only events and the Sunday roundup carry counts. New shops are welcomed by name or trade, never counted.
 *   • No real update → no post. The slot stays empty and the caller logs it.
 */
import { MILESTONE_LADDER, MILESTONE_METRICS, type MilestoneMetric } from '@/lib/social/lane-s';
import { FB_SCHEDULE_MIN_LEAD_MS } from '@/lib/social/facebook-request';
import { LIVE_COMPOSE_FROM_HOUR, phDayKey, slotInstant } from '@/lib/social/governor';

/** One newly verified supplier, as the post may show it: named only for an active paid size (the hybrid rule). */
export type LiveShop = { named: boolean; businessName: string; category: string; region: string };

export type LiveFacts = {
  /** Suppliers verified in the last 7 days (live, not demo, not opted out, not ours). null = could not read. */
  shopsVerified: LiveShop[] | null;
  /** Real events held in the last 7 days. null = could not read. */
  eventsHeld: number | null;
  /** Sunday only: the all-time real totals from `social_milestone_real_counts()`. null = not read / not Sunday. */
  totals: Record<MilestoneMetric, number | null> | null;
};

export type LiveUpdatePost = {
  kind: 'weekly_totals' | 'new_shops' | 'events_held';
  title: string;
  body: string;
};

/** How many shops one welcome names before "and more". */
export const LIVE_SHOPS_SHOWN = 3;

/** The round total to show for a count: the highest milestone rung it has reached, or null below the first rung. */
export function roundTotal(count: number | null | undefined): number | null {
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  let rung: number | null = null;
  for (const step of MILESTONE_LADDER) if (step <= count) rung = step;
  return rung;
}

const n = (v: number) => v.toLocaleString('en-PH');

const TOTAL_LINES: Readonly<Record<MilestoneMetric, (c: number) => string>> = {
  events_created: (c) => `🎉 ${n(c)}+ events planned`,
  vendors_verified: (c) => `✅ ${n(c)}+ verified suppliers`,
  guests_invited: (c) => `💌 ${n(c)}+ guests invited`,
  users_joined: (c) => `🙌 ${n(c)}+ people joined`,
};

function weeklyTotals(facts: LiveFacts, dayKey: string): LiveUpdatePost | null {
  if (!facts.totals) return null;
  const lines: string[] = [];
  for (const metric of MILESTONE_METRICS) {
    const shown = roundTotal(facts.totals[metric]);
    if (shown !== null) lines.push(TOTAL_LINES[metric](shown));
  }
  const held = roundTotal(facts.eventsHeld);
  if (held !== null) lines.push(`🥂 ${n(held)}+ events celebrated this week`);
  if (lines.length === 0) return null;
  return {
    kind: 'weekly_totals',
    title: `This week on Setnayan · ${dayKey}`,
    body: [
      'This week on Setnayan 🇵🇭',
      '',
      ...lines,
      '',
      'Salamat sa bawat host, guest at supplier.',
      'What are you celebrating next? Tell us below 👇',
      '',
      '#Setnayan #SetNaYan',
    ].join('\n'),
  };
}

function shopLine(shop: LiveShop): string {
  return shop.named && shop.businessName.trim()
    ? `• ${shop.businessName.trim()} · ${shop.category}, ${shop.region}`
    : `• A new ${shop.category.toLowerCase()} in ${shop.region}`;
}

function newShops(facts: LiveFacts, dayKey: string): LiveUpdatePost | null {
  const shops = facts.shopsVerified ?? [];
  if (shops.length === 0) return null;
  const shown = shops.slice(0, LIVE_SHOPS_SHOWN).map(shopLine);
  if (shops.length > LIVE_SHOPS_SHOWN) shown.push('• …and more this week');
  return {
    kind: 'new_shops',
    title: `New verified suppliers · ${dayKey}`,
    body: [
      'Welcome to Setnayan, mga bagong verified supplier! 🎉',
      '',
      ...shown,
      '',
      'Planning an event? Find them on setnayan.com.',
      'Who should we welcome next? Tag them below 👇',
      '',
      '#Setnayan #SetNaYan',
    ].join('\n'),
  };
}

function eventsHeld(facts: LiveFacts, dayKey: string): LiveUpdatePost | null {
  const held = roundTotal(facts.eventsHeld);
  if (held === null) return null;
  return {
    kind: 'events_held',
    title: `Events this week · ${dayKey}`,
    body: [
      `${n(held)}+ events celebrated on Setnayan this week 🥂`,
      '',
      'Was one of them yours? Share your favourite moment below 👇',
      '',
      '#Setnayan #SetNaYan',
    ].join('\n'),
  };
}

/**
 * The 2 PM post for a PH day, or null when there is no real update. Sunday leads with the weekly totals; every day
 * then tries new verified suppliers, then events held this week (round totals only).
 */
export function composeLiveUpdate(facts: LiveFacts, dayKey: string, isSunday: boolean): LiveUpdatePost | null {
  return (isSunday ? weeklyTotals(facts, dayKey) : null) ?? newShops(facts, dayKey) ?? eventsHeld(facts, dayKey);
}

/** One live update per PH day, held by the (source_type, source_ref) partial-unique index. */
export function liveUpdateSourceRef(dayKey: string): string {
  return `live:${dayKey}`;
}

/**
 * True while the 2 PM composer may compose today's post: from 10:00 Manila to 13:50, the last moment Facebook still
 * takes it as a scheduled post for 14:00 (10 minutes ahead), so the visit that composes it also hands it over.
 */
export function inLiveComposeWindow(now: Date): boolean {
  const day = phDayKey(now);
  const opens = new Date(`${day}T${String(LIVE_COMPOSE_FROM_HOUR).padStart(2, '0')}:00:00+08:00`).getTime();
  const closes = slotInstant(day, 'afternoon').getTime() - FB_SCHEDULE_MIN_LEAD_MS;
  return now.getTime() >= opens && now.getTime() < closes;
}
