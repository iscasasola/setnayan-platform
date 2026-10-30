'use client';

/**
 * 📸 SHARE A PHOTO WITH YOUR SUPPLIER — the couple's sheet (owner 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO
 * A SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO THEIR SERVICE CARD …").
 *
 * Opened from a part's own photos (`ideasRow` in mood-board-studio.tsx — one quiet line under them). Top to bottom:
 * which of the part's OWN photos · which linked supplier's service card (one dropdown) · how it is credited (one
 * dropdown: "Ana & Ben · Feb 2027" or "A couple") · the consent checkbox · Send. Under it, this photo's shares so far,
 * each with its state and "Take back".
 *
 * 🔑 A send never resets the sheet: the answer is said in place and the list re-reads (the ONE read the sheet makes,
 * `readPhotoShareOptions`). Writers come from the Mood Board's actions context, so the lab's stand-ins answer there.
 * The details — who sees it, when, and that there is no payment — live inside the ⓘ.
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { Send, Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Explain } from '@/app/_components/explain';
import { PickMenu } from '../../../website/editor/_components/pick-menu';
import { useMoodBoardActions } from './mood-board-actions-context';
import { StudioSheet } from './colour-picker-sheet';
import type { PhotoShareOptions } from '@/lib/couple-photo-share';
import {
  coupleCreditChoices,
  couplePhotoConsentText,
  coupleShareStateLine,
  type CoupleCreditStyle,
} from '@/lib/couple-photo-share';

export type SharePhoto = { pos: number; url: string };

export function SharePhotoSheet({
  eventId,
  slotKey,
  partLabel,
  photos,
  onClose,
}: {
  eventId: string;
  slotKey: string;
  partLabel: string;
  /** The part's OWN photos (not a supplier's pick, not a kept suggestion), in place order. */
  photos: SharePhoto[];
  onClose: () => void;
}) {
  const { couplePhotoShare } = useMoodBoardActions();
  const [pos, setPos] = useState<number>(photos[0]?.pos ?? 1);
  const [opts, setOpts] = useState<PhotoShareOptions | null>(null);
  const [card, setCard] = useState<string>('');
  const [credit, setCredit] = useState<CoupleCreditStyle>('names');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const consentId = useId();

  const read = useCallback(
    async (at: number) => {
      try {
        const reply = await couplePhotoShare({ op: 'read', eventId, slotKey, slotPosition: at });
        const o: PhotoShareOptions = reply.op === 'read' ? reply.result : { status: 'error' };
        setOpts(o);
        if (o.status === 'ok') {
          setCard((c) => (o.cards.some((x) => x.vendorServiceId === c) ? c : (o.cards[0]?.vendorServiceId ?? '')));
          setCredit((s) => (s === 'names' && !o.namesCredit ? 'a_couple' : s));
        }
      } catch {
        setOpts({ status: 'error' });
      }
    },
    [eventId, slotKey, couplePhotoShare],
  );
  useEffect(() => {
    void read(pos);
  }, [pos, read]);

  const ok = opts?.status === 'ok' ? opts : null;
  const chosen = ok?.cards.find((c) => c.vendorServiceId === card) ?? null;
  const shop = chosen?.shop ?? 'your supplier';
  const choices = coupleCreditChoices(ok?.namesCredit ?? null);

  const send = async () => {
    if (!ok || !chosen || !consent || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const reply = await couplePhotoShare({
        op: 'send',
        eventId,
        inspirationId: ok.inspirationId,
        vendorServiceId: chosen.vendorServiceId,
        creditStyle: credit,
        creditLine: credit === 'names' ? ok.namesCredit : null,
        consent,
      });
      const r = reply.op === 'send' ? reply.result : { status: 'refused' as const, message: 'That did not go through — nothing was sent. Try again.' };
      if (r.status === 'ok') {
        setSaid({ tone: 'ok', text: `Sent to ${r.shop}. It shows on their card once they approve.` });
        setConsent(false);
        await read(pos);
      } else {
        setSaid({ tone: 'bad', text: r.message });
      }
    } catch {
      setSaid({ tone: 'bad', text: 'That did not go through — nothing was sent. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const takeBack = async (shareId: string, from: string) => {
    setBusy(true);
    setSaid(null);
    try {
      const reply = await couplePhotoShare({ op: 'take_back', eventId, shareId });
      const r = reply.op === 'take_back' ? reply.result : { status: 'error' as const };
      setSaid(r.status === 'error' ? { tone: 'bad', text: 'That did not go through — try again.' } : { tone: 'ok', text: `Taken back — it is off ${from}’s card.` });
      await read(pos);
    } catch {
      setSaid({ tone: 'bad', text: 'That did not go through — try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <StudioSheet label="Share with your supplier" onClose={onClose}>
      <div className="flex flex-col gap-3 px-3 pb-2" data-share-photo-sheet={slotKey}>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[14px] text-ink/70">
            A photo of <b className="font-medium text-ink">{partLabel}</b> they made for you
          </p>
          <Explain title="Sharing a photo with your supplier">
            Only the supplier you pick sees it. It shows on their service card — with your credit line — once they
            approve; until then, or if they decline, it shows nowhere. You can take it back at any time and it leaves
            their card. There is no payment for sharing; your supplier may thank you with a Gift.
          </Explain>
        </div>

        {photos.length > 1 ? (
          <div className="flex gap-2" role="radiogroup" aria-label="Which photo">
            {photos.map((p) => (
              <button
                key={p.pos}
                type="button"
                role="radio"
                aria-checked={p.pos === pos}
                aria-label={`Photo ${p.pos}`}
                onClick={() => setPos(p.pos)}
                className={`h-14 w-14 flex-none overflow-hidden rounded-xl ring-offset-2 ${p.pos === pos ? 'ring-2 ring-terracotta' : 'ring-1 ring-ink/15'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the couple's own board photo */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- the couple's own board photo
          <img src={photos[0].url} alt="" className="h-28 w-28 rounded-xl object-cover" />
        ) : null}

        {!opts ? (
          <p className="text-[13px] text-ink/55" aria-live="polite">Reading your suppliers…</p>
        ) : opts.status !== 'ok' ? (
          <p role="alert" className="text-[13px] text-danger-700">
            {opts.status === 'gone' ? 'This photo is no longer on your board.' : 'Your suppliers could not be read just now. Nothing was sent — try again in a moment.'}
          </p>
        ) : !opts.shareable ? (
          <p className="text-[13px] text-ink/65">Only a photo you uploaded yourself can be shared with a supplier.</p>
        ) : opts.cards.length === 0 ? (
          <p className="text-[13px] text-ink/65">Add your supplier to your event first — their service cards then show here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">Their service card</span>
              <PickMenu
                label="Their service card"
                value={card}
                options={opts.cards.map((c) => ({ key: c.vendorServiceId, label: `${c.title} · ${c.shop}` }))}
                onPick={(k) => setCard(k)}
                dataAttr="data-share-photo-card"
                buttonText={chosen ? `${chosen.title} · ${chosen.shop}` : 'Pick a card'}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">Credit on the photo</span>
              <PickMenu
                label="Credit on the photo"
                value={credit}
                options={choices}
                onPick={(k) => setCredit(k === 'names' ? 'names' : 'a_couple')}
                dataAttr="data-share-photo-credit"
                buttonText={choices.find((c) => c.key === credit)?.label ?? 'A couple'}
              />
            </label>
            <label htmlFor={consentId} className="flex min-h-11 items-start gap-3 text-[14px] leading-snug text-ink" data-share-photo-consent="">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-none accent-terracotta"
              />
              <span>{couplePhotoConsentText(shop)}</span>
            </label>
            <div className="flex justify-end" data-share-photo-send="">
              <ActionButton
                tone="brand"
                main
                icon={Send}
                label={`Send to ${shop}`}
                disabled={!consent || !chosen || busy}
                onClick={() => void send()}
              />
            </div>
          </div>
        )}

        {said ? (
          <p role={said.tone === 'bad' ? 'alert' : 'status'} className={`text-[13px] ${said.tone === 'bad' ? 'text-danger-700' : 'text-success-700'}`}>
            {said.text}
          </p>
        ) : null}

        {ok && ok.shares.length > 0 ? (
          <ul className="flex flex-col divide-y divide-ink/10 border-t border-ink/10" data-share-photo-list="">
            {ok.shares.map((s) => (
              <li key={s.shareId} className="flex min-h-12 items-center gap-2 py-2" data-share-photo-state={s.state}>
                <span className="min-w-0 flex-1 text-[13px] leading-tight">
                  <b className="block font-medium text-ink">{coupleShareStateLine(s.state, s.shop)}</b>
                  <span className="text-ink/55">
                    {s.serviceTitle} · {s.credit}
                  </span>
                </span>
                {s.state === 'waiting' || s.state === 'approved' ? (
                  <ActionButton tone="neutral" quiet icon={Undo2} label="Take back" name={`Take back the photo from ${s.shop}`} disabled={busy} onClick={() => void takeBack(s.shareId, s.shop)} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </StudioSheet>
  );
}
