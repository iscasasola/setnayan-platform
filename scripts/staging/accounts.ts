/**
 * THE STAGING ACCOUNTS — the one list of test sign-ins the final check uses. Written ONCE, here.
 *
 * `seed.ts` creates each one through the Supabase admin API with a generated password, `seed.sql` gives each one
 * its data (it reads the emails from the `staging.accounts` setting, never a typed address), and the kit doc
 * (build-sessions/FINAL-CHECK-KIT.md) hands each checker its own. Eight are the eight checker areas; the last two are
 * the deliberately BIG and MESSY accounts (300+ guests, long names, old-style records) that every checker may visit.
 *
 * 🔒 Every address is on a RESERVED test domain (RFC 2606 `.test`): no mailbox exists behind it anywhere, so even a
 * mail that escaped every lock could not reach a person. A sink domain may be chosen instead with `plusSinkEmail`
 * (`qa+couple-plan@…` — the allowlisted inbox itself, the same mailbox the email lock already allows).
 */

export type StagingAccountKey =
  | 'front'
  | 'couple_plan'
  | 'couple_maker'
  | 'guest'
  | 'supplier_shop'
  | 'supplier_bookings'
  | 'coordinator'
  | 'admin'
  | 'messy_one'
  | 'messy_two';

export type StagingAccount = {
  key: StagingAccountKey;
  /** The checker area (1–8) this sign-in belongs to; `null` = shared by every area. */
  area: number | null;
  /** What the account is for, in one line. */
  role: string;
  /** The name the account carries (a test name — no real person). */
  fullName: string;
};

export const STAGING_ACCOUNTS: readonly StagingAccount[] = [
  { key: 'front', area: 1, role: 'Front door and public pages — signed OUT; this sign-in is a spare for the sign-in pages themselves', fullName: 'Lia Fronda' },
  { key: 'couple_plan', area: 2, role: 'Couple: create an event and plan it (guests, seats, budget, suppliers, checklist)', fullName: 'Bea Villanueva' },
  { key: 'couple_maker', area: 3, role: 'Couple: Maker, Event Hub page, invitations, Papic, Memories', fullName: 'Carla Mendoza' },
  { key: 'guest', area: 4, role: 'Guest: never signs in for the Event Hub (use the links); this sign-in is for claim and join flows', fullName: 'Andres Lim' },
  { key: 'supplier_shop', area: 5, role: 'Supplier: shop, service cards, Toolkit, plans (Pro plan)', fullName: 'Rafael Liwanag' },
  { key: 'supplier_bookings', area: 6, role: 'Supplier: bookings in every state, chat, payments, calendar (Free plan)', fullName: 'Nena Bautista' },
  { key: 'coordinator', area: 7, role: 'Coordinator seat on a booked wedding, plus a seat on the venue shop (Spaces, the map pin)', fullName: 'Tala Reyes' },
  { key: 'admin', area: 8, role: 'Admin console (account_type admin — not internal, so its own paid gates stay honest)', fullName: 'Admin Staging' },
  { key: 'messy_one', area: null, role: 'BIG and MESSY couple: a 350-guest wedding, very long and accented names, old-style records', fullName: 'María-José Dela Paz-Santiago y González de los Reyes' },
  { key: 'messy_two', area: null, role: 'BIG and MESSY couple: a 320-guest reunion, an undated old event, lapsed and refunded orders, a long chat', fullName: "Ma. Concepción 'Connie' Ñañez-O'Brien" },
] as const;

/** The reserved test domain every staging address sits on by default. */
export const DEFAULT_ACCOUNT_DOMAIN = 'final-check.test';

const RESERVED_TEST_TLDS = ['.test', '.example', '.invalid', '.localhost'];

/** `couple_plan` → `couple-plan@final-check.test`. Throws for a domain that is not a reserved test domain. */
export function accountEmail(key: StagingAccountKey, domain: string = DEFAULT_ACCOUNT_DOMAIN): string {
  const d = domain.trim().toLowerCase();
  if (!RESERVED_TEST_TLDS.some((tld) => d.endsWith(tld)) || !/^[a-z0-9.-]+$/.test(d)) {
    throw new Error(`staging accounts: "${domain}" is not a reserved test domain (${RESERVED_TEST_TLDS.join(' ')})`);
  }
  return `${key.replace(/_/g, '-')}@${d}`;
}

/** `couple_plan` + sink `qa@x.example` → `qa+couple-plan@x.example`: the allowlisted inbox itself, tagged. */
export function plusSinkEmail(key: StagingAccountKey, sink: string): string {
  const at = sink.lastIndexOf('@');
  if (at <= 0 || /[\s,;<>]/.test(sink)) throw new Error('staging accounts: STAGING_EMAIL_SINK is not one address');
  const local = sink.slice(0, at).split('+')[0];
  return `${local}+${key.replace(/_/g, '-')}@${sink.slice(at + 1)}`.toLowerCase();
}

/** Every account's email, keyed, for the `staging.accounts` setting `seed.sql` reads. */
export function accountEmails(pick: (key: StagingAccountKey) => string): Record<StagingAccountKey, string> {
  return Object.fromEntries(STAGING_ACCOUNTS.map((a) => [a.key, pick(a.key)])) as Record<StagingAccountKey, string>;
}
