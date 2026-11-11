/**
 * fair-presentation-sweep.ts — THE ONE SWEEP OF LIVE CARDS AND SHOPS (owner 2026-11-08, Build 2 item (5)).
 *
 * ⚖ *"one sweep of live cards/shops → in-app 'Edit your name' notice, nothing taken down"* · the repeat-notice copy:
 * *"One of your cards needs a quick edit to meet our fair-presentation standard: [what]. It stays visible while you fix
 * it."*
 *
 * The sweep is READ, not written: every time a supplier opens their Shop tab, their own live names (the shop name, the
 * tagline, every live card name and every live bundle name) are asked the same `findFairHits` the editors ask, and
 * each one that needs an edit is listed with a door to the field. So the notice can never go stale — it is gone the
 * moment the name is fixed — and there is no table of "notices sent" to drift from the truth.
 *
 * 🛑 NEVER TAKES ANYTHING DOWN, NEVER EMAILS. A card or bundle stays live and visible while it is fixed (the ruled
 * sentence says so). "Repeats → admin review → card hidden" is NOT built here — it needs an owner rule on what counts
 * as a repeat.
 *
 * PURE — the Shop tab reads the rows and hands them in (`app/vendor-dashboard/shop/_components/fair-sweep-notice.tsx`).
 */
import { fairNoticeLine, findFairHits, type FairField } from './fair-presentation';
import type { ClaimWord } from './service-card-checks';

export type SweepInput = {
  shopName: string | null;
  tagline: string | null;
  /** The shop's cards — only `live` ones are swept (a draft is checked when it is next edited). */
  cards: ReadonlyArray<{ id: string; title: string | null; live: boolean }>;
  /** The shop's bundles — only `live` ones are swept. */
  packages: ReadonlyArray<{ id: string; name: string | null; live: boolean }>;
};

export type SweepKind = 'shop_name' | 'tagline' | 'card' | 'package';

export type SweepItem = {
  kind: SweepKind;
  /** The card / bundle id; `null` for the shop name and the tagline. */
  id: string | null;
  /** The name as it stands, for the row. */
  label: string;
  /** The ruled "[what]" — every fix on that name, joined. */
  what: string;
  /** The door to the field that fixes it. */
  href: string;
  /** The ruled notice sentence for this one. */
  line: string;
};

const SUBJECT: Record<SweepKind, string> = {
  shop_name: 'Your shop name',
  tagline: 'Your tagline',
  card: 'One of your cards',
  package: 'One of your bundles',
};

const FIELD: Record<SweepKind, FairField> = { shop_name: 'shop_name', tagline: 'tagline', card: 'card_name', package: 'package_name' };

function joinWhat(fixes: string[]): string {
  const list = Array.from(new Set(fixes));
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** Every live name that needs an edit, shop name first, then the tagline, the cards, the bundles. */
export function fairSweepItems(input: SweepInput, words: ReadonlyArray<ClaimWord> | null): SweepItem[] {
  const items: SweepItem[] = [];
  const liveCards = input.cards.filter((c) => c.live && (c.title ?? '').trim());
  const one = (kind: SweepKind, id: string | null, value: string | null, href: string, siblings?: string[]) => {
    const v = (value ?? '').trim();
    if (!v) return;
    const hits = findFairHits([{ field: FIELD[kind], value: v }], { words, siblingNames: siblings });
    if (hits.length === 0) return;
    const what = joinWhat(hits.map((h) => h.fix));
    items.push({ kind, id, label: v, what, href, line: fairNoticeLine(what, SUBJECT[kind]) });
  };
  one('shop_name', null, input.shopName, '/vendor-dashboard/profile#name');
  one('tagline', null, input.tagline, '/vendor-dashboard/profile#contact');
  for (const c of liveCards) {
    const siblings = liveCards.filter((o) => o.id !== c.id).map((o) => o.title ?? '');
    one('card', c.id, c.title, `/vendor-dashboard/services/${c.id}`, siblings);
  }
  for (const p of input.packages) if (p.live) one('package', p.id, p.name, `/vendor-dashboard/packages/${p.id}`);
  return items;
}
