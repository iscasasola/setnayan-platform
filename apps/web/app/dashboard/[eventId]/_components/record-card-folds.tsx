'use client';

/**
 * record-card-folds — THE GROUPS OF THE COUPLE'S SUPPLIER RECORD CARD (Booked prototype v4, owner-approved 2026-10-29).
 *
 * Drawn by `NewManualVendorModal` in edit mode, inside its ONE form, under its ONE Save — the same Form rows, picker,
 * address field and plan rows the add sheet uses, laid out as the guest card's folds. Kept in its own file so the
 * modal's add path and this edit path never draw a field twice in one file (one writer per fact).
 */

import { FormRows, TypedRow } from '@/app/_components/form-row';
import { Fold } from '@/app/_components/fold';
import { formatPhp } from '@/lib/php';
import type { CoverCatalogFolder } from '@/lib/shortlist-taxonomy';
import type { SelfAddedSupplierPrefill } from '../vendors/actions';
import { AddressPinField } from './address-pin-field';
import { ServicesCoveredPicker } from './services-covered-picker';
import { PaymentPlanRows } from './payment-plan-rows';
import { PayWaysEditor } from './pay-ways-editor';

/** A Form row's keep: the sheet's own Save sends the form, so keeping has nothing to write. */
const KEEP = () => ({ ok: true as const });

/** The one line each closed fold of the record card shows — read from the form, so it is what Save will post. */
export type RecordLines = { contact: string | null; price: string | null; place: string | null; services: string };

export function recordLines(edit: SelfAddedSupplierPrefill | undefined, categoryLabel: string, fd: FormData | null): RecordLines {
  if (!edit) return { contact: null, price: null, place: null, services: categoryLabel };
  const get = (k: string, fallback: string) => (fd && fd.has(k) ? String(fd.get(k) ?? '') : fallback).trim();
  const contact = [get('contact_person', edit.contactPerson), get('contact_number', edit.contactNumber)].filter(Boolean).join(' · ');
  const priceN = Number(get('total_cost_php', edit.price).replace(/[^\d.]/g, ''));
  const inc = get('inclusions', edit.inclusions)
    .split('\n')
    .filter((x) => x.trim()).length;
  const price =
    Number.isFinite(priceN) && priceN > 0
      ? `${formatPhp(priceN)}${inc ? ` · ${inc} inclusion${inc === 1 ? '' : 's'}` : ''}`
      : null;
  const addr = get('address', edit.address);
  const tail = addr.split(',').slice(-2).join(',').replace(/^,?\s*/, '').trim();
  const covers = fd ? fd.getAll('covers').length : edit.covers.length;
  return {
    contact: contact || null,
    price,
    place: addr ? tail || addr : null,
    services: covers ? `${categoryLabel} + ${covers} more` : categoryLabel,
  };
}

/** Today in the browser, as YYYY-MM-DD — only the fallback for a prefill that carried no plan dates. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * THE RECORD CARD'S GROUPS (Booked prototype v4, owner-approved 2026-10-29 — "a cleaner redesign for it like a guest
 * card"): the guest card's folds — title at the left, the one-line summary at the right, one open at a time — over
 * EVERY field and control the record sheet had. Contact · Price (+ Inclusions) · Payment plan · How to pay them ·
 * Place · Services. Every field still posts into the ONE form the ONE Save sends (`updateSelfAddedSupplier`); a shut
 * fold keeps its fields mounted (`Fold`), so nothing is lost by not opening it.
 */
export function RecordCardFolds({
  eventId,
  edit,
  category,
  categoryLabel,
  coverCatalog,
  addressRequired,
  pending,
  nameKept,
  priceKept,
  priceNumber,
  lines,
  planLine,
  payLine,
  onPlanLine,
  onPayLine,
  onName,
  onNameKeep,
  onPriceType,
  onPriceKeep,
  onMoved,
}: {
  eventId: string;
  edit: SelfAddedSupplierPrefill;
  category: string;
  categoryLabel: string;
  coverCatalog?: readonly CoverCatalogFolder[];
  addressRequired: boolean;
  pending: boolean;
  nameKept: string;
  priceKept: string;
  priceNumber: number | null;
  lines: RecordLines;
  planLine: { text: string; warn: boolean } | null;
  payLine: string | null;
  onPlanLine: (text: string, warn: boolean) => void;
  onPayLine: (line: string | null) => void;
  onName: (t: string) => void;
  onNameKeep: (t: string) => void;
  onPriceType: (t: string) => void;
  onPriceKeep: (t: string) => void;
  onMoved: () => void;
}) {
  const row = (last = false) => `px-0.5 ${last ? '' : 'border-b border-ink/10'}`;
  const keptTotal = Number(priceKept.replace(/,/g, ''));
  return (
    <div data-record-card-folds="" className="border-t border-ink/10">
      <Fold title="Contact" summary={lines.contact ?? 'Add who to call'} summaryEnd defaultOpen className={row()} data="record-contact">
        <FormRows width="wide" data="add-manual-contact">
          <TypedRow
            name="Supplier name"
            fieldName="business_name"
            value={nameKept}
            empty="Their name"
            placeholder="e.g. Tito Marcel"
            required
            maxLength={128}
            autoCapitalize="words"
            attrs={{ 'data-manual-field': 'business_name' }}
            onType={onName}
            onKeep={(t) => {
              onNameKeep(t);
              return { ok: true as const };
            }}
          />
          <TypedRow
            name="Contact person"
            fieldName="contact_person"
            value={edit.contactPerson}
            placeholder="e.g. Marcel Santos"
            maxLength={128}
            autoCapitalize="words"
            about={{ words: 'Who to call · usually the same as Supplier name.' }}
            attrs={{ 'data-manual-field': 'contact_person' }}
            onKeep={KEEP}
          />
          <TypedRow
            name="Contact number"
            fieldName="contact_number"
            value={edit.contactNumber}
            placeholder="+63 9XX XXX XXXX"
            maxLength={32}
            inputMode="tel"
            about={{ words: 'Mobile preferred · e.g. +63 917 555 1234' }}
            attrs={{ 'data-manual-field': 'contact_number' }}
            onKeep={KEEP}
          />
        </FormRows>
      </Fold>

      <Fold title="Price" summary={lines.price ?? 'Set the price'} summaryEnd className={row()} data="record-price">
        <FormRows width="wide" data="add-manual-terms">
          <TypedRow
            name="Price"
            fieldName="total_cost_php"
            value={priceKept}
            amount
            placeholder="80000"
            about={{ words: 'What you agreed, in pesos. The payment plan has to add up to it — change it and the unpaid payments re-split to match.' }}
            attrs={{ 'data-manual-field': 'total_cost_php' }}
            onType={onPriceType}
            onKeep={(t) => {
              onPriceKeep(t);
              return { ok: true as const };
            }}
          />
          <TypedRow
            name="Inclusions"
            fieldName="inclusions"
            value={edit.inclusions}
            long
            maxLength={2000}
            placeholder={'e.g.\nBallroom, 6am–12mn\nTables and chairs'}
            about={{ words: 'One per line — what the price covers.' }}
            attrs={{ 'data-manual-field': 'inclusions' }}
            onKeep={KEEP}
          />
        </FormRows>
      </Fold>

      <Fold
        title="Payment plan"
        summary={planLine?.text ?? 'No payments yet'}
        summaryEnd
        className={row()}
        data="record-plan"
        popovers
      >
        <div className="pb-3">
          <PaymentPlanRows
            totalPhp={priceNumber}
            disabled={pending}
            // A SAVED plan re-opens exactly as saved — even one saved with no payments; only a supplier with no plan
            // yet gets the starter.
            initial={edit.planRows.length > 0 || edit.planSaved ? edit.planRows : undefined}
            dated={{
              dates: edit.planDates ?? { lockIso: todayIso(), eventIso: null },
              seqs: edit.planSeqs,
              settledSeqs: edit.settledSeqs,
              keptTotalPhp: Number.isFinite(keptTotal) && keptTotal > 0 ? keptTotal : null,
              lastReplot: edit.lastReplot ?? null,
              onLine: onPlanLine,
            }}
          />
        </div>
      </Fold>

      <Fold
        title="How to pay them"
        summary={payLine ?? 'Not added yet'}
        summaryEnd
        className={row()}
        data="record-pay"
        tip="Where you send the money — a photo of their QR, the account details, or both — so you are not digging through messages on the day. Setnayan does not send or track it; nothing here creates a payment."
        popovers
      >
        <div className="pb-3">
          <PayWaysEditor eventId={eventId} initial={edit.payWays === undefined ? [] : edit.payWays} disabled={pending} onSummary={onPayLine} />
        </div>
      </Fold>

      <Fold title="Place" summary={lines.place ?? 'Add their address'} summaryEnd className={row()} data="record-place">
        <div className="pb-3">
          <AddressPinField required={addressRequired} disabled={pending} initialAddress={edit.address} initialPin={edit.pin ?? null} />
        </div>
      </Fold>

      <Fold
        title="Services"
        summary={lines.services}
        summaryEnd
        className={row(true)}
        data="record-services"
        tip={`${categoryLabel} is the category you added them under. Tick any other service their price covers — one booking, one price, counted once across all of them.`}
        popovers
      >
        <div className="pb-3">
          <ServicesCoveredPicker
            eventId={eventId}
            category={category}
            homeTile={edit.homeTile}
            ownLabel={categoryLabel}
            catalog={coverCatalog}
            initialSelected={edit.covers}
            disabled={pending}
            move={{ vendorId: edit.vendorId, name: edit.name.trim() || 'This supplier', claimAsk: edit.claimAsk }}
            onMoved={onMoved}
          />
        </div>
      </Fold>
    </div>
  );
}

