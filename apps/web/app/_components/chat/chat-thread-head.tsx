import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * THE ONE CHAT HEAD — ‹ · avatar · name · one muted line · actions (owner 2026-10-28, verbatim: *"Same as our
 * chatbox"* — ONE chat look in the app; chat prototype 2026-10-28 frame B). Both thread routes (the couple's
 * `/dashboard/[eventId]/messages/[threadId]` and the supplier's `/vendor-dashboard/messages/[threadId]`) mount THIS,
 * inside the one `ChatBox`, with the one `ChatMessageStream` and `ChatSendForm` — and the group chatroom is to switch
 * to the same pieces (`app/_components/chat/thread-kit.ts`). `lib/one-chat-look-on-every-thread.test.ts` holds it.
 *
 * 📏 NOTHING IN THE HEAD IS CUT (walk 2026-11-01): on a phone the supplier's head carries the labelled "Customer"
 * pill (it must stay labelled — `the-mobile-tools-trigger-is-labelled.test.ts`), and the name ("Ana's Wedding (Dec
 * 12)") and the line both ran out of room — the name ended in "…" and the date was sliced mid-digit ("December 1").
 * So the name may take two lines and the line wraps WHOLE pieces (each piece never breaks inside itself, and a
 * wrapped row never opens on a separator). Held by
 * `lib/the-chat-head-never-cuts-the-name-or-date.test.ts`.
 *
 * Server-safe (no hooks): every slot is whatever the page passes. The avatar is INITIALS, never a logo — a logo is as
 * identifying as the name it stands for, and the name here is already the reveal-safe one.
 */
export function ChatThreadHead({
  back,
  name,
  nameHref,
  initials,
  line,
  below,
  actions,
}: {
  /**
   * The ‹ — the page's own `<BackButton route="<this page>" variant="chat" />` (its link from `lib/page-home.ts`, the
   * one map of where every back goes), passed in so the route is written in the page that owns it.
   */
  back: ReactNode;
  /** The other side, as it may be shown (anonymity-safe), plus any badge beside it. */
  name: ReactNode;
  /** Pressing the name opens this (the supplier's customer card for the event). Absent → plain text. */
  nameHref?: string;
  initials: string;
  /** The one muted line — dot-separated children (service · date · guests). */
  line?: ReactNode;
  /** A side's own second row under the line (the supplier's private source chips). Optional. */
  below?: ReactNode;
  /** The head's actions, right — the chat menu (and the supplier's info rail on a phone). */
  actions: ReactNode;
}) {
  return (
    <>
      {back}
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.1] text-[13px] font-semibold text-ink/75"
        data-chat-head-avatar=""
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1" data-chat-head="">
        {nameHref ? (
          <Link href={nameHref} className="line-clamp-2 break-words text-[16px] font-semibold leading-tight text-ink hover:underline" data-chat-head-name="">
            {name}
          </Link>
        ) : (
          <p className="line-clamp-2 break-words text-[16px] font-semibold leading-tight text-ink" data-chat-head-name="">
            {name}
          </p>
        )}
        {line ? (
          /* Every piece wears its own "·" in a 12px lead, and the row is pulled 12px left inside a clipping box: a
             piece that WRAPS to the start of a row has its dot clipped away, so no row ever opens on a stray "·". */
          <p className="min-w-0 overflow-hidden text-[12px] leading-tight text-ink/55">
            <span
              className="-ml-3 flex flex-wrap items-center [&>*]:whitespace-nowrap [&>*]:before:inline-block [&>*]:before:w-3 [&>*]:before:text-center [&>*]:before:content-['·']"
              data-chat-head-line=""
            >
              {line}
            </span>
          </p>
        ) : null}
        {below ?? null}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </>
  );
}
