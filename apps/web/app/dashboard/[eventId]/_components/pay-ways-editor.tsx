'use client';

/**
 * PayWaysEditor — "HOW TO PAY THEM" on the record of a supplier the couple added. (2026-10-29 · reworked 2026-11-13)
 *
 * Owner, verbatim: *"also manually add payment method/s"* · *"via QR or text details"* (Booked prototype v4), then
 * (2026-11-13) *"the payment method information. either QR or account type, account name and account number or both"*.
 * Each way is the SUPPLIER'S OWN SHAPE (`vendor_payment_methods`, Your details › How clients pay you): Account type ▾
 * (their `PAYMENT_PROVIDERS` list, the house `PickMenu`) · Account name · Account number / mobile (the house
 * `TypedRow`) · their QR — any of the account or the QR, or both. The ONE Save posts them (`pay_way_method` ·
 * `pay_way_provider` · `pay_way_account_name` · `pay_way_account_number` · `pay_way_qr` · `pay_way_details`, one each
 * per way, in order, plus `pay_ways_present`): the add sheet through `addManualSupplier`, the record card through
 * `updateSelfAddedSupplier` → `saveSelfAddedServiceCard`.
 *
 * 📷 The QR uploads like every other private picture (`FileUpload`, compressed on the phone) into the event's own
 * PRIVATE payment folder — a QR Ph code encodes the account, so the picture is the identifier.
 *
 * 🔒 Inert: words and a picture for the couple to read on the day. Nothing here creates a payment.
 *
 * ⚖ A REFUSED READ IS SAID, AND NOTHING IS POSTED (`initial === null`): with no `pay_ways_present` the save leaves
 * the stored ways exactly as they are — never an empty editor that a Save would write over real ways with.
 */

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FileUpload } from '@/app/_components/file-upload';
import { FORM_PICK_CLASS, FormRow, FormRows, TypedRow, usePillWidth } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  PAY_WAYS_MAX,
  PAY_WAYS_PRESENT_FIELD,
  PAY_WAY_ACCOUNT_NAME_MAX,
  PAY_WAY_ACCOUNT_NUMBER_MAX,
  PAY_WAY_PROVIDERS,
  methodForProvider,
  payWayQrPrefix,
  payWaysSummary,
  type PayWayView,
} from '@/lib/self-added-pay-ways';

type Way = {
  key: number;
  provider: string;
  accountName: string;
  accountNumber: string;
  /** A way saved before the account fields — kept as it was, never shown as a box to type in. */
  details: string;
  qr: string | null;
  qrUrl: string | null;
};

const PROVIDER_OPTIONS = PAY_WAY_PROVIDERS.map((p) => ({ key: p, label: p }));
const FIRST_PROVIDER = 'GCash';

export function PayWaysEditor({
  eventId,
  initial,
  disabled,
  onSummary,
  startWithOne = false,
}: {
  eventId: string;
  /** The stored ways; `null` = the read was refused. */
  initial: ReadonlyArray<PayWayView> | null;
  disabled?: boolean;
  /** The closed fold's one line follows what is here. */
  onSummary?: (line: string | null) => void;
  /** The add sheet opens on one empty way, so the rows are in view (a way left empty is no way). */
  startWithOne?: boolean;
}) {
  const blank = (key: number): Way => ({ key, provider: FIRST_PROVIDER, accountName: '', accountNumber: '', details: '', qr: null, qrUrl: null });
  const [ways, setWays] = useState<Way[]>(() => {
    const kept = (initial ?? []).map((w, i) => ({
      key: i,
      provider: w.provider ?? FIRST_PROVIDER,
      accountName: w.account_name ?? '',
      accountNumber: w.account_number ?? '',
      details: w.details ?? '',
      qr: w.qr,
      qrUrl: w.qrUrl,
    }));
    return kept.length === 0 && startWithOne ? [blank(0)] : kept;
  });
  const [nextKey, setNextKey] = useState(ways.length);
  useEffect(() => {
    const filled = ways.filter((w) => w.accountNumber.trim() || w.qr || w.details.trim());
    onSummary?.(payWaysSummary(filled.map((w) => ({ method: methodForProvider(w.accountNumber ? w.provider : null, !!w.qr), provider: w.accountNumber ? w.provider : null }))));
  }, [ways, onSummary]);

  if (initial === null) {
    return (
      <p role="alert" data-pay-ways-unreadable="" className="text-[12.5px] text-danger-800">
        We couldn&apos;t load how to pay them just now — close this and open it again. Saving leaves them as they are.
      </p>
    );
  }

  function patch(key: number, p: Partial<Way>) {
    setWays((cur) => cur.map((w) => (w.key === key ? { ...w, ...p } : w)));
  }

  return (
    <div className="space-y-2" data-pay-ways="">
      <input type="hidden" name={PAY_WAYS_PRESENT_FIELD} value="1" />
      <ul className="space-y-1.5">
        {ways.map((w, i) => (
          <li key={w.key} data-pay-way="" className="border-t border-ink/10 py-1 first:border-t-0">
            <input type="hidden" name="pay_way_method" value={methodForProvider(w.accountNumber.trim() ? w.provider : null, !!w.qr)} />
            <input type="hidden" name="pay_way_provider" value={w.accountNumber.trim() ? w.provider : ''} />
            <input type="hidden" name="pay_way_qr" value={w.qr ?? ''} />
            <input type="hidden" name="pay_way_details" value={w.details} />
            <FormRows width="wide" data="pay-way-rows">
              <ProviderRow
                n={i + 1}
                value={w.provider}
                disabled={disabled}
                onPick={(provider) => patch(w.key, { provider })}
                onRemove={() => setWays((cur) => cur.filter((x) => x.key !== w.key))}
              />
              <TypedRow
                name="Account name"
                fieldName="pay_way_account_name"
                value={w.accountName}
                placeholder="e.g. Rosa Dizon"
                maxLength={PAY_WAY_ACCOUNT_NAME_MAX}
                autoCapitalize="words"
                about={{ words: 'The name on the account, as they gave it to you.' }}
                attrs={{ 'data-pay-way-field': 'account_name' }}
                onKeep={(t) => {
                  patch(w.key, { accountName: t });
                  return { ok: true as const };
                }}
              />
              <TypedRow
                name="Account number"
                fieldName="pay_way_account_number"
                value={w.accountNumber}
                placeholder="e.g. 0917 000 0000"
                maxLength={PAY_WAY_ACCOUNT_NUMBER_MAX}
                inputMode="tel"
                about={{ words: 'Their account number or mobile. Double-check it — this is where you send the money.' }}
                attrs={{ 'data-pay-way-field': 'account_number' }}
                onKeep={(t) => {
                  patch(w.key, { accountNumber: t });
                  return { ok: true as const };
                }}
              />
            </FormRows>
            {w.details && !w.accountNumber ? (
              <p className="pb-1 text-[12.5px] text-ink/60" data-pay-way-details="">
                {w.details}
              </p>
            ) : null}
            {/* Their QR — a wide slot under the rows (a QR is never cropped round), shown at its own size once added. */}
            <div className="pb-2 pt-1">
              <FileUpload
                bucket="thread-files"
                pathPrefix={payWayQrPrefix(eventId)}
                acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                maxSizeMB={5}
                compressImage
                variant="wide"
                bigPreview
                label="Their QR (optional)"
                currentValue={w.qr}
                initialDisplayUrls={w.qr && w.qrUrl ? { [w.qr]: w.qrUrl } : undefined}
                disabled={disabled}
                onChange={(v) => patch(w.key, { qr: typeof v === 'string' && v ? v : null })}
              />
            </div>
          </li>
        ))}
      </ul>
      {ways.length < PAY_WAYS_MAX ? (
        <ActionButton
          tone="neutral"
          icon={Plus}
          label={ways.length ? 'Add another way' : 'Add a way to pay'}
          disabled={disabled}
          onClick={() => {
            setWays((cur) => [...cur, blank(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}

/** Account type ▾ — the supplier's own list, in the house dropdown (a tap OPENS the choices; it never cycles). */
function ProviderRow({
  n,
  value,
  disabled,
  onPick,
  onRemove,
}: {
  n: number;
  value: string;
  disabled?: boolean;
  onPick: (provider: string) => void;
  onRemove: () => void;
}) {
  const width = usePillWidth();
  return (
    <FormRow
      name="Account type"
      about={{ words: 'The bank or e-wallet — the same list a supplier picks from when they set up their own payments.' }}
      data="pay-way-provider"
    >
      <span inert={disabled || undefined} className="flex items-center gap-1.5">
        <PickMenu
          label={`Way ${n} — account type`}
          value={value}
          options={PROVIDER_OPTIONS}
          onPick={(k) => onPick(PAY_WAY_PROVIDERS.includes(k) ? k : FIRST_PROVIDER)}
          dataAttr="data-pay-way-provider"
          className={`${FORM_PICK_CLASS} ${width}`}
        />
        <ActionButton tone="neutral" iconOnly icon={X} label={`Remove way ${n}`} disabled={disabled} onClick={onRemove} />
      </span>
    </FormRow>
  );
}
