'use client';

/**
 * 📸 PHOTOS COUPLES SHARED — the shop's Approve screen (owner 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A
 * SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO THEIR SERVICE CARD …").
 *
 * On Shop › Services (`id="couple-photos"`, where the in-app notice lands). Waiting photos first, each: the photo, the
 * card it is for, the couple's credit line, then Approve · Decline. Approved ones say "On your card" with Take off.
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
          {waiting > 0 ? <span className="ml-1.5 text-[14px] font-normal text-ink/55">· {waiting} waiting</span> : null}
        </h2>
        <Explain title="Photos couples shared">
          A couple on one of your events shared their own photo of your work for one of your service cards. Approve it
          and it shows on that card with their credit line; until you approve, or if you decline, it shows nowhere. The
          couple can take it back at any time, and chooses who sees it on your card (Only hosts · Exclusive · Private ·
          Public) — you and your team always see it. It does not use your page-photo room. There is no payment either way — if
          you want to thank them, a Gift from your shop is the way, never cash.
        </Explain>
      </div>
      <ul className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
        {rows.map((r) => (
          <li key={r.shareId} className="flex flex-col gap-2 py-3" data-couple-photo={r.state}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- the couple's own photo, from their board */}
              <img src={r.imageUrl} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />
              <span className="min-w-0 flex-1 text-[14px] leading-snug">
                <b className="block font-medium text-ink">{r.state === 'waiting' ? `For “${r.serviceTitle}”` : `On “${r.serviceTitle}”`}</b>
                <span className="block text-ink/60">Credit: {r.creditLine}</span>
                {r.audienceLabel ? <span className="block text-[13px] text-ink/50">Seen by: {r.audienceLabel}</span> : null}
              </span>
            </div>
            {r.state === 'waiting' ? (
              <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&_.ab]:w-full" data-couple-photo-answer={r.shareId}>
                <ActionButton tone="ok" main icon={Check} label="Approve" name={`Approve the photo for ${r.serviceTitle}`} disabled={busy !== null} onClick={() => void act(r, true)} />
                <ActionButton tone="neutral" icon={X} label="Decline" name={`Decline the photo for ${r.serviceTitle}`} disabled={busy !== null} onClick={() => void act(r, false)} />
              </div>
            ) : (
              <div className="flex justify-end">
                <ActionButton tone="neutral" quiet icon={Undo2} label="Take off" name={`Take the photo off ${r.serviceTitle}`} disabled={busy !== null} onClick={() => void act(r, false)} />
              </div>
            )}
            {said[r.shareId] ? (
              <p role={said[r.shareId]!.tone === 'bad' ? 'alert' : 'status'} className={`text-[13px] ${said[r.shareId]!.tone === 'bad' ? 'text-danger-700' : 'text-success-700'}`}>
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
