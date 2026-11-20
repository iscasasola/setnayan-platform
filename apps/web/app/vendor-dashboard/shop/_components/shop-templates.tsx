'use client';

import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronRight, Lock } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow } from '@/app/_components/form-row';
import { Sheet } from '@/app/_components/sheet';
import { formatCount } from '@/lib/format-number';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { formsAction } from '../../forms/actions';
import {
  TEMPLATE_KINDS,
  paymentLine,
  planDeletedLine,
  planRowLine,
  type PlanTemplate,
  type PlanTemplatesRead,
  type TemplateKind,
} from '@/lib/pay-plan-templates';

/**
 * 🗂 SHOP › MAKERS › TEMPLATES — Card Maker part 4. The HYBRID drawing's Templates screen (owner 17 Nov "Keep
 * Templates"; kind names ruled the same day: Quick Forms · Discounts and Promos · Payment Strategies), built onto the
 * shipped Shop per ruling 280d53a9 "Yes, extend it": ONE place for what a shop saves once and uses on many cards.
 *
 *   Show ▾ (one dropdown — any set of choices is a dropdown)
 *   · Quick Forms          → the SHIPPED Forms Maker body (`ShopFormsMaker`): tap opens a form, ＋ New form, and now
 *                            swipe left deletes with Undo. Moved, not redrawn — the Forms Maker tile shows the same.
 *   · Discounts and Promos → the SHIPPED Offer Maker rises over this panel (it lists, opens, swipe-deletes with Undo
 *                            and makes new offers itself). Unverified shops see the shared lock (Problem → Solution).
 *   · Payment Strategies   → NEW: the shop's saved pay plans (`vendor_pay_plans`, part 2). Tap opens its payments;
 *                            swipe left deletes with Undo (`formsAction` op `plan-retire`, written when the Undo window
 *                            closes). Every card keeps its own payment rows.
 *   Availability presets are the Availability builder's (not drawn here yet).
 *
 * 🔒 app/vendor-dashboard/shop/shop-templates.test.ts
 */
/**
 * The Offer Maker's door, handed down by `ShopMakers` (the body is drawn by the server, which cannot pass functions):
 * the tile's facts, and how to raise the shipped Offer Maker or its lock over this panel. Absent = no offers kind.
 */
export type TemplatesOffers = {
  facts: { verified: boolean; running: number | null; total: number | null };
  open: () => void;
  locked: () => void;
};
export const TemplatesOffersContext = createContext<TemplatesOffers | null>(null);

export function ShopTemplates({
  forms,
  plans,
  returnPath = '/vendor-dashboard/shop',
  start = 'forms',
}: {
  /** The Forms Maker's server-drawn body; null while it is on its way. */
  forms: ReactNode | null;
  /** The shop's Payment Strategies; null while on its way. */
  plans: PlanTemplatesRead | null;
  returnPath?: string;
  start?: TemplateKind;
}) {
  const door = useContext(TemplatesOffersContext);
  const offers = door?.facts ?? null;
  const kinds = TEMPLATE_KINDS.filter((k) => k.key !== 'offers' || offers);
  const [kind, setKind] = useState<TemplateKind>(kinds.some((k) => k.key === start) ? start : 'forms');

  return (
    <div className="space-y-4" data-shop-templates={kind}>
      <ChosenRow
        name="Show"
        label="Templates"
        value={kind}
        options={kinds.map((k) => ({ key: k.key, label: k.label }))}
        onPick={(k) => setKind(k as TemplateKind)}
        dataAttr="data-templates-show"
        data="templates-show"
      />
      {kind === 'forms' ? (
        (forms ?? (
          <p role="status" className="py-4 text-[13.5px] text-ink/70" data-templates-loading="forms">
            Opening your Quick Forms…
          </p>
        ))
      ) : kind === 'offers' && offers ? (
        <OffersDoor offers={offers} onOpen={door!.open} onLocked={door!.locked} />
      ) : (
        <PlanList plans={plans} returnPath={returnPath} />
      )}
      <UndoToastHost />
    </div>
  );
}

/** Discounts and Promos — the shipped Offer Maker rises; this only says how many and opens it. */
function OffersDoor({
  offers,
  onOpen,
  onLocked,
}: {
  offers: { verified: boolean; running: number | null; total: number | null };
  onOpen: () => void;
  onLocked: () => void;
}) {
  if (!offers.verified) {
    return (
      <div className="space-y-3" data-templates-offers="locked">
        <p className="flex items-start gap-2 text-[13.5px] text-ink/70">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} />
          Discounts and Promos open once your shop is verified.
        </p>
        <ActionButton tone="brand" icon={Lock} label="See how" onClick={onLocked} className="w-full !h-11" data-templates-offers-lock="" />
      </div>
    );
  }
  const line =
    offers.running === null || offers.total === null
      ? 'Your offers could not be counted just now.'
      : offers.total === 0
        ? 'No offers yet.'
        : `${formatCount(offers.running)} of ${formatCount(offers.total)} running.`;
  return (
    <div className="space-y-3" data-templates-offers="ok">
      <p className="text-[13.5px] text-ink/70">{line} Tap to open, swipe left to delete, ＋ New makes one.</p>
      <ActionButton tone="brand" icon={ArrowUpRight} label="Open Discounts and Promos" onClick={onOpen} className="w-full !h-11" data-templates-offers-open="" />
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
