'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, Gift, ShieldCheck, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import {
  GUEST_WISH_ALREADY_GOT,
  GUEST_WISH_HOW,
  guestWishCount,
  guestWishLine,
  guestWishMeter,
  sendSheetLine,
  sendSheetTitle,
  type GuestWish,
  type WishListShape,
} from '@/lib/wish-list-guest';

/**
 * 🎁 THE WISH LIST ON THE GUEST'S E-GIFTS PAGE (owner 2026-10-08, "ok wish list" ·
 * "per item"; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "Guest"; prototype
 * `egifts_wish_list_2026-10-08_fable.html` frames 13–17 · 21–23).
 *
 * It sits ABOVE the ways to give — a wish is what you give toward, the ways are
 * how — in the event's own type and colours, and wears the E-Gifts look the
 * couple already picked in Stages › Style (`shape`; there is no second picker):
 * Rows · Rows with a side rule · Tiles · Ruled.
 *
 *   · each wish: photo (or the one gift glyph) · name · "₱4,000 of ₱4,500 sent"
 *     with a meter, or its price alone, or "Any amount";
 *   · a got wish is dashed, struck through, "Got it ✓ · thank you", at the end —
 *     tapping it only says "Already got — thank you!";
 *   · tap an open wish → "Send for the Air fryer": what is left to reach its
 *     price, then the couple's OWN ways to give exactly as the page draws them.
 *
 * 🔒 THE SHEET'S WAYS ARE THE PAGE'S OWN, HANDED IN (`ways`). The server page
 * builds its cards once — identifiers already withheld from a reader the event
 * does not recognise — and hands the SAME cards here as a rendered node. This
 * file never sees a method, so it cannot show a number the page would not.
 *
 * 🔒 A guest sees ONE figure per wish: what guests say they SENT. `GuestWish`
 * has no field for another guest's name, amount, words or screenshot.
 *
 * "✓ I sent it" (the guest showing the couple their screenshot) is wish list
 * 4/5: until `sent` is handed in, the sheet draws ✕ Close alone and makes no
 * promise about a step that is not there.
 *
 * Guest route — never in the Maker's first load.
 */

const SECTION: Record<WishListShape, string> = {
  rows: '',
  side: '',
  tiles: 'text-center',
  ruled: 'text-center',
};
const LIST: Record<WishListShape, string> = {
  rows: 'mt-2 flex flex-col gap-2',
  side: 'mt-2 flex flex-col gap-1',
  tiles: 'mt-2.5 grid grid-cols-2 gap-2.5',
  ruled: 'mt-2.5 flex flex-col border-y border-gild/70 py-1',
};
/* A wish is a BUTTON (it opens the sheet) — a pressable keeps its radius and hairline. */
const ITEM: Record<WishListShape, { open: string; got: string }> = {
  rows: {
    open: 'flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-cream px-3 py-2.5 text-left', // no-card-ok: a wish is a <button> (it opens the send sheet) — a pressable keeps its radius and hairline
    got: 'flex w-full items-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-transparent px-3 py-2.5 text-left', // no-card-ok: a wish is a <button> (it opens the send sheet) — a pressable keeps its radius and hairline
  },
  side: {
    open: 'flex w-full items-center gap-3 border-l-2 border-gild bg-transparent py-2 pl-3.5 text-left',
    got: 'flex w-full items-center gap-3 border-l-2 border-ink/15 bg-transparent py-2 pl-3.5 text-left',
  },
  tiles: {
    open: 'flex w-full flex-col items-stretch gap-2 rounded-2xl border border-ink/10 bg-cream px-2.5 py-3 text-left', // no-card-ok: a wish is a <button> (it opens the send sheet) — a pressable keeps its radius and hairline
    got: 'flex w-full flex-col items-stretch gap-2 rounded-2xl border border-dashed border-ink/15 bg-transparent px-2.5 py-3 text-left', // no-card-ok: a wish is a <button> (it opens the send sheet) — a pressable keeps its radius and hairline
  },
  ruled: {
    open: 'flex w-full items-center justify-center gap-3 border-t border-ink/10 bg-transparent py-2.5 text-left first:border-t-0',
    got: 'flex w-full items-center justify-center gap-3 border-t border-ink/10 bg-transparent py-2.5 text-left first:border-t-0',
  },
};
const PHOTO: Record<WishListShape, string> = {
  rows: 'h-14 w-14',
  side: 'h-14 w-14',
  tiles: 'h-[110px] w-full',
  ruled: 'h-11 w-11',
};
const WORDS: Record<WishListShape, string> = {
  rows: 'min-w-0 flex-1',
  side: 'min-w-0 flex-1',
  tiles: 'min-w-0',
  ruled: 'min-w-0 flex-[0_1_200px]',
};

export function WishList({
  wishes,
  shape,
  hostName,
  hostPossessive,
  ways,
  sent,
}: {
  /** Open wishes first, then the got ones (`guestWishListFrom`). Never empty — the page draws no list for none. */
  wishes: readonly GuestWish[];
  shape: WishListShape;
  /** "Maria & Jose" — or this event type's word for whoever is throwing it. */
  hostName: string;
  /** "Maria & Jose’s" / "the couple’s". */
  hostPossessive: string;
  /** The page's own ways to give, already drawn (identifiers withheld exactly as the page withholds them). */
  ways: ReactNode;
  /**
   * Wish list 4/5: the foot's "✓ I sent it" — given the wish it was pressed for.
   * Absent = the sheet closes and that is all.
   */
  sent?: (wish: GuestWish) => ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [saidGot, setSaidGot] = useState<string | null>(null);
  const open = openId ? (wishes.find((w) => w.id === openId) ?? null) : null;
  const count = guestWishCount(wishes);
  const arrow = shape === 'rows' || shape === 'side';

  return (
    <section id="wishlist" data-wish-list="" data-wish-look={shape} className={`mb-8 ${SECTION[shape]}`}>
      <p className={`flex items-baseline font-mono text-xs uppercase tracking-[0.2em] text-terracotta-700 ${shape === 'tiles' || shape === 'ruled' ? 'justify-center' : ''}`}>
        <span>Wish list</span>
        {count ? (
          <small data-wish-count="" className={`${shape === 'tiles' || shape === 'ruled' ? 'ml-2' : 'ml-auto'} font-sans text-xs font-normal normal-case tracking-normal text-ink/55`}>
            {count}
          </small>
        ) : null}
      </p>
      <div className={LIST[shape]}>
        {wishes.map((w) => {
          const meter = guestWishMeter(w);
          const said = w.got && saidGot === w.id;
          return (
            <button
              key={w.id}
              type="button"
              data-wish={w.got ? 'got' : 'open'}
              onClick={() => {
                if (w.got) setSaidGot(w.id);
                else setOpenId(w.id);
              }}
              className={w.got ? ITEM[shape].got : ITEM[shape].open}
            >
              <span
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gild/15 ${PHOTO[shape]} ${w.got ? 'opacity-50 grayscale' : ''}`}
              >
                {w.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the couple's own upload in the public media bucket
                  <img src={w.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Gift aria-hidden data-wish-no-photo="" className="h-6 w-6 text-gild" strokeWidth={1.5} />
                )}
              </span>
              <span className={WORDS[shape]}>
                <b
                  className={`block font-display text-[19px] font-medium leading-tight ${
                    w.got ? 'text-ink/50 line-through decoration-1' : 'text-ink'
                  }`}
                >
                  {w.name}
                </b>
                <span
                  {...(said ? { role: 'status' } : {})}
                  className={`mt-0.5 block text-[13px] ${w.got ? 'font-semibold text-success-700' : 'text-ink/70'}`}
                >
                  {said ? GUEST_WISH_ALREADY_GOT : guestWishLine(w)}
                </span>
                {meter ? (
                  <span aria-hidden data-wish-meter={meter.got ? 'got' : 'filling'} className="mt-1.5 block h-1 overflow-hidden rounded-full bg-ink/10">
                    <i className={`block h-full rounded-full ${meter.got ? 'bg-success-600' : 'bg-mulberry'}`} style={{ width: `${meter.percent}%` }} />
                  </span>
                ) : null}
              </span>
              {arrow ? <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} /> : null}
            </button>
          );
        })}
      </div>
      <p data-wish-how="" className="mt-3 text-center text-[13px] text-ink/55">
        {GUEST_WISH_HOW}
      </p>

      {open ? (
        <div data-wish-send="" className="relative z-[60] text-left">
          <Sheet open onClose={() => setOpenId(null)} labelledById="wish-send-title" wide rise>
            <div className="px-5 pt-5">
              <h2 id="wish-send-title" className="pr-10 font-display text-2xl font-medium italic leading-tight text-mulberry">
                {sendSheetTitle(open)}
              </h2>
              <SendLine wish={open} hostPossessive={hostPossessive} />
              <div className="mt-3">{ways}</div>
              <p className="flex items-start gap-2.5 pt-3 text-[13px] leading-snug text-ink/70">
                <ShieldCheck aria-hidden className="mt-px h-4 w-4 shrink-0 text-success-700" strokeWidth={1.75} />
                <span>
                  <b className="font-semibold text-ink">Setnayan never touches your money.</b>
                  {sent ? ` Once you’ve sent it, show ${hostName} your screenshot — that is how this wish fills up.` : null}
                </span>
              </p>
              <div data-wish-send-foot="" className="sn-glass-row sticky bottom-0 -mx-5 mt-5 flex gap-2 px-5 py-3">
                <button
                  type="button"
                  data-wish-send-close=""
                  onClick={() => setOpenId(null)}
                  className="sn-press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15"
                >
                  <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                  Close
                </button>
                {sent ? sent(open) : null}
              </div>
            </div>
          </Sheet>
        </div>
      ) : null}
    </section>
  );
}

/** "₱500 more reaches ₱4,500 · any amount helps — it goes straight to Maria & Jose's own account. "the 6 L one, black"" */
function SendLine({ wish, hostPossessive }: { wish: GuestWish; hostPossessive: string }) {
  const line = sendSheetLine(wish, hostPossessive);
  return (
    <p data-wish-send-line="" className="mt-2 text-[13.5px] leading-snug text-ink/70">
      {line.lead ? <b className="font-semibold text-ink">{line.lead}</b> : null}
      {line.rest}
      {wish.note ? <i> &ldquo;{wish.note}&rdquo;</i> : null}
    </p>
  );
}
