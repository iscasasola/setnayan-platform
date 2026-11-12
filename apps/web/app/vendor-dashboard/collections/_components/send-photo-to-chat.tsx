'use client';

import { createContext, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { PANEL_BTN, PANEL_MAIN, PANEL_ROW, PanelHead } from '@/app/_components/gallery/photo-viewer';
import { guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { SHARE_WORDS, ShareTargetList, shareRefusal, sharedToast } from '../../services/_components/service-card-share-sheet';
import { shareExtension } from '@/lib/memories-viewer';
import type { ShareTarget } from '@/lib/service-share-targets';
import type { OfferServiceResult } from '@/lib/offer-service-core';

/**
 * 💬 SEND TO A CHAT — a portfolio photo into ONE picked client chat (ruling 5951; owner 9 Nov, approved Portfolio v3:
 * *"Share will go to their picked chatbox. they search for it or find it manually"*).
 *
 * A panel risen INSIDE the shared photo viewer (`PhotoViewer`'s `panel`), drawn the prototype's way:
 *   head "Send to a chat" · "1 photo · the couple sees it in the chat" → THE card share list (`ShareTargetList`, with its
 *   search box — never a second chat list) → a pick opens the confirm: "Send 1 photo to <client>", an optional note,
 *   Back · Send.
 *   · the rows are `readShareTargets`'s accepted, not-removed chats; the server re-checks the pick (`sharePhotoCore`,
 *     reached through the shipped `offerServiceInterest` with `via=photo` — no new server action);
 *   · the photo is fetched at Send from the copy on screen and posted as an ordinary chat photo;
 *   · a refusal stays in the panel on its own line; success closes it and the toast says "Posted in <client>’s chat" —
 *     NEVER "notified" (`sharedToast(name, 0)`: this door has no evidence of who was told).
 * 🔒 app/_components/gallery/a-photo-goes-to-a-picked-chat.test.ts
 */
export type PhotoChatShare = {
  /** This shop's client chats; `null` = the read failed (said, never drawn as "no chats"). */
  targets: readonly ShareTarget[] | null;
  /** The shipped `offerServiceInterest` (a lab hands in a stand-in). */
  share: (fd: FormData) => Promise<OfferServiceResult>;
};

/** Handed down by the Portfolio page; absent (a lab, another surface) = no Send to a chat button. */
export const PhotoChatContext = createContext<PhotoChatShare | null>(null);

export const PHOTO_CHAT_WORDS = {
  title: 'Send to a chat',
  line: '1 photo · the couple sees it in the chat',
  fetchFailed: 'We couldn’t get the photo just now — nothing was sent. Try again.',
  tooLarge: 'This photo is too large to send from here — nothing was sent.',
} as const;

/** A server action body is capped at 6 MB (next.config `bodySizeLimit`); leave room for the form around the file. */
const MAX_BYTES = 5.5 * 1024 * 1024;

export function SendPhotoToChat({ url, share, onDone }: { url: string; share: PhotoChatShare; onDone: () => void }) {
  const [picked, setPicked] = useState<ShareTarget | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function send() {
    if (!picked || sending) return;
    setSending(true);
    setRefusal(null);
    let file: File;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (blob.size > MAX_BYTES) {
        setSending(false);
        setRefusal(PHOTO_CHAT_WORDS.tooLarge);
        return;
      }
      const type = blob.type || 'image/jpeg';
      file = new File([blob], `photo.${shareExtension(type)}`, { type });
    } catch {
      setSending(false);
      setRefusal(PHOTO_CHAT_WORDS.fetchFailed);
      return;
    }
    const fd = new FormData();
    fd.set('thread_id', picked.threadId);
    fd.set('via', 'photo');
    fd.set('photo', file);
    if (note.trim()) fd.set('note', note.trim());
    let r: OfferServiceResult;
    try {
      r = await share.share(fd);
    } catch {
      r = { status: 'error', message: 'We could not send your photo just now. Nothing was sent — try again.' };
    }
    setSending(false);
    if (r.status !== 'ok') {
      setRefusal(shareRefusal(r));
      return;
    }
    onDone();
    guestToast.success(sharedToast(picked.name, r.notified));
  }

  const targets = share.targets;
  return (
    <div data-photo-chat="">
      <PanelHead title={PHOTO_CHAT_WORDS.title} line={PHOTO_CHAT_WORDS.line} />
      {targets === null ? (
        <p role="status" className="pb-2 text-[14px] leading-snug" data-photo-chat-unread="">
          {SHARE_WORDS.unread}
        </p>
      ) : targets.length === 0 ? (
        <p role="status" className="pb-2 text-[14px] leading-snug" data-photo-chat-empty="">
          {SHARE_WORDS.empty}
        </p>
      ) : picked ? (
        <div className="pb-1" data-photo-chat-confirm={picked.threadId}>
          <p className="pb-2 text-[15px] font-semibold">Send 1 photo to {picked.name}</p>
          {/* field-ok: the note IS the chat message's words — the chat composer's own one-line box, inside the dark viewer panel */}
          <input
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            maxLength={500}
            placeholder="Add a note · optional"
            aria-label="Note"
            enterKeyHint="send"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
            className="mb-3 h-11 w-full rounded-xl bg-white/10 px-3 text-[15px] text-white outline-none placeholder:text-white/45"
            data-photo-chat-note=""
          />
          <div className={PANEL_ROW}>
            <button type="button" className={PANEL_BTN} disabled={sending} onClick={() => setPicked(null)}>
              Back
            </button>
            <button type="button" className={PANEL_MAIN} disabled={sending} aria-busy={sending || undefined} onClick={() => void send()} data-photo-chat-send="">
              {sending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Send aria-hidden className="h-4 w-4" strokeWidth={2} />}
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="max-h-[46dvh] overflow-y-auto" data-photo-chat-list="">
          <ShareTargetList tone="ink" targets={targets} pending={null} onPick={(t) => { setRefusal(null); setPicked(t); }} />
        </div>
      )}
      {refusal ? (
        <p role="alert" className="whitespace-pre-line pt-2 text-[13px] leading-snug text-[color:var(--sn-ob-cta)]" data-photo-chat-refusal="">
          {refusal}
        </p>
      ) : null}
      {!picked ? (
        <div className={`${PANEL_ROW} pt-2`}>
          <button type="button" className={PANEL_BTN} onClick={onDone}>
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
