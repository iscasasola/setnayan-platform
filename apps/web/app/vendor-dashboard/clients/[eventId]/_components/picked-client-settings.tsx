'use client';

/**
 * ⚙ THIS CLIENT'S SETTINGS (prototype v113, the picked client's ⚙: "Who looks after this client, and what reaches
 * you."). Shipped facts only — nothing here is a new setting:
 *   • Supplier requests auto-agree — the HOST's setting (`events.supplier_requests_auto_agree`), shown read-only:
 *     whether a change you suggest goes straight in. Unread is said, never drawn as Off.
 *   • Notes — the team's private notes on this client (`vendor_client_notes`), which live on the Report page with the
 *     activity feed; the row opens that page in place.
 * ⛔ No "Handled by" here: the per-client handler is INVENTED (parts map C22) — only the Clients list filter exists.
 */
import { NotebookPen } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { usePickedNav } from './picked-client-nav';

export function PickedClientSettings({ autoAgree }: { autoAgree: boolean | null }) {
  const nav = usePickedNav();
  return (
    <div className="px-4 pb-4">
      <h3 className="mt-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">This client</h3>
      <div className="flex items-start gap-3 py-3" data-client-setting="auto-agree">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">
            <InfoTip label="Supplier requests auto-agree" align="start">
              When this is on, a change you suggest to their schedule goes straight in. The host decides it in their
              Schedule settings.
            </InfoTip>
          </div>
          <p className="text-[13px] text-ink/70">The host&rsquo;s setting · shown here</p>
        </div>
        <span className="shrink-0 text-[15px] font-semibold text-ink/80">
          {autoAgree === null ? "Couldn't load" : autoAgree ? 'On' : 'Off'}
        </span>
      </div>
      <h3 className="mt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">Notes</h3>
      <div className="flex items-center gap-3 py-3" data-client-setting="notes">
        <p className="min-w-0 flex-1 text-[15px] text-ink">Notes only your team sees</p>
        {nav ? (
          <ActionButton tone="neutral" icon={NotebookPen} label="Open" onClick={() => nav.select('report')} />
        ) : null}
      </div>
    </div>
  );
}
