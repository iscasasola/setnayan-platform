'use client';

import { useState, useTransition } from 'react';
import { Loader2, MailQuestion } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import {
  LOCKED_FIELD_LABEL,
  type LockedIdentityFieldKey,
  type VendorCorrectionRequestRow,
} from '@/lib/vendor-corrections';
import { requestProfileCorrection } from '../../actions';

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
export function RequestCorrectionCard({
  currentSlug,
  isVerified,
  openRequests,
}: {
  currentSlug: string | null;
  isVerified: boolean;
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
  ];
  const fields: LockedIdentityFieldKey[] = isVerified
    ? ['business_slug', ...OTHER_LOCKED]
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

  return (
    <section className="sn-tile space-y-3">
      <div className="flex items-start gap-3">
        <MailQuestion aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/45" strokeWidth={1.75} />
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-ink">Something here is wrong?</h3>
          <p className="text-sm text-ink/65">
            Your shop&rsquo;s web address is permanent — it goes on printed cards
            and QR codes, so neither you nor we can change it casually. If it
            &rsquo;s wrong, ask us and we&rsquo;ll look at it.
            {isVerified
              ? ' Your verified business details work the same way.'
              : ''}
          </p>
          {currentSlug ? (
            <p className="font-mono text-xs text-ink/50">
              Your address today: setnayan.com/{currentSlug}
            </p>
          ) : null}
        </div>
      </div>

      {alreadyOpen.size > 0 ? (
        <ul className="space-y-1">
          {[...alreadyOpen].map((k) => (
            <li key={k} className="text-xs text-ink/60">
              <span className="font-medium text-ink/75">
                {LOCKED_FIELD_LABEL[k as LockedIdentityFieldKey] ?? k}
              </span>{' '}
              — asked for, waiting on Setnayan.
            </li>
          ))}
        </ul>
      ) : null}

      {available.length === 0 ? null : !open ? (
        <button
          type="button"
          onClick={() => {
            setField(available[0]!);
            setOpen(true);
          }}
          className="button-secondary inline-flex h-9 items-center px-3 text-xs"
        >
          Ask us to correct something
        </button>
      ) : (
        <div className="space-y-3 border-t border-ink/10 pt-3">
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.12em] text-ink/55">
              What&rsquo;s wrong
            </span>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as LockedIdentityFieldKey)}
              className="input-field w-full text-sm"
            >
              {available.map((f) => (
                <option key={f} value={f}>
                  {LOCKED_FIELD_LABEL[f]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.12em] text-ink/55">
              What it should be
            </span>
            <input
              value={value}
              onChange={(e) =>
                setValue(isAddress ? e.target.value.toLowerCase() : e.target.value)
              }
              placeholder={isAddress ? 'banaweflorals' : ''}
              className={`input-field w-full text-sm ${isAddress ? 'font-mono' : ''}`}
            />
            {isAddress ? (
              <span className="block text-xs text-ink/50">
                Lowercase letters, numbers and hyphens. Your old address will
                keep working, so anything already printed still finds you.
              </span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.12em] text-ink/55">
              Why (helps us say yes)
            </span>
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
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="button-secondary inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send to Setnayan'
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-ink/55 underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
