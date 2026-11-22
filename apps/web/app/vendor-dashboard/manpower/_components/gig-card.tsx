'use client';

import { useState, useTransition } from 'react';
import { Clock, HandCoins, Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import {
  acceptManpowerGig,
  completeGig,
  cancelGig,
  type ManpowerGigRow,
} from '../actions';
import { useSaveLoader } from '@/components/sd-loader';
import { ToolChip, ToolLead, ToolRow, type ToolChipTone } from '../../_components/tool-page';

/**
 * V2 Phase F · GigCard
 *
 * Renders a single manpower gig in one of three modes:
 *   - open      → vendor can accept (free · token retirement 2026-07-22)
 *   - accepted  → vendor can mark complete or cancel
 *   - wrapped   → read-only display
 *
 * The rows are the redraw's (v3 § 11, 21 Nov 2026): an open gig is ONE row with Accept gig at its right end; an accepted
 * gig opens in place (the shared `Fold`) to Mark wrapped · Cancel gig; a wrapped gig is one read-only row. Each mode
 * returns its own `<li>` — the view's `<ul>` is their list.
 *
 * Accepting a gig is free — there is no wallet gate. Per
 * [[feedback_setnayan_no_dev_text_post_launch]] copy is brand-voice editorial
 * register. No engineering jargon · no "ERROR" strings.
 */

type Mode = 'open' | 'accepted' | 'wrapped';

function formatPhp(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-PH', {
      // 🕐 Manila, not the server's UTC (walk 13 Nov 2026, F-W1-61) — the same wall clock on the server and the phone.
      timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function GigCard({
  gig,
  mode,
  statusLabel,
  statusTone,
}: {
  gig: ManpowerGigRow;
  mode: Mode;
  statusLabel: string;
  statusTone: ToolChipTone;
}) {
  const [banner, setBanner] = useState<
    | { kind: 'success'; msg: string }
    | { kind: 'error'; msg: string }
    | { kind: 'cancel-form' }
    | null
  >(null);
  const [cancelReason, setCancelReason] = useState('');
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  function handleAccept() {
    setBanner(null);
    startTransition(async () => {
      const result = await save.run(() => acceptManpowerGig(gig.gig_id), {
        steps: ['Accepting the gig'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setBanner({
          kind: 'success',
          msg: 'Gig accepted. The host will be notified.',
        });
      } else if (result.status === 'already_claimed') {
        setBanner({
          kind: 'error',
          msg: 'Another supplier already claimed this gig.',
        });
      } else if (result.status === 'race_lost') {
        setBanner({
          kind: 'error',
          msg: 'Another supplier claimed this gig at the same moment. Try another open gig.',
        });
      } else if (result.status === 'no_vendor_profile') {
        setBanner({
          kind: 'error',
          msg: 'Finish supplier verification before claiming gigs.',
        });
      } else {
        setBanner({
          kind: 'error',
          msg: 'message' in result ? result.message : 'Could not accept this gig.',
        });
      }
    });
  }

  function handleComplete() {
    setBanner(null);
    startTransition(async () => {
      const result = await save.run(() => completeGig(gig.gig_id), {
        steps: ['Marking complete'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setBanner({ kind: 'success', msg: 'Marked as wrapped.' });
      } else {
        setBanner({
          kind: 'error',
          msg: 'message' in result ? result.message : 'Could not mark complete.',
        });
      }
    });
  }

  function handleCancel() {
    setBanner(null);
    if (cancelReason.trim().length < 4) {
      setBanner({ kind: 'error', msg: 'Add a short cancellation reason.' });
      return;
    }
    startTransition(async () => {
      const result = await save.run(() => cancelGig(gig.gig_id, cancelReason.trim()), {
        steps: ['Cancelling the gig'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setBanner({ kind: 'success', msg: 'Cancelled.' });
      } else {
        setBanner({
          kind: 'error',
          msg: 'message' in result ? result.message : 'Could not cancel.',
        });
      }
    });
  }

  const money = formatPhp(gig.cash_amount_php_centavos);
  const said =
    banner && 'msg' in banner ? (
      <p
        role={banner.kind === 'error' ? 'alert' : 'status'}
        className="text-[14px] font-semibold"
        style={{ color: banner.kind === 'error' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-ok))' }}
      >
        {banner.msg}
      </p>
    ) : null;
  const notes = gig.notes ? <span className="whitespace-pre-line">{gig.notes}</span> : null;

  // Open — the drawing's row: a round mark, the gig, its cash line, and the ONE main button at its right end.
  if (mode === 'open') {
    return (
      <>
        <ToolRow
          data="gig-open"
          lead={
            <ToolLead>
              <Clock aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </ToolLead>
          }
          title={gig.gig_label}
          lines={[`${money} · paid to your crew direct`, notes]}
          right={
            <ActionButton
              tone="brand"
              main
              icon={HandCoins}
              label={pending ? 'Accepting…' : 'Accept gig'}
              waiting={pending}
              onClick={handleAccept}
            />
          }
        />
        {said ? <li className="pb-2.5">{said}</li> : null}
      </>
    );
  }

  // Wrapped — read-only: the gig, ONE line (its cash · when it wrapped, or why it was cancelled), its state at the right.
  if (mode === 'wrapped') {
    const how = gig.cancellation_reason
      ? `Cancellation reason: ${gig.cancellation_reason}`
      : gig.completed_at
        ? `Wrapped ${formatRelative(gig.completed_at) ?? ''}`
        : 'paid to your crew direct';
    return (
      <ToolRow
        data="gig-wrapped"
        title={gig.gig_label}
        lines={[`${money} · ${how}`, notes]}
        right={<ToolChip tone={statusTone}>{statusLabel}</ToolChip>}
      />
    );
  }

  // Accepted — the row opens in place (the shared `Fold`, one open at a time): Mark wrapped · Cancel gig inside it.
  return (
    <li data-tool-row="gig-accepted">
      <Fold
        title={gig.gig_label}
        wrap
        lineWrap
        line={`${money} · paid to your crew direct`}
        aside={<ToolChip tone={statusTone}>{statusLabel}</ToolChip>}
        between={
          <span className={`-mt-1 flex flex-col gap-0.5 pb-2 ${TEMPLATE_SUBLINE}`}>
            <span>Accepted {formatRelative(gig.accepted_at) ?? '—'}</span>
            {notes}
          </span>
        }
        data="gig"
      >
        <div className="flex flex-col gap-2.5 pb-4 pt-1">
          {said}
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              tone="ok"
              icon={Check}
              label={pending ? 'Wrapping…' : 'Mark wrapped'}
              waiting={pending}
              onClick={handleComplete}
            />

            {banner?.kind === 'cancel-form' ? (
              <div className="flex w-full flex-wrap items-end gap-2 rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-3">
                <label className="min-w-[180px] flex-1">
                  <span className={`mb-1 block ${TEMPLATE_SUBLINE}`}>Reason</span>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Why are you cancelling?"
                    minLength={4}
                    maxLength={500}
                    className="min-h-11 w-full rounded-[var(--m-r-md)] border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink placeholder:text-[color:var(--m-slate-2)] focus:border-mulberry focus:outline-none" // no-card-ok: the reason input's own outline
                  />
                </label>
                <ActionButton
                  tone="danger"
                  icon={X}
                  label={pending ? 'Cancelling…' : 'Confirm cancel'}
                  waiting={pending}
                  onClick={handleCancel}
                />
                <ActionButton
                  tone="neutral"
                  quiet
                  iconOnly
                  icon={X}
                  label="Close cancel form"
                  onClick={() => {
                    setBanner(null);
                    setCancelReason('');
                  }}
                />
              </div>
            ) : (
              <ActionButton
                tone="danger"
                icon={X}
                label="Cancel gig"
                onClick={() => setBanner({ kind: 'cancel-form' })}
              />
            )}
          </div>
        </div>
      </Fold>
    </li>
  );
}
