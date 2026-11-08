/**
 * 🗓 SHOP ⚙ › "BUSINESS PERMIT" — the Mayor's Permit renewal line (THE ONE BUILD spec §9 #8/#19, lane C4: "ADD the
 * Shop ⚙ 'Business permit expiry' line so A2 A9's link lands"). PURE.
 *
 * ONE RULE, NOT TWO: the date is `vendor_profiles.next_renewal_due_at` and its state is the shipped `badgeDeadline`
 * (`lib/verified-badge.ts`) — the same 60-day window Today's row and the reminder email use. An unread row says so,
 * never "no permit on file".
 * 🔒 lib/shop-permit-line.test.ts
 */
import { badgeDeadline, deadlineLabel, type BadgeFacts } from './verified-badge';

export type PermitLine = { line: string; badge: { tone: 'ok' | 'wait' | 'quiet'; word: string } | null };

export function shopPermitLine(facts: BadgeFacts | null, now: Date = new Date()): PermitLine {
  if (facts === null) return { line: 'Couldn’t read your permit date just now', badge: null };
  const due = facts.next_renewal_due_at ?? null;
  const d = badgeDeadline(facts, now);
  switch (d.kind) {
    case 'none':
      return facts.verification_state === 'verified'
        ? { line: 'No renewal date on file', badge: null }
        : { line: 'Setnayan reads its date when it checks your papers', badge: null };
    case 'ahead':
      return { line: `Renews ${deadlineLabel(due!)} · in ${d.daysLeft} days`, badge: { tone: 'ok', word: 'Current' } };
    case 'reminder':
      return {
        line: `Renews ${deadlineLabel(due!)} · in ${d.daysLeft} ${d.daysLeft === 1 ? 'day' : 'days'} — send the renewed one`,
        badge: { tone: 'wait', word: `${d.daysLeft} ${d.daysLeft === 1 ? 'day' : 'days'} left` },
      };
    case 'lapsed':
      return { line: `Ran out on ${deadlineLabel(due!)} — send the renewed one to keep your Verified badge`, badge: { tone: 'wait', word: 'Renew now' } };
  }
}
