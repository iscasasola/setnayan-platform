'use client';

/**
 * 🔗 SHARE TO A CLIENT EVENT — the sheet the Share icon under a card opens (owner 2026-11-11, verbatim: *"Share does not
 * share to anyone. It is share to an client event. To enter to a chat. That is notified so the client can see."*;
 * approved prototype frame G, `prototypes/service_card_row_2026-11-11/index.html`).
 *
 *   · the house bottom `Sheet`, head "Share to a client event";
 *   · one line: Posts “<card>” into their chat. They get a notice.;
 *   · this shop's client events (`readShareTargets`), one row each — initials · event name · date · chevron. A tap posts
 *     the card into THAT event's chat — the SHIPPED offer (`offerServiceInterest` with `via=share` → `offerServiceCore`,
 *     which re-checks the chat is open) — and the client is told IN THE APP (`service_card_shared`, never an email);
 *   · then the sheet closes and the toast says "<Client> notified" (frame H's line). If nobody could be told (an event
 *     with no host on it), it says "Posted in <Client>'s chat" — never "notified" on no evidence.
 *
 * An unread list says so (never "no client events" to a shop that has them); an empty one says how a client event
 * comes to be there. A refusal (an Offline card, a closed chat) stays in the sheet, on its own line.
 *
 * 🔒 app/vendor-dashboard/services/share-posts-the-card-into-a-client-chat.test.ts
 */
import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import type { ShareTarget } from '@/lib/service-share-targets';
import type { OfferServiceResult } from '@/lib/offer-service-core';

export type ServiceCardShareProps = {
  /** This shop's client events; `null` = the read failed. */
  targets: readonly ShareTarget[] | null;
  /** The server's post — the shipped `offerServiceInterest` (a lab hands in a stand-in). */
  share: (fd: FormData) => Promise<OfferServiceResult>;
};

export const SHARE_WORDS = {
  title: 'Share to a client event',
  unread: 'We could not load your client events just now. Close this and try again in a moment.',
  empty: 'No client events yet. An event shows here once you accept a couple’s inquiry.',
  /** Said before any pick on an Offline card — the server refuses it the same (`offerServiceCore`: online cards only). */
  offline: 'This card is Offline. Turn it Online, then share it.',
} as const;

/** What a refused post says, in place, from the shipped offer's answer. `null` = it posted. */
export function shareRefusal(r: OfferServiceResult): string | null {
  switch (r.status) {
    case 'ok':
      return null;
    case 'invalid_service':
      return SHARE_WORDS.offline;
    case 'not_owner':
      return 'That chat is not one of yours any more, so nothing was posted. Refresh and pick again.';
    case 'not_signed_in':
      return 'Sign in again, then share.';
    default:
      return r.message;
  }
}

/** The toast after a post — frame H's "<Client> notified", said only when somebody was. */
export function sharedToast(clientName: string, notified: number): string {
  return notified > 0 ? `${clientName} notified` : `Posted in ${clientName}’s chat`;
}

export function ServiceCardShareSheet({
  open,
  onClose,
  labelledById,
  vendorServiceId,
  cardName,
  isActive,
  targets,
  share,
}: ServiceCardShareProps & {
  open: boolean;
  onClose: () => void;
  labelledById: string;
  vendorServiceId: string;
  cardName: string;
  /** An Offline card cannot be shared — said at once, no list to pick from. */
  isActive: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setRefusal(null);
    onClose();
  }

  async function pick(t: ShareTarget) {
    if (pending) return;
    setPending(t.threadId);
    setRefusal(null);
    const fd = new FormData();
    fd.set('thread_id', t.threadId);
    fd.set('vendor_service_id', vendorServiceId);
    fd.set('via', 'share');
    let r: OfferServiceResult;
    try {
      r = await share(fd);
    } catch {
      r = { status: 'error', message: 'We could not post your card just now. Nothing was sent — try again.' };
    }
    setPending(null);
    if (r.status !== 'ok') {
      setRefusal(shareRefusal(r));
      return;
    }
    onClose();
    guestToast.success(sharedToast(t.name, r.notified));
  }

  return (
    <Sheet open={open} onClose={close} labelledById={labelledById} title={SHARE_WORDS.title} rise>
      <div className="space-y-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1" data-card-share-sheet={vendorServiceId}>
        <p className="text-[13px] leading-snug text-ink/65" data-card-share-line="">
          {`Posts “${cardName}” into their chat. They get a notice.`}
        </p>
        {!isActive ? (
          <p role="status" className="py-2 text-[14px] leading-snug text-ink/75" data-card-share-offline="">
            {SHARE_WORDS.offline}
          </p>
        ) : targets === null ? (
          <p role="status" className="py-2 text-[14px] leading-snug text-ink/75" data-card-share-unread="">
            {SHARE_WORDS.unread}
          </p>
        ) : targets.length === 0 ? (
          <p role="status" className="py-2 text-[14px] leading-snug text-ink/75" data-card-share-empty="">
            {SHARE_WORDS.empty}
          </p>
        ) : (
          <ul className="divide-y divide-ink/10" data-card-share-list="">
            {targets.map((t) => (
              <li key={t.threadId}>
                <button
                  type="button"
                  onClick={() => void pick(t)}
                  disabled={pending !== null && pending !== t.threadId}
                  aria-busy={pending === t.threadId || undefined}
                  className="sn-press flex min-h-[52px] w-full items-center gap-2.5 px-0.5 py-2 text-left disabled:opacity-50"
                  data-card-share-target={t.threadId}
                >
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-terracotta/10 text-[11px] font-semibold text-terracotta-700"
                  >
                    {t.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{t.name}</span>
                    {t.dateLabel ? (
                      <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/50">{t.dateLabel}</span>
                    ) : null}
                  </span>
                  {pending === t.threadId ? (
                    <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-ink/45" strokeWidth={2} />
                  ) : (
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {refusal ? (
          <p role="alert" className="whitespace-pre-line text-[12.5px] leading-snug text-terracotta-700" data-card-share-refusal="">
            {refusal}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
