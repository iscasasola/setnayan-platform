'use client';

/**
 * 📸 PHOTOS COUPLES SHARED — the shop's Approve screen (owner 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A
 * SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO THEIR SERVICE CARD …").
 *
 * On Shop › Services (`id="couple-photos"`, where the in-app notice lands). A three-column grid of the photos (the
 * approved For Suppliers design, 2026-11-06): a waiting photo carries "Shared by the couple · Approve" ON the photo; an approved
 * one says "✓ On your card" on it. Under each: the card it is for, the couple's credit line, who sees it, and ✕ Decline /
 * ↶ Take off.
 * An answer changes the row IN PLACE — the screen never resets. The rules (who sees what, no payment, the room is not
 * used) live inside the ⓘ.
 *
 * `couplePhotoShare` is handed in: the page passes the real server action (`app/_actions/couple-photo-share-actions.ts`,
 * op 'answer'), the dev lab a stand-in.
 */

import { useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Explain } from '@/app/_components/explain';
import type { CouplePhotoShareReply, CouplePhotoShareRequest } from '@/lib/couple-photo-share';

export type ShopCouplePhoto = {
  shareId: string;
  state: 'waiting' | 'approved';
  imageUrl: string;
  creditLine: string;
  serviceTitle: string;
  /** Who the couple lets see it on the card (Only hosts · Exclusive · Private · Public) — theirs to change. */
  audienceLabel?: string;
};

export function CouplePhotosList({
  photos,
  couplePhotoShare,
}: {
  photos: ShopCouplePhoto[];
  couplePhotoShare: (req: CouplePhotoShareRequest) => Promise<CouplePhotoShareReply>;
}) {
  const [rows, setRows] = useState(photos);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, { tone: 'ok' | 'bad'; text: string }>>({});
  const waiting = rows.filter((r) => r.state === 'waiting').length;

  const act = async (row: ShopCouplePhoto, approve: boolean) => {
    if (busy) return;
    setBusy(row.shareId);
    try {
      const reply = await couplePhotoShare({ op: 'answer', shareId: row.shareId, approve });
      const r = reply.op === 'answer' ? reply.result : { status: 'refused' as const, message: 'That did not go through — nothing changed. Try again.' };
      if (r.status === 'ok') {
        setRows((all) => (approve ? all.map((x) => (x.shareId === row.shareId ? { ...x, state: 'approved' } : x)) : all.filter((x) => x.shareId !== row.shareId)));
        setSaid((s) => ({ ...s, [row.shareId]: { tone: 'ok', text: r.line } }));
      } else {
        setSaid((s) => ({ ...s, [row.shareId]: { tone: 'bad', text: r.message } }));
      }
    } catch {
      setSaid((s) => ({ ...s, [row.shareId]: { tone: 'bad', text: 'That did not go through — nothing changed. Try again.' } }));
    } finally {
      setBusy(null);
    }
  };

  const gone = Object.entries(said).filter(([id]) => !rows.some((r) => r.shareId === id));

  return (
    <section id="couple-photos" className="mx-auto flex w-full max-w-3xl flex-col gap-2 scroll-mt-24" data-couple-photos="">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-[17px] font-semibold text-ink">
          Photos couples shared
          {waiting > 0 ? <span className="ml-1.5 text-sm font-normal text-ink/70">· {waiting} waiting</span> : null}
        </h2>
        <Explain title="Photos couples shared">
          A couple on one of your events shared their own photo of your work for one of your service cards. Approve it
          and it shows on that card with their credit line; until you approve, or if you decline, it shows nowhere. The
          couple can take it back at any time, and chooses who sees it on your card (Only hosts · Exclusive · Private ·
          Public) — you and your team always see it. It does not use your page-photo room. There is no payment either way — if
          you want to thank them, a Gift from your shop is the way, never cash.
        </Explain>
      </div>
      {/* ▦ THE APPROVED DESIGN'S SAMPLE GALLERY (For Suppliers prototype 2026-11-06, `.sgal` / `.sgrid`): three columns
          of large square photos, and the answer sits ON the photo — a waiting one wears the white plate "Shared by the
          couple · Approve" (`.appr`); an approved one wears its mark where the card's "✓ Verified booking" sits (`.vbm`).
          Decline (waiting) and Take off (approved) stay — the ✕ / ↶ beside the caption — so the shop never loses the way to say no. */}
      <ul className="grid grid-cols-3 gap-1" data-couple-photo-grid="">
        {rows.map((r) => (
          <li key={r.shareId} className="flex min-w-0 flex-col gap-1" data-couple-photo={r.state}>
            <div className="relative aspect-square overflow-hidden rounded-md bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- the couple's own photo, from their board */}
              <img src={r.imageUrl} alt={`Shared by ${r.creditLine} for “${r.serviceTitle}”`} className="absolute inset-0 h-full w-full object-cover" />
              {r.state === 'waiting' ? (
                <div
                  className="absolute inset-x-1 bottom-1 z-[1] grid gap-0.5 rounded-md bg-cream/95 p-1 [&_.ab]:w-full"
                  data-couple-photo-answer={r.shareId}
                >
                  <small className="px-0.5 text-xs font-semibold leading-[1.1] text-ink/70">Shared by the couple</small>
                  <ActionButton tone="brand" main icon={Check} label="Approve" name={`Approve the photo for ${r.serviceTitle}`} disabled={busy !== null} onClick={() => void act(r, true)} />
                </div>
              ) : (
                <span className="absolute bottom-1 left-1 right-1 z-[1] w-fit max-w-full rounded-lg bg-cream/95 px-1.5 py-0.5 text-xs font-semibold leading-[1.2] text-[rgb(var(--color-ok))] shadow-sm" data-couple-photo-on-card="">
                  ✓ On your card
                </span>
              )}
            </div>
            <div className="flex items-start gap-1">
              <span className="min-w-0 flex-1 text-xs leading-snug">
                <b className="line-clamp-2 font-medium text-ink" title={r.serviceTitle}>{r.state === 'waiting' ? `For “${r.serviceTitle}”` : `On “${r.serviceTitle}”`}</b>
                <span className="block truncate text-ink/70" title={r.creditLine}>Credit: {r.creditLine}</span>
                {r.audienceLabel ? <span className="block truncate text-ink/70">Seen by: {r.audienceLabel}</span> : null}
              </span>
              {r.state === 'waiting' ? (
                <ActionButton tone="neutral" quiet iconOnly icon={X} label="Decline" name={`Decline the photo for ${r.serviceTitle}`} disabled={busy !== null} onClick={() => void act(r, false)} />
              ) : (
                <ActionButton tone="neutral" quiet iconOnly icon={Undo2} label="Take off" name={`Take the photo off ${r.serviceTitle}`} disabled={busy !== null} onClick={() => void act(r, false)} />
              )}
            </div>
            {said[r.shareId] ? (
              <p role={said[r.shareId]!.tone === 'bad' ? 'alert' : 'status'} className={`text-xs leading-snug ${said[r.shareId]!.tone === 'bad' ? 'text-danger-700' : 'text-success-700'}`}>
                {said[r.shareId]!.text}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {gone.map(([id, s]) => (
        <p key={id} role="status" className="text-[13px] text-success-700">
          {s.text}
        </p>
      ))}
    </section>
  );
}
