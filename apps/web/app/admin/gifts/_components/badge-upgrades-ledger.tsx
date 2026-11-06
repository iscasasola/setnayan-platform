import { Rocket } from 'lucide-react';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { BADGE_UPGRADE_NAME, upgradeSourceWords, upgradeWords } from '@/lib/badge-upgrades';
import type { BadgeUpgradeLedgerRow } from '@/lib/badge-upgrades.server';

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/**
 * ⏱ ADMIN › GIFTS & COMPS › BADGE UPGRADES (owner approved the table 2026-11-06) — every 4-week personal upgrade a
 * badge gave a shop, newest first: which badge, what it unlocks, and whether the supplier has started it (and until
 * when the add-on now runs). Read-only: an upgrade is given once per badge step and started once by the supplier
 * (`shop_badge_upgrade_start`). Presentational — the page reads.
 */
export function BadgeUpgradesLedger({ rows, readError }: { rows: BadgeUpgradeLedgerRow[] | null; readError: { message: string } | null }) {
  return (
    <section className="mb-10" data-admin-badge-upgrades="">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">Badge upgrades</h2>
      <p className="mb-4 text-xs text-ink/60">
        Four weeks of an add-on for the shop itself — Verified → Papic Challenges · first booking → 3D Booth (Papic
        Challenges below Solo) · 5 reviews → AI Chatbot · Top Pick / Most Booked → their choice. Each waits, never
        expiring, until the supplier taps Start in Shop › Promote; Start adds four weeks to that add-on.
      </p>
      <ConsoleTable<BadgeUpgradeLedgerRow>
        rows={rows}
        readError={readError}
        readPermitted
        reads="the badge upgrades"
        label="Badge upgrades"
        cap={200}
        minWidth="36rem"
        rowKey={(r) => r.upgradeId}
        empty={{
          Icon: Rocket,
          title: 'No badge has given an upgrade yet',
          blurb: 'An upgrade lands here the first time a shop’s badge is read as earned.',
        }}
        columns={[
          { header: 'When', mono: true, cell: (r) => fmtDay(r.grantedAt) },
          { header: 'Shop', cell: (r) => r.shopName ?? r.vendorProfileId },
          { header: 'Badge', cell: (r) => upgradeSourceWords(r.key) },
          { header: 'Upgrade', cell: (r) => (r.startedChoice ? BADGE_UPGRADE_NAME[r.startedChoice] : upgradeWords(r.startable)) },
          {
            header: 'Where it stands',
            cell: (r) =>
              r.startedAt
                ? `Started ${fmtDay(r.startedAt)}${r.endsAt ? ` · runs until ${fmtDay(r.endsAt)}` : ''}`
                : 'Ready — waiting for the supplier to start it',
          },
        ]}
      />
    </section>
  );
}
