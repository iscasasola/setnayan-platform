'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Play, Rocket } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { BADGE_UPGRADE_NAME, upgradeSourceWords, upgradeWords, type BadgeUpgradeChoice, type BadgeUpgradeRow } from '@/lib/badge-upgrades';
import { startBadgeUpgrade, type StartBadgeUpgradeState } from '../badge-upgrade-actions';

/** null ⇒ the upgrades could not be read (never "none"). */
export type BadgeUpgradesSectionData = { rows: BadgeUpgradeRow[] | null; nowMs: number };

const IDLE: StartBadgeUpgradeState = { status: 'idle' };
const icUp = <Rocket aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/**
 * ⏱ YOUR UPGRADES — the personal half of the badge rewards (owner approved the table 2026-11-06): four weeks of Papic
 * Challenges, the 3D Booth or the AI Chatbot for the supplier's own shop, given by Verified, the first booking, 5 reviews
 * and Top Pick / Most Booked of the month.
 *
 *   Your upgrades ⓘ
 *   4 weeks of Papic Challenges · SETNAYAN Verified · [Ready]  ›   → tap: the Start sheet
 *   4 weeks of your choice · Top Pick · Nov 2026 · [Ready]     ›   → tap: Upgrade ▾ · Start 4 weeks
 *   AI Chatbot · 5 reviews · on until Dec 4 · [Started]
 *
 * A ready upgrade never expires; its four weeks start at the tap (`startBadgeUpgrade`). Rows tap open — no buttons on
 * a row (house rule) — and the one write lives inside the sheet.
 *
 * 🏠 HOME: Plan, above Add-ons — an upgrade is add-on time, and Plan is where add-ons live (Shop › Promote is what a
 * supplier hands out to couples, DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL"). The Shop ⚙'s Plan fold
 * mounts the same screen.
 */
export function BadgeUpgradesSection({ data }: { data: BadgeUpgradesSectionData }) {
  const headingId = useId();
  const [open, setOpen] = useState<BadgeUpgradeRow | null>(null);
  const rows = data.rows;
  return (
    <section id="upgrades" className="mt-8 scroll-mt-24" data-badge-upgrades="" aria-labelledby={headingId}>
      <InfoTip label="Your upgrades" labelAs="h2" labelClassName="sn-sec" labelId={headingId} align="start">
        Some badges give your own shop four weeks of an add-on: Verified → Papic Challenges · your first booking → 3D Booth
        (Papic Challenges below Supplier Plus, where the booth can&rsquo;t show your logo) · 5 reviews → AI Chatbot · Top Pick or
        Most Booked of the month → the one you choose. Each waits here until you tap Start — it never expires unused.
      </InfoTip>
      <div className="mt-2">
        {rows === null ? (
          <p className="py-2 text-[13.5px] text-ink/70" role="status">
            Your upgrades couldn&rsquo;t load. Reload to try again — nothing you earned has changed.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-2 text-[13.5px] text-ink/60">Earn Verified, your first booking or 5 reviews to unlock four weeks of an add-on.</p>
        ) : (
          rows.map((r) => {
            if (r.startedAt && r.startedChoice) {
              const live = r.endsAt ? Date.parse(r.endsAt) > data.nowMs : false;
              return (
                <DatesRow
                  key={r.upgradeId}
                  data="badge-upgrade-row"
                  lead={icUp}
                  title={BADGE_UPGRADE_NAME[r.startedChoice]}
                  line={`${upgradeSourceWords(r.key)} · ${r.endsAt ? `${live ? 'on until' : 'ended'} ${day(r.endsAt)}` : 'started'}`}
                  badge={{ tone: live ? 'ok' : 'quiet', word: live ? 'On' : 'Ended' }}
                />
              );
            }
            return (
              <DatesRow
                key={r.upgradeId}
                data="badge-upgrade-row"
                lead={icUp}
                title={upgradeWords(r.startable)}
                line={upgradeSourceWords(r.key)}
                badge={{ tone: 'ok', word: 'Ready' }}
                onOpen={() => setOpen(r)}
              />
            );
          })
        )}
      </div>
      {open ? <StartUpgradeSheet row={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** The Start sheet: what it is, where it came from, the pick (when there is one), and the one write. */
function StartUpgradeSheet({ row, onClose }: { row: BadgeUpgradeRow; onClose: () => void }) {
  const headingId = useId();
  const toast = useToast();
  const [state, formAction] = useActionState(startBadgeUpgrade, IDLE);
  const handled = useRef<StartBadgeUpgradeState | null>(null);
  const [choice, setChoice] = useState<BadgeUpgradeChoice | null>(row.startable[0] ?? null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'started') {
      toast.success(state.message);
      onClose();
    }
  }, [state, toast, onClose]);

  return (
    <Sheet open onClose={onClose} labelledById={headingId} rise>
      <div className="px-5 pb-6 pt-5" data-badge-upgrade-sheet="">
        <h2 id={headingId} className="pr-12 text-[18px] font-semibold text-ink">
          {upgradeWords(row.startable)}
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">
          From {upgradeSourceWords(row.key)}. The four weeks start when you tap Start; if you already have it, they add on.
        </p>
        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="upgrade_id" value={row.upgradeId} />
          <input type="hidden" name="choice" value={choice ?? ''} />
          {row.startable.length > 1 ? (
            <PickMenu
              label="Upgrade"
              value={choice}
              className="!min-h-11 w-full"
              options={row.startable.map((c) => ({ key: c, label: BADGE_UPGRADE_NAME[c] }))}
              onPick={(key) => setChoice(key as BadgeUpgradeChoice)}
              dataAttr="data-badge-upgrade-choice"
            />
          ) : null}
          <SupplierSubmit
            tone="brand"
            main
            icon={<Play aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
            label={choice ? `Start ${BADGE_UPGRADE_NAME[choice]}` : 'Start'}
            pendingLabel="Starting…"
            className="w-full"
          />
        </form>
      </div>
    </Sheet>
  );
}
