/**
 * THE SHOP WALLET — one Papic-credit balance per shop (owner 2026-10-23,
 * option A). PURE: no database, no `server-only`, so guards and unit tests can
 * import every rule here. The reads and the spend live in
 * `lib/shop-wallet.server.ts`; the ledger is `shop_papic_wallet_entries`
 * (migration `shop_papic_wallet_ledger_and_the_shop_pack`).
 *
 * ── THE RULE, IN THE OWNER'S WORDS (23 Oct, on the prototype
 *    `shop_wallet_portfolio_credits_2026-10-23`) ──────────────────────────────
 *   • option A — ONE SHOP WALLET: packs go into one shop balance, spendable on
 *     the portfolio or on any event the shop is booked on;
 *   • the 50-credit event gift and the booking-fee credits STAY WITH THEIR
 *     EVENT (`vendor_papic_portfolio_credit_grants`, a different pot);
 *   • every shop gets 50 portfolio credits free; after that 1 credit a photo,
 *     8 a 10-second clip, paid once and kept while the shop exists — and the
 *     free 50 COUNT CREDITS ("yes they count credits"), so a clip uses 8 of
 *     them.
 *
 * ── ONE LEDGER, ONE HOME ─────────────────────────────────────────────────────
 * The balance has exactly one home on screen: Customers › Money › SETNAYAN
 * (one row, one sheet). The portfolio uploader and an event's Papic quote the
 * same number beside the thing it pays for. Nothing else stores it.
 *
 * ── A FAILED READ IS A SENTENCE, NEVER 0 ─────────────────────────────────────
 * `balance: null` means the wallet could not be read. Every surface renders it
 * as "Couldn't read it right now" and disables spend/buy with that reason. It
 * is NEVER rendered as 0, "0 left", or an enabled Buy with a remembered price
 * (the 20 Aug disease: a failure that renders identically to emptiness).
 */

/** The ledger's `kind` vocabulary — the migration's CHECK, said once in TS. */
export const SHOP_WALLET_KINDS = [
  'pack_order',
  'admin',
  'comp',
  'portfolio_spend',
  'event_spend',
  'reversal',
] as const;
export type ShopWalletKind = (typeof SHOP_WALLET_KINDS)[number];

/** Kinds that only ever ADD (the CHECK pins delta > 0 for these). */
export const SHOP_WALLET_MONEY_IN: ReadonlySet<ShopWalletKind> = new Set(['pack_order', 'admin', 'comp']);

/** The two things a shop spends its wallet on — the spend door refuses any other. */
export type ShopWalletSpendKind = 'portfolio_spend' | 'event_spend';

/** One ledger row as the app reads it. */
export type ShopWalletEntry = {
  entryId: string;
  delta: number;
  kind: ShopWalletKind;
  orderId: string | null;
  eventId: string | null;
  photos: number | null;
  clips: number | null;
  createdAt: string;
};

/**
 * A pack still being checked — the order exists, the money has not been
 * approved, so the balance DOES NOT MOVE and the word is never "Paid".
 *   'checking'  — the screenshot is in (or the order is awaiting it);
 *   'resubmit'  — the admin asked for a new screenshot (`admin_resubmit_notice`).
 */
export type ShopWalletPendingPack = {
  referenceCode: string;
  amountPhp: number;
  state: 'checking' | 'resubmit';
};

/** What the Money row and the sheet read with one call. */
export type ShopWallet = {
  /** SUM(delta). `null` = could not be read — never render as 0. */
  balance: number | null;
  /** Newest first. Empty on a failed read (and `balance` is then null). */
  entries: ShopWalletEntry[];
  /** The newest pack order not yet approved, if any. */
  pendingPack: ShopWalletPendingPack | null;
};

/** Sum a ledger. A non-finite delta is skipped, never treated as a number. */
export function walletBalanceOf(entries: readonly Pick<ShopWalletEntry, 'delta'>[]): number {
  let sum = 0;
  for (const e of entries) {
    const d = Number(e.delta);
    if (Number.isFinite(d)) sum += Math.trunc(d);
  }
  return sum;
}

/**
 * The Money row's title — "Shop wallet · 128 Papic credits" — or, on a failed
 * read, just "Shop wallet" (the subline then carries the sentence). Words from
 * the prototype frames `money-wallet-row` and `f1-wallet-unreadable`.
 */
export function walletRowTitle(balance: number | null): string {
  if (balance == null) return 'Shop wallet';
  return `Shop wallet · ${balance.toLocaleString('en-PH')} Papic credits`;
}

/** The Money row's subline (frames `money-wallet-row`, `pay-waiting`, `f5`, `f1`). */
export function walletRowSubline(wallet: Pick<ShopWallet, 'balance' | 'pendingPack'>, peso: (n: number) => string): string {
  if (wallet.balance == null) return 'Couldn’t read it right now — nothing was spent';
  const p = wallet.pendingPack;
  if (p?.state === 'resubmit') return `${peso(p.amountPhp)} pack · needs a new screenshot`;
  if (p?.state === 'checking') return `${peso(p.amountPhp)} pack · checking`;
  return 'Portfolio and any event · packs you bought';
}

/** One line of the sheet's "Came from" list. */
export type WalletHistoryLine = {
  key: string;
  title: string;
  sub: string;
};

const fmtDay = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
};

const signed = (n: number): string => (n > 0 ? `+${n.toLocaleString('en-PH')}` : `−${Math.abs(n).toLocaleString('en-PH')}`);

/**
 * The sheet's "Came from" list (frame `wallet-sheet`): every pack on its own
 * line ("+100 · Pack · ₱500" / "12 Oct · GCash · approved"); every portfolio
 * spend folded into ONE line ("−72 · Portfolio photos" / "since 4 Sep · 72
 * photos past the free 50"); event spends folded per event; reversals and
 * admin rows on their own lines. Newest first, by each line's latest row.
 *
 * `packMeta` carries what the ledger row does not: the ₱ and the rail of the
 * order the pack came from (read from `orders` + `payments`). A missing meta
 * draws the line without them rather than inventing a price.
 */
export function walletHistoryLines(
  entries: readonly ShopWalletEntry[],
  opts: {
    packMeta?: ReadonlyMap<string, { amountPhp: number | null; rail: string | null }>;
    eventNames?: ReadonlyMap<string, string>;
    peso: (n: number) => string;
  },
): WalletHistoryLine[] {
  type Acc = { key: string; latest: string; earliest: string; title: string; sub: string };
  const out: Acc[] = [];
  let portfolio: { credits: number; photos: number; clips: number; earliest: string; latest: string } | null = null;
  const perEvent = new Map<string, { credits: number; earliest: string; latest: string }>();

  for (const e of entries) {
    if (e.kind === 'portfolio_spend') {
      const p = (portfolio ??= { credits: 0, photos: 0, clips: 0, earliest: e.createdAt, latest: e.createdAt });
      p.credits += Math.abs(e.delta);
      p.photos += e.photos ?? 0;
      p.clips += e.clips ?? 0;
      if (e.createdAt < p.earliest) p.earliest = e.createdAt;
      if (e.createdAt > p.latest) p.latest = e.createdAt;
      continue;
    }
    if (e.kind === 'event_spend') {
      const k = e.eventId ?? 'unknown';
      const a = perEvent.get(k) ?? { credits: 0, earliest: e.createdAt, latest: e.createdAt };
      a.credits += Math.abs(e.delta);
      if (e.createdAt < a.earliest) a.earliest = e.createdAt;
      if (e.createdAt > a.latest) a.latest = e.createdAt;
      perEvent.set(k, a);
      continue;
    }
    if (e.kind === 'pack_order') {
      const meta = e.orderId ? opts.packMeta?.get(e.orderId) : undefined;
      const price = meta?.amountPhp != null ? ` · ${opts.peso(meta.amountPhp)}` : '';
      const rail = meta?.rail ? ` · ${meta.rail}` : '';
      out.push({
        key: e.entryId,
        latest: e.createdAt,
        earliest: e.createdAt,
        title: `${signed(e.delta)} · Pack${price}`,
        sub: `${fmtDay(e.createdAt)}${rail} · approved`,
      });
      continue;
    }
    if (e.kind === 'reversal') {
      out.push({
        key: e.entryId,
        latest: e.createdAt,
        earliest: e.createdAt,
        title: `${signed(e.delta)} · Pack refunded`,
        sub: fmtDay(e.createdAt),
      });
      continue;
    }
    // admin / comp — credits from Setnayan.
    out.push({
      key: e.entryId,
      latest: e.createdAt,
      earliest: e.createdAt,
      title: `${signed(e.delta)} · From Setnayan`,
      sub: fmtDay(e.createdAt),
    });
  }

  if (portfolio) {
    const what =
      portfolio.clips > 0
        ? `${portfolio.photos.toLocaleString('en-PH')} photos · ${portfolio.clips.toLocaleString('en-PH')} clips`
        : `${portfolio.photos.toLocaleString('en-PH')} photos`;
    out.push({
      key: 'portfolio',
      latest: portfolio.latest,
      earliest: portfolio.earliest,
      title: `${signed(-portfolio.credits)} · Portfolio photos`,
      sub: `since ${fmtDay(portfolio.earliest)} · ${what} past the free 50`,
    });
  }
  for (const [eventId, a] of perEvent) {
    const name = opts.eventNames?.get(eventId) ?? 'An event';
    out.push({
      key: `event:${eventId}`,
      latest: a.latest,
      earliest: a.earliest,
      title: `${signed(-a.credits)} · ${name} · Papic`,
      sub: `since ${fmtDay(a.earliest)} · after the event’s own credits ran out`,
    });
  }

  return out
    .sort((x, y) => (x.latest < y.latest ? 1 : x.latest > y.latest ? -1 : 0))
    .map(({ key, title, sub }) => ({ key, title, sub }));
}

/** One event's own pot, as the sheet quotes it (frame `wallet-sheet`, "Your events' own credits"). */
export type EventPotLine = {
  eventId: string;
  name: string;
  /** null = that pot could not be read — said, never 0. */
  left: number | null;
  /** "50 gift + 40 from the booking fee" — what it came from. */
  cameFrom: string;
  used: number;
};

/** "Ana & Miguel · 28 left" / "50 gift + 40 from the booking fee · 62 used". */
export function eventPotTitle(p: EventPotLine): string {
  if (p.left == null) return `${p.name} · couldn’t read`;
  return `${p.name} · ${p.left.toLocaleString('en-PH')} left`;
}
export function eventPotSub(p: EventPotLine): string {
  const used = p.used > 0 ? `${p.used.toLocaleString('en-PH')} used` : 'nothing used yet';
  return p.cameFrom ? `${p.cameFrom} · ${used}` : used;
}
