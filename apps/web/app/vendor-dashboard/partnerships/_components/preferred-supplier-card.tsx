'use client';

import { useId, useState } from 'react';
import { Search, Send, UserPlus, QrCode } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { QrCard } from '@/app/_components/qr-card';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import {
  ADD_PREFERRED_LINE,
  ADD_PREFERRED_TITLE,
  ADD_SHEET_NOTE,
  ADD_SHEET_TITLE,
  INVITE_INFO,
  INVITE_QR_LINE,
  INVITE_SHARE_NOTE,
  INVITE_SHEET_TITLE,
} from '@/lib/supplier-invite';
import { proposePartnership } from '../actions';

/**
 * 🤝 ADD A PREFERRED SUPPLIER — the card at the top of Shop › Partnerships (Invite a supplier v3, owner 16 Nov 2026;
 * specs cb1affde frames 1 · 2 · 4). Two presses:
 *
 *   · Add    → "Add a shop": search Setnayan shops, tap Add. That is the SHIPPED propose → accept (`proposePartnership`
 *              with origin `added`, served-together check lifted): on the adder's own Trusted by at once, on the other
 *              shop's only after it taps Accept in its shipped Incoming requests.
 *   · Invite → "Invite a supplier": the same QR card and phone share as every Setnayan code (`QrCard`) — one link per
 *              shop, it never runs out.
 *
 * The search is a plain GET (`?add=1&q=`): the page reads the shops and hands them here, and a visit that carries a
 * search opens the Add sheet on arrival.
 */
export type AddableShop = {
  vendorProfileId: string;
  name: string;
  line: string;
  /** 'sent' = a pending add of yours · 'partner' = already partners · null = can be added. */
  state: 'sent' | 'partner' | null;
};

export function PreferredSupplierCard({
  shopName,
  invite,
  joinedLine,
  query,
  results,
  openAdd,
}: {
  shopName: string;
  /** The shop's invite link and its code — null when the shop has no address yet (no slug). */
  invite: { url: string; svg: string | null; label: string } | null;
  /** "2 joined through your link" — null hides it. */
  joinedLine: string | null;
  query: string;
  /** null = nothing searched yet; 'unreadable' = the search was refused. */
  results: AddableShop[] | 'unreadable' | null;
  openAdd: boolean;
}) {
  const [open, setOpen] = useState<'add' | 'invite' | null>(openAdd ? 'add' : null);
  const addId = useId();
  const inviteId = useId();

  return (
    <section className="m-card mb-8 p-4 sm:p-5" data-preferred-supplier="">
      <div className="flex items-start gap-3">
        <UserPlus aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-mulberry" strokeWidth={1.9} />
        <div className="min-w-0 flex-1">
          <InfoTip label={ADD_PREFERRED_TITLE} labelAs="h2" labelClassName="text-base font-semibold text-ink" align="start">
            {INVITE_INFO}
          </InfoTip>
          <p className="mt-1 text-sm text-ink/60">{ADD_PREFERRED_LINE}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton tone="brand" main icon={UserPlus} label="Add" onClick={() => setOpen('add')} />
        {invite ? <ActionButton tone="brand" icon={QrCode} label="Invite" onClick={() => setOpen('invite')} /> : null}
      </div>
      {joinedLine ? (
        <p className="mt-3 text-xs text-ink/55" data-joined-through-link="">
          {joinedLine}
        </p>
      ) : null}

      <Sheet open={open === 'add'} onClose={() => setOpen(null)} labelledById={addId} title={ADD_SHEET_TITLE}>
        <h2 id={addId} className="sr-only">
          {ADD_SHEET_TITLE}
        </h2>
        <form method="get" action="/vendor-dashboard/partnerships" className="flex gap-2" role="search">
          <input type="hidden" name="add" value="1" />
          <label className="sr-only" htmlFor={`${addId}-q`}>
            Search Setnayan shops
          </label>
          <input
            // field-ok: a plain search box inside the Add sheet, posted as GET like the marketplace search
            id={`${addId}-q`}
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search Setnayan shops"
            className="input-field min-w-0 flex-1"
            autoComplete="off"
          />
          <button type="submit" className="button-secondary inline-flex items-center gap-1.5" aria-label="Search">
            <Search aria-hidden className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </form>

        {results === 'unreadable' ? (
          <p role="alert" className="mt-4 text-sm text-ink/70">
            We couldn&rsquo;t search the shops just now. Try again in a moment.
          </p>
        ) : results && results.length === 0 ? (
          <p className="mt-4 text-sm text-ink/55">No Setnayan shop matches &ldquo;{query}&rdquo;. Invite them instead.</p>
        ) : results ? (
          <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10" data-add-results="">
            {results.map((r) => (
              <li key={r.vendorProfileId} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white font-mono text-[13px] font-bold text-ink/70"
                >
                  {r.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{r.name}</p>
                  {r.line ? <p className="text-xs text-ink/55">{r.line}</p> : null}
                </div>
                {r.state === 'sent' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink/55">
                    <Send aria-hidden className="h-3.5 w-3.5" /> Sent
                  </span>
                ) : r.state === 'partner' ? (
                  <span className="text-xs font-semibold text-success-700">Partners</span>
                ) : (
                  <StayForm door="svPartnerships.proposePartnership" action={proposePartnership}>
                    <input type="hidden" name="recommended_vendor_id" value={r.vendorProfileId} />
                    <input type="hidden" name="origin" value="added" />
                    <SubmitButton pendingLabel="Adding…" className="button-primary px-3 py-1.5 text-xs">
                      Add
                    </SubmitButton>
                  </StayForm>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-xs text-ink/55">{ADD_SHEET_NOTE}</p>
      </Sheet>

      {invite ? (
        <Sheet open={open === 'invite'} onClose={() => setOpen(null)} labelledById={inviteId} title={INVITE_SHEET_TITLE}>
          <h2 id={inviteId} className="sr-only">
            {INVITE_SHEET_TITLE}
          </h2>
          <QrCard
            svg={invite.svg}
            url={invite.url}
            title={shopName}
            line={INVITE_QR_LINE}
            filename={`${shopName.replace(/[^\w-]+/g, '-').toLowerCase() || 'setnayan'}-invite-a-supplier`}
            data="invite-a-supplier"
            note={
              <>
                <p className="font-mono text-xs text-ink/60">{invite.label}</p>
                <p className="mt-2 text-xs text-ink/55">{INVITE_SHARE_NOTE}</p>
              </>
            }
          />
        </Sheet>
      ) : null}
    </section>
  );
}
