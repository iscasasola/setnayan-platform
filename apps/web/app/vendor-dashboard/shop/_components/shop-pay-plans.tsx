'use client';

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { formsAction } from '../../forms/actions';
import { paymentLine, planDeletedLine, planRowLine, type PlanTemplate, type PlanTemplatesRead } from '@/lib/pay-plan-templates';

/**
 * 💳 SHOP › TEMPLATES › PAYMENT STRATEGIES — Card Maker part 4 (owner 17 Nov name "Payment Strategies"). The shop's
 * saved pay plans (`vendor_pay_plans`, part 2): tap opens its payments, swipe left deletes with Undo (`formsAction` op
 * `plan-retire`, written when the Undo window closes). Every card keeps its own payment rows.
 *
 * ONE place per tool (controller ruling 20 Nov under the owner's delegation, after main moved the Makers into
 * "Templates"): this is the third tile of main's Templates row. The part-4 "Templates" panel's other two kinds had
 * doors of their own already and are not drawn here — Quick Forms IS the Forms Maker's body (its rows swipe-delete
 * with Undo there) and Discounts and Promos IS the Offer Maker.
 *
 * 🔒 app/vendor-dashboard/shop/shop-pay-plans.test.ts
 */
export function ShopPayPlans({
  plans,
  returnPath = '/vendor-dashboard/shop',
}: {
  /** The shop's Payment Strategies; null while on its way. */
  plans: PlanTemplatesRead | null;
  returnPath?: string;
}) {
  return (
    <div className="space-y-4" data-shop-pay-plans="">
      <PlanList plans={plans} returnPath={returnPath} />
      <UndoToastHost />
    </div>
  );
}

/** Payment Strategies — the shop's saved pay plans. */
function PlanList({ plans, returnPath }: { plans: PlanTemplatesRead | null; returnPath: string }) {
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState<PlanTemplate | null>(null);
  const headId = useId();
  if (plans === null) {
    return (
      <p role="status" className="py-4 text-[13.5px] text-ink/70" data-templates-loading="plans">
        Opening your Payment Strategies…
      </p>
    );
  }
  if (plans.status === 'unread') {
    return (
      <p role="status" className="py-4 text-[13.5px] text-ink/70" data-templates-plans="unread">
        Your Payment Strategies could not be read just now. Close this and open it again.
      </p>
    );
  }
  const shown = plans.plans.filter((p) => !gone.has(p.id));
  const remove = (p: PlanTemplate) =>
    deleteWithUndo({
      label: planDeletedLine(p),
      hide: () => setGone((g) => new Set(g).add(p.id)),
      restore: () =>
        setGone((g) => {
          const n = new Set(g);
          n.delete(p.id);
          return n;
        }),
      commit: async () => {
        const fd = new FormData();
        fd.set('op', 'plan-retire');
        fd.set('plan_id', p.id);
        fd.set('return_path', returnPath);
        const r = await formsAction({ status: 'idle' }, fd);
        return r.status === 'error' ? { ok: false, error: r.message } : { ok: true };
      },
      failed: 'Couldn’t delete that plan. It’s back — try again.',
    });

  return (
    <div className="space-y-2" data-templates-plans="ok">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Your Payment Strategies</p>
      {shown.length === 0 ? (
        <p className="text-sm text-ink/70" data-templates-plans-empty="">
          None yet. On any card, open Pay plan and press Save as my plan.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => (
            <SwipeToDelete key={p.id} as="li" label={`Delete ${p.name}`} onDelete={() => remove(p)}>
              <button
                type="button"
                onClick={() => setOpen(p)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3.5 py-2.5 text-left"
                data-templates-plan={p.id}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-ink">{p.name}</span>
                  <span className="block text-xs text-ink/70">{planRowLine(p)}</span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-ink/70" aria-hidden />
              </button>
            </SwipeToDelete>
          ))}
        </ul>
      )}
      <Sheet open={open !== null} onClose={() => setOpen(null)} labelledById={headId}>
        {open ? (
          <div className="space-y-3 px-4 pb-5 pt-2" data-templates-plan-sheet={open.id}>
            <h2 id={headId} className="text-[17px] font-semibold text-ink">
              {open.name}
            </h2>
            <ol className="divide-y divide-ink/10">
              {open.items.map((d, i) => (
                <li key={i} className="py-2.5 text-[14.5px] text-ink">
                  {paymentLine(d)}
                </li>
              ))}
            </ol>
            <p className="text-[13px] text-ink/70">
              {open.cardCount > 0
                ? 'To change it, open a card that follows it and edit its Pay plan — you’ll be asked to change it on every card or just that one.'
                : 'Not on a card yet. Pick it on any card’s Pay plan.'}
            </p>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
