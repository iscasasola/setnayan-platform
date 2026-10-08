'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Heart, ImagePlus, Send, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { GIFT_GIVER_NAME_MAX, GIFT_MESSAGE_MAX, leftToReach } from '@/lib/wish-list';
import {
  GIFT_AMOUNT_NEEDED,
  GIFT_FROM_INVITATION,
  GIFT_NAME_NEEDED,
  GIFT_NAME_PLACEHOLDER,
  GIFT_NOT_KEPT,
  GIFT_NOT_RECOGNISED,
  GIFT_SHOT_HINT,
  GIFT_SHOT_LABEL,
  GIFT_SHOT_REFUSED,
  cleanGiftAmount,
  giftSendLabel,
  giftSheetLead,
  giftSheetTitle,
  giftThanksLine,
  giftThanksTitle,
} from '@/lib/gift-record';

/**
 * 🎁 "SHOW MARIA & JOSE" — the guest tells the couple what they sent (owner
 * 2026-10-08: "they also give screenshot of their payment and the vallue and
 * their message for the couple. this will be the way to measure."; prototype
 * `egifts_wish_list_2026-10-08_fable.html` frames 18 · 19 · 20).
 *
 *   Your screenshot (asked for first, never demanded — a bank app may give none)
 *   · Amount (prefilled with what was left to reach the wish's price)
 *   · A word for them (optional) · From (the invitation's own name, or a Name
 *   field when the invitation has none) → ✕ Not now · ➤ Send to Maria & Jose
 *   → "Thank you, Tita Nene."
 *
 * 🔒 The screenshot goes to a PRIVATE folder of the guest's own
 * (`POST /api/guest-selfie`, purpose `gift-shot`), and the record is written by
 * the server after it has checked who is asking (purpose `gift-record`). Only
 * the couple is ever shown the screenshot, the amount or the words.
 *
 * 🔴 A REFUSAL IS SAID HERE, IN PLACE — a reader the event does not recognise is
 * told how to be recognised; a record the server would not keep says why.
 *
 * Loaded only when a guest presses "I sent it" (`next/dynamic` in its callers) —
 * the gift page does not carry it until then.
 */

export type GiftRecordTarget = { id: string; name: string; pricePhp: number | null; sentPhp: number } | null;

type Kept = { giverName: string; amountPhp: number; wishName: string | null; hasShot: boolean; hasMessage: boolean; nowGot: boolean };

const FIELD =
  'mt-1.5 min-h-11 w-full scroll-mb-24 rounded-md border border-ink/15 bg-cream px-3 py-2 text-[15px] text-ink placeholder:text-ink/45 focus:border-ink/40 focus:outline-none';
const LABEL = 'flex items-center justify-between gap-2 text-[13px] text-ink/60';
const FOOT_BUTTON = 'sn-press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold';

export default function GiftRecordSheet({
  eventId,
  hostName,
  wish,
  giverName,
  recognised,
  onClose,
}: {
  eventId: string;
  hostName: string;
  /** The wish it counts toward — null for a gift toward no wish. */
  wish: GiftRecordTarget;
  /** The invitation's own name; null/'' → the sheet asks for one. */
  giverName: string | null;
  /** Does the event know this reader as its guest? If not, the sheet says how to be known. */
  recognised: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const left = wish ? leftToReach(wish.pricePhp, wish.sentPhp) : null;
  const [amount, setAmount] = useState(left && left > 0 ? String(left) : '');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [shot, setShot] = useState<{ ref: string; preview: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [kept, setKept] = useState<Kept | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const ownName = (giverName ?? '').trim();

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/guest-selfie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, ...body }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, data };
  };

  /** The picture goes straight to the guest's own private folder; only its ref comes back here. */
  const addShot = async (picked: File | undefined) => {
    if (!picked) return;
    setRefused(null);
    setAdding(true);
    try {
      const presign = await post({ purpose: 'gift-shot', contentType: picked.type, sizeBytes: picked.size });
      const uploadUrl = presign.data?.uploadUrl;
      const ref = presign.data?.r2Ref;
      if (!presign.ok || typeof uploadUrl !== 'string' || typeof ref !== 'string') {
        setRefused(typeof presign.data?.error === 'string' ? presign.data.error : GIFT_SHOT_REFUSED);
        return;
      }
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': picked.type }, body: picked });
      if (!put.ok) {
        setRefused(GIFT_SHOT_REFUSED);
        return;
      }
      setShot((old) => {
        if (old) URL.revokeObjectURL(old.preview);
        return { ref, preview: URL.createObjectURL(picked) };
      });
    } catch {
      setRefused(GIFT_SHOT_REFUSED);
    } finally {
      setAdding(false);
      if (file.current) file.current.value = '';
    }
  };

  const send = async () => {
    if (cleanGiftAmount(amount) === undefined) {
      setRefused(GIFT_AMOUNT_NEEDED);
      return;
    }
    if (ownName === '' && name.trim() === '') {
      setRefused(GIFT_NAME_NEEDED);
      return;
    }
    setRefused(null);
    setSending(true);
    try {
      const res = await post({ purpose: 'gift-record', wishId: wish?.id ?? '', amount, message, name, shotRef: shot?.ref ?? '' });
      if (!res.ok || !res.data || typeof res.data.amountPhp !== 'number') {
        setRefused(typeof res.data?.error === 'string' ? res.data.error : GIFT_NOT_KEPT);
        return;
      }
      setKept(res.data as unknown as Kept);
      /* The list behind the sheet reads the new sum (and a wish that reached its price). */
      router.refresh();
    } catch {
      setRefused(GIFT_NOT_KEPT);
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-gift-record="" className="relative z-[70] text-left">
      <Sheet open onClose={onClose} labelledById="gift-record-title" wide rise>
        <div className="px-5 pt-5">
          {kept ? (
            <div data-gift-thanks="" className="pb-2 pt-4 text-center">
              <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-ink/5 text-ink">
                <Heart aria-hidden className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <h2 id="gift-record-title" className="font-display text-[26px] font-medium italic leading-tight text-mulberry">
                {giftThanksTitle(kept.giverName)}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink/70">{giftThanksLine({ hostName, ...kept })}</p>
              <div className="sn-glass-row sticky bottom-0 -mx-5 mt-5 flex px-5 py-3">
                <button type="button" data-gift-back="" onClick={onClose} className={`${FOOT_BUTTON} bg-mulberry text-cream`}>
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                  Back to the list
                </button>
              </div>
            </div>
          ) : !recognised ? (
            <div data-gift-not-recognised="">
              <h2 id="gift-record-title" className="pr-10 font-display text-2xl font-medium italic leading-tight text-mulberry">
                {giftSheetTitle(hostName)}
              </h2>
              <p role="status" className="mt-2 text-[14px] leading-relaxed text-ink/75">
                {GIFT_NOT_RECOGNISED}
              </p>
              <div className="sn-glass-row sticky bottom-0 -mx-5 mt-5 flex px-5 py-3">
                <button type="button" onClick={onClose} className={`${FOOT_BUTTON} text-ink/75 ring-1 ring-inset ring-ink/15`}>
                  <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 id="gift-record-title" className="pr-10 font-display text-2xl font-medium italic leading-tight text-mulberry">
                {giftSheetTitle(hostName)}
              </h2>
              <p className="mt-2 text-[13.5px] leading-snug text-ink/70">{giftSheetLead(hostName)}</p>

              <div className="mt-3 border-t border-ink/10 pt-3">
                <span className={LABEL}>
                  {GIFT_SHOT_LABEL} <small className="text-[12px] text-ink/50">{GIFT_SHOT_HINT}</small>
                </span>
                <input
                  ref={file}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label={GIFT_SHOT_LABEL}
                  data-gift-shot-input=""
                  onChange={(e) => void addShot(e.target.files?.[0])}
                />
                <button
                  type="button"
                  data-gift-shot={shot ? 'added' : 'none'}
                  disabled={adding}
                  onClick={() => file.current?.click()}
                  className="mt-1.5 flex h-[120px] w-[92px] items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed border-ink/25 text-[14px] font-semibold text-ink disabled:opacity-60"
                >
                  {shot ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the guest's own picture, from this browser's memory
                    <img src={shot.preview} alt="Your screenshot" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      {adding ? 'Adding…' : 'Add it'}
                    </>
                  )}
                </button>
                {shot ? (
                  <button type="button" data-gift-shot-change="" onClick={() => file.current?.click()} className="mt-1 text-[13px] text-ink/70 underline underline-offset-4">
                    Change it
                  </button>
                ) : null}
              </div>

              <label className="mt-3 block border-t border-ink/10 pt-3">
                <span className={LABEL}>Amount</span>
                <span className="relative block">
                  <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-[15px] text-ink/60">
                    ₱
                  </span>
                  <input
                    data-gift-amount=""
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                    placeholder="what you sent"
                    className={`${FIELD} pl-8`}
                  />
                </span>
              </label>

              <label className="mt-3 block border-t border-ink/10 pt-3">
                <span className={LABEL}>
                  A word for {hostName} <small className="text-[12px] text-ink/50">optional</small>
                </span>
                <textarea
                  data-gift-message=""
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={GIFT_MESSAGE_MAX}
                  rows={3}
                  placeholder="e.g. For your merienda machine!"
                  className={FIELD}
                />
              </label>

              {ownName !== '' ? (
                <div data-gift-from="invitation" className="mt-3 border-t border-ink/10 pt-3">
                  <span className={LABEL}>From</span>
                  <b className="mt-1 block text-[15px] font-semibold text-ink">{ownName}</b>
                  <span className="block text-[13px] text-ink/60">{GIFT_FROM_INVITATION}</span>
                </div>
              ) : (
                <label data-gift-from="typed" className="mt-3 block border-t border-ink/10 pt-3">
                  <span className={LABEL}>Your name</span>
                  <input data-gift-name="" value={name} onChange={(e) => setName(e.target.value)} maxLength={GIFT_GIVER_NAME_MAX} placeholder={GIFT_NAME_PLACEHOLDER} className={FIELD} />
                </label>
              )}

              {refused ? (
                <p role="alert" data-gift-refused="" className="pt-3 text-[14px] text-ink">
                  {refused}
                </p>
              ) : null}
              <div data-gift-record-foot="" className="sn-glass-row sticky bottom-0 -mx-5 mt-5 flex gap-2 px-5 py-3">
                <button type="button" data-gift-not-now="" onClick={onClose} className={`${FOOT_BUTTON} text-ink/75 ring-1 ring-inset ring-ink/15`}>
                  <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                  Not now
                </button>
                <button type="button" data-gift-send="" disabled={sending || adding} onClick={() => void send()} className={`${FOOT_BUTTON} bg-mulberry text-cream disabled:opacity-60`}>
                  <Send aria-hidden className="h-4 w-4" strokeWidth={2} />
                  {sending ? 'Sending…' : giftSendLabel(hostName)}
                </button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}

