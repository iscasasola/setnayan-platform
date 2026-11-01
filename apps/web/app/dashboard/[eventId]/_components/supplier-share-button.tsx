'use client';

/**
 * SHARE — a supplier the couple added themselves, invited to the event from the couple's own phone.
 *
 * DECISION_LOG 2026-10-30, "THE INVITE TEXTS — GUEST AND SELF-ADDED SUPPLIER — APPROVED; A SELF-ADDED SUPPLIER GETS A
 * SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL CARD". Owner, verbatim: *"for the manual suppliers. we will use
 * the same share button. with a text to invite them to sync with our event."* · *"no need to wait to create link.
 * create an automatic link"*.
 *
 * ── THE SAME SHARE AS A GUEST'S ───────────────────────────────────────────────────────────────────────────────────
 * The press goes through `shareInvite` (guests/_components/send-invite.tsx) — the ONE share the guest card's Send
 * uses: the phone's share sheet with the message AND a picture where the sheet takes a file (here their DIGITAL
 * CARD, as the guest's is their ticket), the message alone where it does not, and no sheet at all (most computers)
 * → the message is copied, with Download card beside it. Closing the sheet is not a failure.
 *
 * Drawn on BOTH places a self-added supplier is: their record card (the head, beside the QR) and their service card
 * on Event › Suppliers (the verb row). Never for a supplier on Setnayan — the callers gate it on the one predicate
 * (`canInviteSupplier`: `actions.connect` on the service card; the record card exists only for them).
 *
 * 🪤 READY BEFORE THE TAP. iOS refuses a share that is not inside the tap, and waiting on the server spends it. So
 * the message and the card are asked for ahead, in ONE request to the one link writer
 * (`createManualVendorInvite({ …, withShare: true })` — it returns their live link, or MAKES it for an older supplier
 * who has none: no "create link" step — with the approved message and the card drawn from it) — on open for the
 * record card (`prepareOnMount`), on the first touch or focus for the service card (so a page of cards asks for
 * nothing until one is reached for). If a tap still arrives first, it waits, tries, and — when the phone refuses —
 * says "Ready — tap Share again".
 *
 * ⛔ WE SEND NOTHING. No email, no SMS — every message leaves from the couple's own phone.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, Share, Share2 } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { shareInvite } from '../guests/_components/send-invite';
import { createManualVendorInvite } from '../vendors/actions';
import type { SupplierSharePayload } from '@/lib/supplier-share';

/** What the Share's one request answers. */
export type SupplierShareResult = { ok: true; share: SupplierSharePayload } | { ok: false; error: string };

/** A dev lab's stand-in for the one request (it has no session). */
export const SupplierShareStandInCtx = createContext<((vendorId: string) => Promise<SupplierShareResult>) | null>(null);

/** The one request: their link through the one writer, with the message and the card. */
async function askForShare(eventId: string, vendorId: string): Promise<SupplierShareResult> {
  const res = await createManualVendorInvite({ eventId, vendorId, withShare: true });
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.share) return { ok: false, error: 'We could not read their details just now. Try again.' };
  return { ok: true, share: res.share };
}

type Ready = { share: SupplierSharePayload; file: File | null };
type Said =
  | { kind: 'copied' }
  | { kind: 'manual'; text: string }
  | { kind: 'again' }
  | { kind: 'error'; text: string };

/** The card as a File, for a share sheet that takes one. Null when there is none (the message still goes). */
async function cardFile(share: SupplierSharePayload): Promise<File | null> {
  if (!share.card) return null;
  try {
    const blob = await (await fetch(share.card)).blob();
    return new File([blob], share.fileName, { type: 'image/png' });
  } catch {
    return null;
  }
}

export function SupplierShareButton({
  eventId,
  vendorId,
  vendorName,
  iconOnly = false,
  prepareOnMount = false,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  /** The record card's head draws its presses as icons (Download · Copy link · Share). */
  iconOnly?: boolean;
  /** Ask for the message and the card as soon as it is drawn (an opened record card). */
  prepareOnMount?: boolean;
}) {
  const standIn = useContext(SupplierShareStandInCtx);
  const [ready, setReady] = useState<Ready | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const inFlight = useRef<Promise<Ready | { error: string }> | null>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);

  const prepare = useCallback((): Promise<Ready | { error: string }> => {
    if (!inFlight.current) {
      inFlight.current = (async () => {
        try {
          const res = standIn ? await standIn(vendorId) : await askForShare(eventId, vendorId);
          if (!res.ok) return { error: res.error };
          const file = await cardFile(res.share);
          const got = { share: res.share, file };
          setReady(got);
          return got;
        } catch {
          return { error: 'We could not get their invite ready just now. Try again.' };
        }
      })().then((out) => {
        // A failure may be asked again; a success is kept for the visit.
        if ('error' in out) inFlight.current = null;
        return out;
      });
    }
    return inFlight.current;
  }, [eventId, vendorId, standIn]);

  useEffect(() => {
    if (prepareOnMount) void prepare();
  }, [prepareOnMount, prepare]);

  useEffect(() => {
    if (said?.kind === 'manual') manualRef.current?.select();
  }, [said]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSaid({ kind: 'copied' });
    } catch {
      // Clipboard blocked (some in-app browsers) — hand them the message, selected.
      setSaid({ kind: 'manual', text });
    }
  }

  async function press() {
    setSaid(null);
    // ⓵ In hand — share inside the tap.
    if (ready) {
      const out = await shareInvite(ready.file, () => ready.share.message);
      if (out === 'copy') await copy(ready.share.message);
      return;
    }
    // ⓶ Not yet — get it, then try; a phone that refuses a late share is asked for one more tap.
    setBusy(true);
    const got = await prepare();
    setBusy(false);
    if ('error' in got) {
      setSaid({ kind: 'error', text: got.error });
      return;
    }
    const hasSheet = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const out = await shareInvite(got.file, () => got.share.message);
    if (out === 'copy') {
      if (hasSheet) setSaid({ kind: 'again' });
      else await copy(got.share.message);
    }
  }

  const who = ready?.share.greeting || vendorName;
  return (
    <span className="contents" data-supplier-share="">
      <span className="contents" onPointerDown={() => void prepare()} onFocus={() => void prepare()}>
        <ActionButton
          tone="neutral"
          iconOnly={iconOnly}
          icon={Share2}
          label={busy ? 'Getting it ready…' : iconOnly ? `Share ${vendorName}'s invite` : 'Share'}
          onClick={() => void press()}
          disabled={busy}
        />
      </span>
      {said ? (
        <span aria-live="polite" className="basis-full text-[12.5px] leading-snug text-ink/70" data-supplier-share-said={said.kind}>
          {said.kind === 'copied' ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="flex items-start gap-1">
                <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" strokeWidth={2.25} />
                Message copied — paste it to {who} in Messenger or Viber, with their card.
              </span>
              {ready?.share.card ? (
                <SaveFileLink href={ready.share.card} filename={ready.share.fileName} className={`${actionButtonClass('neutral')} min-h-11`}>
                  {(state) => (
                    <>
                      <Share aria-hidden strokeWidth={1.9} />
                      <span className="lbl">{state === 'saving' ? 'Saving…' : 'Download card'}</span>
                    </>
                  )}
                </SaveFileLink>
              ) : null}
            </span>
          ) : said.kind === 'again' ? (
            'Ready — tap Share again to send it.'
          ) : said.kind === 'manual' ? (
            <span className="block space-y-1.5">
              <span className="block">Your phone blocked the copy — select the message below and copy it.</span>
              <textarea
                ref={manualRef}
                readOnly
                value={said.text}
                rows={8}
                className="w-full rounded-xl border border-ink/15 bg-white p-3 text-sm leading-relaxed text-ink dark:bg-raised" // no-card-ok: a text box the couple selects to copy — an input, as on the guest card
              />
            </span>
          ) : (
            <span role="alert" className="text-danger-800 dark:text-danger-200">
              {said.text}
            </span>
          )}
        </span>
      ) : null}
    </span>
  );
}
