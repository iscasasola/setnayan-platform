'use client';

import { useState, useTransition } from 'react';
import { MailQuestion, Send, X } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

import { useToast } from '@/app/_components/toast/toast-provider';
import {
  LOCKED_FIELD_LABEL,
  type LockedIdentityFieldKey,
  type VendorCorrectionRequestRow,
} from '@/lib/vendor-corrections';
import { requestProfileCorrection } from '../../actions';
import { SHOP_NAME_MAX } from '@/lib/business-slug';

/**
 * My Shop → "Something here is wrong?" — the vendor's way to ASK.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `requestProfileCorrection` shipped complete, with an admin queue at
 * /admin/corrections to resolve what it files, and **had zero callers**. No
 * screen anywhere rendered a form for it, so production held ZERO rows: the
 * queue could never receive anything, and the only remedy for a permanently
 * wrong detail was for the vendor to reach a human some other way and hope.
 *
 * The action, the queue, the labels and the admin apply/decline paths were all
 * already built. This card is the missing doorway — the delta, not a rebuild.
 *
 * ── WHY THE WEB ADDRESS IS ALWAYS OFFERED ───────────────────────────────────
 * Every other field here is locked only once the shop is VERIFIED; before that
 * the vendor edits it inline. The address is different: it is immutable for
 * EVERYONE at every tier, enforced by a database trigger, because it goes on
 * printed cards, QR codes and the sitemap. So a shop that typo'd its own name
 * at signup — which is exactly how a wrong address happens — needs this on day
 * one, long before verification.
 *
 * ⛔ ASKING IS NOT CHANGING. Nothing here writes to the profile. It files a
 * request an admin applies or declines, and the address stays permanent-by-
 * design either way.
 */
/** Rule 2's section label — small grey capitals, no box. */
const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]';

export function RequestCorrectionCard({
  currentSlug,
  isVerified,
  requestOnly,
  setUpBySetnayan = false,
  openRequests,
}: {
  currentSlug: string | null;
  isVerified: boolean;
  /**
   * 🏷 The fields this shop changes ONLY by request today (`identityLockOf`, owner 2026-10-29) — offered here. Absent
   * → today's rule (the address always; the rest once verified).
   */
  requestOnly?: readonly LockedIdentityFieldKey[];
  /** Setnayan set this shop up — the name and address it typed change by request. */
  setUpBySetnayan?: boolean;
  openRequests: VendorCorrectionRequestRow[];
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [field, setField] = useState<LockedIdentityFieldKey>('business_slug');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [filed, setFiled] = useState<LockedIdentityFieldKey[]>([]);

  // The address is offered to everyone; the rest only once the verified lock is
  // what is actually stopping the vendor from editing them inline.
  const OTHER_LOCKED: LockedIdentityFieldKey[] = [
    'business_name',
    'business_owner_name',
    'hq_address',
    'location_city',
    'contact_phone',
    'contact_email',
    'in_business_since_year',
    // 🚨 THE INLINE EDITOR SENDS VERIFIED VENDORS HERE FOR THIS ONE.
    // `updateVendorProfileField` refuses a verified shop's logo with "Your shop
    // is verified, so these details are locked. Request a correction instead."
    // — while My Shop still renders a working-looking uploader for it. Omitting
    // it here named a remedy that was not on the screen, and left a wrong logo
    // unchangeable by anyone through the product: the admin apply path already
    // handles `logo_url`, but no request could ever be filed for it.
    'logo_url',
  ];
  // ⚠ `services` is deliberately NOT here — the Coverage page owns that writer,
  // so a verified vendor already has a real place to change it.

  // 🏷 With the shared rule's list (`requestOnly`, owner 2026-10-29) the card offers exactly that, in its own order —
  // the web address first, then (for a shop Setnayan set up) its name and address.
  const fields: LockedIdentityFieldKey[] = isVerified
    ? ['business_slug', ...OTHER_LOCKED]
    : requestOnly
      ? ['business_slug', ...OTHER_LOCKED.filter((f) => requestOnly.includes(f))]
      : ['business_slug'];

  // A field with a request already waiting is shown as pending rather than
  // offered again — a vendor who files the same correction three times because
  // nothing acknowledged the first is a support ticket, not a bug report.
  const alreadyOpen = new Set<string>([
    ...openRequests.map((r) => r.field_key),
    ...filed,
  ]);

  const isAddress = field === 'business_slug';

  function submit() {
    if (!value.trim() && !note.trim()) {
      toast.error('Tell us what it should say.');
      return;
    }
    const fd = new FormData();
    fd.set('field_key', field);
    fd.set('requested_value', value);
    fd.set('note', note);
    setPending(true);
    startTransition(async () => {
      const res = await requestProfileCorrection(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Sent. Setnayan will review it and let you know.');
      setFiled((f) => [...f, field]);
      setValue('');
      setNote('');
      setOpen(false);
    });
  }

  const available = fields.filter((f) => !alreadyOpen.has(f));
  // Which other details are changed by asking, too — said under the label.
  const sameWay = isVerified
    ? ' Your verified business details work the same way.'
    : setUpBySetnayan
      ? ' Setnayan set up your shop, so the name and address we typed work the same way.'
      : '';

  return (
    <section className="space-y-3" data-request-correction>
      <div className="space-y-1">
        <InfoTip label="Something here is wrong?" labelAs="h3" labelClassName={SECTION_LABEL} align="start">
          Your shop&rsquo;s web address is permanent — it goes on printed cards and QR codes, so neither you nor we can
          change it casually.
        </InfoTip>
        <p className="text-sm text-[color:var(--m-slate-2)]">
          If it&rsquo;s wrong, ask us and we&rsquo;ll look at it.{sameWay}
        </p>
        {currentSlug ? (
          <p className="text-sm text-[color:var(--m-slate-2)]">
            Your address today: <span className="font-semibold text-ink">setnayan.com/{currentSlug}</span>
          </p>
        ) : null}
      </div>

      {alreadyOpen.size > 0 ? (
        <ul className="divide-y divide-[color:var(--m-line)]">
          {[...alreadyOpen].map((k) => (
            <li key={k} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-sm font-semibold text-ink">
                {LOCKED_FIELD_LABEL[k as LockedIdentityFieldKey] ?? k}
              </span>
              <Badge tone="wait">Asked · waiting on Setnayan</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {available.length === 0 ? null : !open ? (
        <ActionButton
          tone="neutral"
          icon={MailQuestion}
          label="Ask us to correct something"
          onClick={() => {
            // A shop Setnayan set up most often asks about its NAME (owner 2026-10-29) — start there when offered.
            setField(setUpBySetnayan && available.includes('business_name') ? 'business_name' : available[0]!);
            setOpen(true);
          }}
        />
      ) : (
        <div className="space-y-3 border-t border-[color:var(--m-line)] pt-3">
          <div className="space-y-1">
            <span className={`block ${SECTION_LABEL}`}>What&rsquo;s wrong</span>
            <PickMenu
              label="What’s wrong"
              value={field}
              options={available.map((f) => ({ key: f, label: LOCKED_FIELD_LABEL[f] }))}
              onPick={(k) => setField(k as LockedIdentityFieldKey)}
              dataAttr="data-correction-field"
              className="!min-h-11"
            />
          </div>

          <label className="block space-y-1">
            <span className={`block ${SECTION_LABEL}`}>What it should be</span>
            <input
              value={value}
              onChange={(e) =>
                setValue(isAddress ? e.target.value.toLowerCase() : e.target.value)
              }
              maxLength={field === 'business_name' ? SHOP_NAME_MAX : undefined}
              placeholder={isAddress ? 'banaweflorals' : ''}
              className="input-field w-full text-sm"
            />
            {isAddress ? (
              <span className="block text-sm text-[color:var(--m-slate-2)]">
                Lowercase letters, numbers and hyphens. Your old address will
                keep working, so anything already printed still finds you.
              </span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className={`block ${SECTION_LABEL}`}>Why (helps us say yes)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={
                isAddress
                  ? 'Our name was typed wrong when we signed up.'
                  : 'What changed, and when.'
              }
              className="input-field w-full text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              tone="brand"
              icon={Send}
              label={pending ? 'Sending…' : 'Send to Setnayan'}
              onClick={submit}
              waiting={pending}
            />
            <ActionButton tone="neutral" quiet icon={X} label="Cancel" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </section>
  );
}
