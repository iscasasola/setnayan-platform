'use client';

/**
 * Creators — the two pieces that rise (owner-approved redraw v3, 21 Nov 2026; `supplier_tools_redraw_v3_fable.html`
 * § 04). Look only: the reach bar and the offer form are the shipped ones, moved —
 *   · `CreatorsReach` — the old "Minimum followers" box + "Set reach bar" at the top is the thumb row's sliders round
 *     now (its dot while a bar is set), opening a sheet with the same field and button. It still submits by GET, so the
 *     list and its count follow `?minReach=` exactly as before.
 *   · `SendOfferButton` — the fold-open form inside every creator card is ONE sheet from "Send offer": creator rate
 *     required, audience rate optional, the 14-day expiry, free to send, the Pro note on Send — the same
 *     `sendCreatorOffer` action, through the same `StayForm` door.
 */
import { useId, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ActionButton } from '@/components/action-button';
import { SortFace, sortLabel } from '@/components/sort-face';
import { ThumbRow } from '@/components/thumb-row';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { StayForm } from '@/app/_components/stay-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { TypedRow } from '@/app/_components/form-row';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { sendCreatorOffer } from '../actions';

const FIELD = 'input-field w-full rounded-full text-[15px]';

export function CreatorsReach({ minReach }: { minReach: number }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const headId = useId();
  const on = minReach > 0;
  return (
    <>
      <SupplierThumbRow
        name="creators"
        label="Creator actions"
        row={
          <ThumbRow
            name="creators"
            right={[
              {
                node: (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={sortLabel(on)}
                    aria-haspopup="dialog"
                    className="sn-press grid h-11 w-11 place-items-center rounded-full"
                    data-creators-reach=""
                  >
                    <SortFace on={on} />
                  </button>
                ),
              },
            ]}
          />
        }
      />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
        <form method="GET" action={path} className="flex flex-col gap-3 px-5 pb-6 pt-5">
          <h2 id={headId} className="sn-sheet-name pr-12 text-ink">
            Reach bar
          </h2>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-[15px] text-ink">Minimum followers</span>
            <input type="number" name="minReach" min={0} defaultValue={minReach || ''} placeholder="e.g. 500" className={`${FIELD} max-w-[10rem]`} />
          </label>
          <SubmitButton className="button-primary inline-flex w-full items-center justify-center gap-2" pendingLabel="Filtering…">
            <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Set reach bar
          </SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

export function SendOfferButton({
  creatorUserId,
  creatorName,
  sendNeedsPro,
}: {
  creatorUserId: string;
  creatorName: string;
  /** The database's Pro floor on sending — see the page body. */
  sendNeedsPro: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState('');
  const [audience, setAudience] = useState('');
  const headId = useId();
  return (
    <>
      <ActionButton tone="neutral" icon={Send} label="Send offer" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
        <StayForm door="svCreators.sendCreatorOffer" action={sendCreatorOffer} onSaved={() => setOpen(false)} className="flex flex-col gap-2.5 px-5 pb-6 pt-5">
          <div>
            <h2 id={headId} className="sn-sheet-name pr-12 text-ink">
              Send a discount offer
            </h2>
            <p className="text-[14px] text-[color:var(--m-slate-2)]">To {creatorName}</p>
          </div>
          <input type="hidden" name="creator_user_id" value={creatorUserId} />
          <TypedRow
            name="Creator rate (their own booking)"
            value={rate}
            empty="e.g. 20% off any package for you"
            boxed
            required
            maxLength={280}
            fieldName="creator_rate_terms"
            onType={setRate}
            onKeep={(t) => setRate(t)}
            data="creator-rate"
          />
          {/* LIVE as of PR-C: the Book CTA on chapters that credit you shows these terms to viewers, and quoting an
              attributed inquiry pre-labels the discount line "Viewer promo". */}
          <TypedRow
            name="Audience rate (your viewers)"
            about={{
              title: 'Audience rate (your viewers)',
              words: 'Optional. Viewer promo — shown at the Book CTA on chapters that credit you; anyone booking through the chapter sees these terms.',
            }}
            value={audience}
            empty="e.g. 10% off for anyone booking through your chapter"
            boxed
            maxLength={280}
            fieldName="audience_rate_terms"
            onType={setAudience}
            onKeep={(t) => setAudience(t)}
            data="creator-audience-rate"
          />
          <InfoTip label="Free to send; it expires if they don’t reply within 14 days." labelClassName="text-[14px] text-[color:var(--m-slate-2)]" align="start">
            Free to send; the offer expires if they don&rsquo;t reply within 14 days. Discounts settle off-platform —
            Setnayan never touches the money.
          </InfoTip>
          {sendNeedsPro ? (
            <p className="inline-flex items-center gap-1.5 text-[14px] text-[color:var(--m-slate-2)]">
              <PaidMark state="try" label="Part of Pro — draft it here; Send asks for Pro" size="xs" />
              Sending an offer is part of Pro. Draft it here — Send asks for the plan.
            </p>
          ) : null}
          <SubmitButton className="button-primary inline-flex w-full items-center justify-center gap-2" pendingLabel="Sending…">
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Send offer
          </SubmitButton>
        </StayForm>
      </Sheet>
    </>
  );
}
