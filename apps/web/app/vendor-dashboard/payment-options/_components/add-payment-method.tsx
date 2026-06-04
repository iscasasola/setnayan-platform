'use client';

/**
 * AddPaymentMethod — the "Add a payment option" affordance on the vendor
 * "How clients pay you" surface.
 *
 * Collapsed it's a single button; expanded it's a <form action={addPaymentMethod}>
 * with a 3-tile type picker (Bank/e-wallet · QR code · Payment link). The picked
 * type drives a hidden `method_type` input + conditional fields:
 *   • bank → provider <select> over PAYMENT_PROVIDERS + account name + account number
 *   • qr   → <FileUpload> (emits an r2:// ref into hidden `qr_r2_key`) + a
 *            "where it sends money" decoded-destination input
 *   • link → Pro/Enterprise gated. Non-Pro vendors see a locked upsell tile and
 *            NO url input (so the action can never receive a link from them).
 *            Pro vendors get a url input with a LIVE classification hint
 *            (green = allowlisted · amber = unknown domain, publishes after a
 *            quick review · red = shortener/invalid).
 *
 * The server action (../actions.ts) re-validates everything — Pro gate, link
 * classification, required fields — so this is fast-feedback UX, not the
 * security boundary.
 */

import { useState } from 'react';
import { Plus, Landmark, QrCode, Link2, Lock, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import {
  PAYMENT_PROVIDERS,
  classifyPaymentLink,
  type PaymentMethodType,
} from '@/lib/vendor-payment-methods';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { addPaymentMethod } from '../actions';

type Props = {
  vendorProfileId: string;
  isPro: boolean;
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

export function AddPaymentMethod({ vendorProfileId, isPro }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PaymentMethodType>('bank');
  const [linkDraft, setLinkDraft] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary w-full sm:w-auto"
      >
        <Plus aria-hidden className="mr-2 h-4 w-4" strokeWidth={2} />
        Add a payment option
      </button>
    );
  }

  // Live link classification — only meaningful for Pro vendors on the link tile.
  const cls = type === 'link' && linkDraft.trim().length > 0 ? classifyPaymentLink(linkDraft) : null;

  return (
    <form
      action={addPaymentMethod}
      className="space-y-5 rounded-2xl border border-ink/10 bg-cream p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-ink">Add a payment option</h3>
          <p className="text-xs text-ink/55">
            Couples pay you directly with whatever you add here. Setnayan never holds the money.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="rounded-md p-1 text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Hidden input the server action reads to branch on type. */}
      <input type="hidden" name="method_type" value={type} />

      {/* 3-tile type picker. */}
      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          What kind of payment option?
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPE_TILES.map((tile) => {
            const active = type === tile.key;
            const Icon = tile.icon;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => setType(tile.key)}
                aria-pressed={active}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-terracotta bg-terracotta/10'
                    : 'border-ink/15 bg-cream hover:border-ink/30'
                }`}
              >
                <Icon
                  aria-hidden
                  className={`h-5 w-5 ${active ? 'text-terracotta-700' : 'text-ink/55'}`}
                  strokeWidth={1.75}
                />
                <span
                  className={`text-sm font-medium ${active ? 'text-terracotta-700' : 'text-ink'}`}
                >
                  {tile.label}
                </span>
                <span className="text-[11px] text-ink/55">{tile.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Conditional fields. */}
      {type === 'bank' ? (
        <div className="space-y-4">
          <label htmlFor="provider" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">Provider</span>
            <select id="provider" name="provider" className="input-field" defaultValue="BDO">
              {PAYMENT_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="account_name" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">Account name</span>
            <input
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
              <span className="ml-1 text-terracotta">*</span>
            </span>
            <input
              id="account_number"
              name="account_number"
              required
              maxLength={64}
              inputMode="numeric"
              placeholder="0917 000 0000  ·  1234 5678 90"
              className="input-field font-mono"
            />
            <span className="block text-xs text-ink/55">
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
              <span className="ml-1 text-terracotta">*</span>
            </span>
            <FileUpload
              bucket="media"
              pathPrefix={`vendors/${vendorProfileId}/payment-qr`}
              name="qr_r2_key"
              maxSizeMB={2}
              acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
              label="Upload your QR"
            />
          </div>
          <label htmlFor="decoded_destination" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">Where it sends money</span>
            <input
              id="decoded_destination"
              name="decoded_destination"
              maxLength={256}
              placeholder="GCash · 0917…"
              className="input-field"
            />
            <span className="block text-xs text-ink/55">
              Where it sends money, e.g. &ldquo;GCash · 0917…&rdquo;. Shown to clients so they can
              verify; our team checks it too.
            </span>
          </label>
        </div>
      ) : null}

      {type === 'link' ? (
        !isPro ? (
          <div className="flex items-start gap-3 rounded-xl border border-ink/15 bg-ink/[0.03] p-4">
            <Lock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/45" strokeWidth={1.75} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">
                Payment links are a Pro &amp; Enterprise feature
              </p>
              <p className="text-xs text-ink/55">
                Upgrade your plan to add Maya, PayPal, or Stripe checkout links. Bank, e-wallet, and
                QR options are free on every plan.
              </p>
            </div>
          </div>
        ) : (
          <label htmlFor="link_url" className="block space-y-1">
            <span className="block text-sm font-medium text-ink">
              Payment link
              <span className="ml-1 text-terracotta">*</span>
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
                <span className="flex items-start gap-1.5 text-xs text-terracotta-700">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>{cls.reason}</span>
                </span>
              ) : cls.allowlisted ? (
                <span className="flex items-start gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>
                    {cls.domain} is recognised — this shows to clients right away.
                  </span>
                </span>
              ) : (
                <span className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>{cls.reason}</span>
                </span>
              )
            ) : (
              <span className="block text-xs text-ink/55">
                Paste your provider&rsquo;s real checkout link. Recognised providers publish
                instantly; anything else publishes after a quick review.
              </span>
            )}
          </label>
        )
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
    </form>
  );
}
