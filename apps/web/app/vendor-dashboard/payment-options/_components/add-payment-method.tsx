'use client';

/**
 * AddPaymentMethod — the "Add a payment option" affordance on the vendor
 * "How clients pay you" surface.
 *
 * Collapsed it's a single button; expanded it's a <form action={addPaymentMethod}>
 * with ONE type dropdown (Bank/e-wallet · QR code · Payment link — PickMenu, design template rule 4). The picked
 * type drives a hidden `method_type` input + conditional fields:
 *   • bank → provider PickMenu over PAYMENT_PROVIDERS (a hidden `provider` input) + account name + account number
 *   • qr   → <FileUpload> (emits an r2:// ref into hidden `qr_r2_key`) + a
 *            "where it sends money" decoded-destination input
 *   • link → a url input for EVERY plan (try-first, 2026-09-30). Whether a
 *            plan is asked for is decided on the server by
 *            vendorPaywallApplies() and arrives as `linkAsks`: off (the
 *            switch is off, or the shop has Pro) → no mark; on → a ◆ PRO note,
 *            and Save is where the plan is asked. The input has a LIVE
 *            classification hint
 *            (green = allowlisted · amber = unknown domain, publishes after a
 *            quick review · red = shortener/invalid).
 *
 * The server action (../actions.ts) re-validates everything — Pro gate, link
 * classification, required fields — so this is fast-feedback UX, not the
 * security boundary.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Landmark, QrCode, Link2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { PaidMark } from '@/app/_components/paid-mark';
import { routes } from '@/lib/routes';
import {
  PAYMENT_PROVIDERS,
  classifyPaymentLink,
  type PaymentMethodType,
} from '@/lib/vendor-payment-methods';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { addPaymentMethod } from '../actions';
import { StayForm } from '@/app/_components/stay-form';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

type Props = {
  vendorProfileId: string;
  /** Server-decided (vendorPaywallApplies): saving a link asks for Pro. */
  linkAsks: boolean;
  /** Mounted in Customers ⚙ — the save comes back there, sheet open (`return_to=customers`). */
  returnTo?: { to: 'customers'; seg: string } | null;
};

const TYPE_TILES: ReadonlyArray<{
  key: PaymentMethodType;
  label: string;
  hint: string;
  icon: typeof Landmark;
}> = [
  { key: 'bank', label: 'Bank / e-wallet', hint: 'Account number or mobile', icon: Landmark },
  { key: 'qr', label: 'QR code', hint: 'Upload your scan-to-pay image', icon: QrCode },
  { key: 'link', label: 'Payment link', hint: 'Maya, PayPal, Stripe…', icon: Link2 },
];

export function AddPaymentMethod({ vendorProfileId, linkAsks, returnTo = null }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PaymentMethodType>('bank');
  const [linkDraft, setLinkDraft] = useState('');
  const [provider, setProvider] = useState<string>('BDO');

  if (!open) {
    return (
      <ActionButton tone="brand" icon={Plus} label="Add a payment option" onClick={() => setOpen(true)} />
    );
  }

  // Live link classification — only meaningful for Pro vendors on the link tile.
  const cls = type === 'link' && linkDraft.trim().length > 0 ? classifyPaymentLink(linkDraft) : null;

  return (
    <StayForm
      door="supPayments.addPaymentMethod"
      action={addPaymentMethod}
      onSaved={() => setOpen(false)}
      className="space-y-5 border-t border-[color:var(--m-line)] pt-4"
    >
      {returnTo ? (
        <>
          <input type="hidden" name="return_to" value={returnTo.to} />
          <input type="hidden" name="return_seg" value={returnTo.seg} />
        </>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-[17px] font-semibold text-ink">Add a payment option</h3>
          <p className="text-[13px] text-[color:var(--m-slate-2)]">
            Couples pay you directly with whatever you add here. Setnayan never holds the money.
          </p>
        </div>
        <ActionButton tone="neutral" iconOnly icon={X} label="Cancel" onClick={() => setOpen(false)} />
      </div>

      {/* Hidden input the server action reads to branch on type. */}
      <input type="hidden" name="method_type" value={type} />

      {/* The type — ONE dropdown (design template rule 4, "picks ▾"); each kind keeps its line as the option's hint. */}
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[color:var(--m-line)]">
        <span className="text-[15px] font-medium text-ink">What kind of payment option?</span>
        <PickMenu
          label="Payment option type"
          value={type}
          compact
          dataAttr="data-payment-type"
          options={TYPE_TILES.map((t) => ({ key: t.key, label: t.label, hint: t.hint }))}
          onPick={(k) => setType(k as PaymentMethodType)}
        />
      </div>

      {/* Conditional fields. */}
      {type === 'bank' ? (
        <div className="space-y-4">
          <div className="block space-y-1">
            <span className="block text-sm font-medium text-ink">Provider</span>
            <input type="hidden" name="provider" value={provider} />
            <PickMenu
              label="Provider"
              value={provider}
              dataAttr="data-provider"
              options={PAYMENT_PROVIDERS.map((p) => ({ key: p, label: p }))}
              onPick={setProvider}
            />
          </div>
          <label htmlFor="account_name" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">Account name</span>
            <input
              autoComplete="name"
              id="account_name"
              name="account_name"
              maxLength={96}
              placeholder="Juan Dela Cruz"
              className="input-field"
            />
          </label>
          <label htmlFor="account_number" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">
              Account number / mobile
              <span className="ml-1 text-terracotta-700">*</span>
            </span>
            <input
              id="account_number"
              name="account_number"
              required
              maxLength={64}
              inputMode="numeric"
              placeholder="0917 000 0000  ·  1234 5678 90"
              className="input-field tabular-nums"
            />
            <span className="block text-[13px] text-[color:var(--m-slate-2)]">
              Shown to your clients so they can pay you. Double-check it&rsquo;s correct.
            </span>
          </label>
        </div>
      ) : null}

      {type === 'qr' ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="block text-sm font-medium text-ink">
              QR image
              <span className="ml-1 text-terracotta-700">*</span>
            </span>
            <FileUpload
              bucket="thread-files"
              pathPrefix={`vendor-payment-qr/${vendorProfileId}`}
              name="qr_r2_key"
              unsavedHint="press Save payment option below"
              maxSizeMB={2}
              acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
              label="Upload your QR"
            />
          </div>
          <label htmlFor="decoded_destination" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">
              Where it sends money <span className="text-[color:var(--m-slate-2)]">(optional)</span>
            </span>
            <input
              id="decoded_destination"
              name="decoded_destination"
              maxLength={256}
              placeholder="GCash · 0917…"
              className="input-field"
            />
            <span className="block text-[13px] text-[color:var(--m-slate-2)]">
              We read your QR automatically and show clients where it pays. Add a note here only as
              a fallback in case the image can&rsquo;t be read.
            </span>
          </label>
        </div>
      ) : null}

      {type === 'link' ? (
        <div className="space-y-2">
          {linkAsks ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[color:var(--m-slate-2)]">
              <PaidMark
                state="try"
                label="Part of Supplier Pro — fill it in here; saving asks for Supplier Pro"
                size="xs"
              />
              <span>
                Payment links are part of Supplier Pro and Supplier Ultra. Fill it in here — saving asks for the
                plan. Bank, e-wallet, and QR are free on every plan.
              </span>
              <Link
                href={routes.vendorDashboard.subscription()}
                className="font-medium text-mulberry hover:underline"
              >
                See plans
              </Link>
            </p>
          ) : null}
          <label htmlFor="link_url" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">
              Payment link
              <span className="ml-1 text-terracotta-700">*</span>
            </span>
            <input
              id="link_url"
              name="link_url"
              type="url"
              inputMode="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              maxLength={512}
              placeholder="https://maya.me/yourbusiness"
              className="input-field"
            />
            {cls ? (
              cls.shortener || !cls.ok ? (
                <span className="flex items-start gap-1.5 text-[13px] text-terracotta-700">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>{cls.reason}</span>
                </span>
              ) : cls.allowlisted ? (
                <span className="flex items-start gap-1.5 text-[13px] text-success-700">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>
                    {cls.domain} is recognised — this shows to clients right away.
                  </span>
                </span>
              ) : (
                <span className="flex items-start gap-1.5 text-[13px] text-warn-700">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>{cls.reason}</span>
                </span>
              )
            ) : (
              <span className="block text-[13px] text-[color:var(--m-slate-2)]">
                Paste your provider&rsquo;s real checkout link. Recognised providers publish
                instantly; anything else publishes after a quick review.
              </span>
            )}
          </label>
        </div>
      ) : null}

      {/* Common optional fields. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor="label" className="block space-y-1">
          <span className="block text-sm font-medium text-ink">Label (optional)</span>
          <input
            id="label"
            name="label"
            maxLength={80}
            placeholder="Main account"
            className="input-field"
          />
        </label>
        <label htmlFor="note" className="block space-y-1">
          <span className="block text-sm font-medium text-ink">Note for clients (optional)</span>
          <input
            id="note"
            name="note"
            maxLength={200}
            placeholder="Send the screenshot after paying"
            className="input-field"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" onClick={() => setOpen(false)} className="button-secondary">
          Cancel
        </button>
        <SubmitButton className="button-primary" pendingLabel="Saving…">
          Save payment option
        </SubmitButton>
      </div>
    </StayForm>
  );
}
