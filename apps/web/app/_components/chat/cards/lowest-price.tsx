'use client';

/**
 * 🤝 YOUR LOWEST, KEPT PRIVATE (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING";
 * drawing S9ScH2Ps v3, screen 9). Two small parts, supplier side only:
 *
 *   LowestRow        "Your lowest" — the supplier types it once (Make a quote · Every version). Only their shop reads it.
 *   UnderLowestLine  ONE quiet line in the warn colour when a counter or a new version is under it:
 *                    "Under your lowest, ₱42,500" — never a pop-up, never a block; the Send button stays as it was.
 *
 * The number is the supplier's own input: nothing here suggests, defaults or derives one. No lowest set, or a read
 * that failed → no line at all (an unread lowest is not "none", and it is not a reason to warn either).
 */
import { useEffect } from 'react';
import { TypedRow } from '@/app/_components/form-row';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCentavosPhp } from '@/lib/php';
import { isUnderLowest, loadLowest, saveLowest, useLowestState } from './lowest-calls';

export function UnderLowestLine({ threadId, totalCentavos }: { threadId: string; totalCentavos: number }) {
  const state = useLowestState(threadId);
  useEffect(() => {
    void loadLowest(threadId);
  }, [threadId]);
  if (state.at !== 'ok' || !isUnderLowest(state.centavos, totalCentavos)) return null;
  const lowest = formatCentavosPhp(state.centavos);
  return (
    <div className="text-[13px] font-semibold" style={{ color: 'rgb(var(--color-warn))' }} role="status" data-under-lowest="">
      <InfoTip label={`Under your lowest, ${lowest}`} align="start">
        Your lowest: {lowest}. Only you see this. Change it in Every version.
      </InfoTip>
    </div>
  );
}

export function LowestRow({ threadId }: { threadId: string }) {
  const state = useLowestState(threadId);
  useEffect(() => {
    void loadLowest(threadId);
  }, [threadId]);
  if (state.at === 'idle' || state.at === 'loading') return null;
  if (state.at === 'failed') {
    return (
      <p className="text-[13px]" style={{ color: 'rgb(var(--color-danger))' }} role="alert" data-lowest-row="failed">
        Couldn&rsquo;t load your lowest.{' '}
        <button type="button" className="sn-press -my-3 inline-flex min-h-11 items-center font-semibold underline" onClick={() => void loadLowest(threadId, true)}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <TypedRow
      name="Your lowest"
      about={{ words: 'Only you see this. A counter or a new quote under it shows one line — nothing is blocked.' }}
      amount
      value={state.centavos ? String(state.centavos / 100) : ''}
      empty="Set"
      onKeep={async (v) => {
        const centavos = Math.round((Number(String(v).replace(/[^0-9.]/g, '')) || 0) * 100);
        const r = await saveLowest(threadId, centavos > 0 ? centavos : null);
        return r.ok ? { ok: true } : { ok: false, error: r.message };
      }}
      data="lowest"
    />
  );
}
