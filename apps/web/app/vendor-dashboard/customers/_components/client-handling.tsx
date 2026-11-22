'use client';

/**
 * 👤 ONE CLIENT, ONE ACCOUNT MANAGER — inside an opened Clients row (supplier roles d–h, the #8013 drawing (f)).
 *
 *   · Hand over: "Keep with Joy" · "Give to Bea" — the person who has the client, or a Shop / Branch Manager
 *     (controller row 6; the receiver doesn't have to accept). Whoever gets it handles every booking of this client.
 *   · "Handled by ▾" — a Shop or Branch Manager moves any client.
 * The server checks the caller again (`lib/client-handover.server.ts`); these are only the doors. Every write is handed
 * in; this file imports no action.
 */
import { useRef } from 'react';
import { ArrowRightLeft, Check } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { StayForm } from '@/app/_components/stay-form';

export type ClientHandlingView = {
  threadId: string;
  /** "Lead Stylist · Joy Tan" — who has the client now. */
  handledByName: string | null;
  handOver: { keepFirst: string; giveFirst: string } | null;
  /** The viewer may answer the Hand over. */
  mayAnswer: boolean;
  /** The viewer may move the client ("Handled by ▾") — the people they may move it to. Null = not theirs to move. */
  moveTo: { currentId: string | null; options: { key: string; label: string }[] } | null;
};

export function ClientHandling({ view, action, returnTo }: { view: ClientHandlingView; action: (fd: FormData) => Promise<void>; returnTo: string }) {
  const form = useRef<HTMLFormElement>(null);
  const target = useRef<HTMLInputElement>(null);
  const hidden = (
    <>
      <input type="hidden" name="thread_id" value={view.threadId} />
      <input type="hidden" name="return_to" value={returnTo} />
    </>
  );
  return (
    <div className="grid gap-2 border-t border-ink/10 py-3" data-client-handling={view.threadId}>
      {view.handOver ? (
        <div className="grid gap-2" data-client-hand-over="">
          <p className="text-[13.5px] text-ink/80">
            One client, one Account Manager. {view.handOver.keepFirst} had them first and keeps them until handed over.
          </p>
          <p className="text-[13px] text-[color:var(--m-slate-2)]">Whoever gets it handles every booking, even on the other card.</p>
          {view.mayAnswer ? (
            <div className="flex flex-wrap justify-end gap-2">
              <StayForm door="supTeam.setVendorRoleNames" action={action}>
                {hidden}
                <input type="hidden" name="op" value="keep" />
                <SupplierSubmit tone="neutral" icon={<Check aria-hidden strokeWidth={1.9} />} label={`Keep with ${view.handOver.keepFirst}`} pendingLabel="Keeping…" />
              </StayForm>
              <StayForm door="supTeam.setVendorRoleNames" action={action}>
                {hidden}
                <input type="hidden" name="op" value="give" />
                <SupplierSubmit tone="ok" main icon={<ArrowRightLeft aria-hidden strokeWidth={1.9} />} label={`Give to ${view.handOver.giveFirst}`} pendingLabel="Handing over…" />
              </StayForm>
            </div>
          ) : null}
        </div>
      ) : null}
      {view.moveTo && view.moveTo.options.length > 0 ? (
        <StayForm ref={form} door="supTeam.setVendorRoleNames" action={action} className="flex flex-wrap items-center justify-between gap-2" data-client-handled-by="">
          {hidden}
          <input type="hidden" name="op" value="move" />
          <input ref={target} type="hidden" name="move_to" defaultValue={view.moveTo.currentId ?? ''} />
          <span className="text-[13.5px] text-ink/70">Handled by</span>
          <PickMenu
            label="Handled by"
            value={view.moveTo.currentId ?? ''}
            options={view.moveTo.options}
            onPick={(k) => {
              if (!target.current || k === target.current.value) return;
              target.current.value = k;
              form.current?.requestSubmit();
            }}
            dataAttr="data-client-handled-by-pick"
            compact
            className="!min-h-11"
          />
        </StayForm>
      ) : view.handledByName ? (
        <p className="text-[13.5px] text-ink/70" data-client-handled-by-name="">
          Handled by {view.handledByName}
        </p>
      ) : null}
    </div>
  );
}
