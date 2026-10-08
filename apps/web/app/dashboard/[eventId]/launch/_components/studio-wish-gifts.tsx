'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronRight, Image as ShotGlyph, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { cleanGiftAmount } from '@/lib/gift-record';
import { formatPhp } from '@/lib/php';
import { STUDIO_DONE_BUTTON } from '@/lib/studio-skin';
import {
  GIFTS_REMOVED_HEAD,
  GIFTS_SENT_FOOT,
  GIFTS_SENT_TIP,
  GIFTS_SENT_TITLE,
  GIFT_AMOUNT_HINT,
  GIFT_AMOUNT_LABEL,
  GIFT_AMOUNT_NOT_A_NUMBER,
  GIFT_ANY,
  GIFT_TOWARD_LABEL,
  GIFT_NO_SHOT,
  GIFT_REMOVED_LINE,
  GIFT_SHOT_IS_NOT_MONEY,
  GIFT_SHOT_LOADING,
  GIFT_SHOT_UNREAD,
  giftRowLine,
  giftWhenLine,
  giftsSentLeadParts,
  type StudioWish,
  type StudioWishGift,
} from '@/lib/wish-list-studio';
import { FIELD, FOOT, LABEL, WishSheet } from './studio-wish-sheet';

/**
 * 🎁 STUDIO › E-GIFTS › GIFTS SENT TO YOU (owner 2026-10-08: "yes. it will
 * accumulate all the gift and mark them one by one"; design
 * `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "One gift open" · "Gifts sent to
 * you"; prototype frames 05 · 07 · 08).
 *
 *   · a gift's ROW — a small mark that says a screenshot was added (or the words
 *     "no shot"), who, the way and when, their words, the amount and the word
 *     "sent". A row is a button. A row draws NO picture: a list of pictures is a
 *     request per row, and there is no stored thumbnail to show;
 *   · GIFTS SENT TO YOU — every record, newest first, with what guests say they
 *     sent in all; removed ones wait at the end so they can be put back;
 *   · ONE GIFT, OPEN — the screenshot large, their words, "Amount they said"
 *     (kept when the field is left — no Save), "Counts toward" (another wish, or
 *     "Any gift"), 🗑 Remove in two taps, and for a removed one, Put it back.
 *
 * 🔒 ONLY THE COUPLE, AND ONLY THE GIFT THAT IS OPEN. The screenshot is asked for
 * when ONE gift's sheet opens (`onShot` — one request, through the E-Gifts page's
 * one door): a short-lived signed address the server makes for a host. There is
 * no public address for it anywhere, and none is made for a row of a list.
 *
 * The word is "sent". A screenshot is what a guest showed the couple — this
 * screen never says a gift arrived, and tells them where the truth is.
 *
 * Writes are the parent's (it owns the E-Gifts page's one door); this file
 * imports no server action. Lazy: it rides the `maker-details` chunk.
 */

const THUMB = 'flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-white px-0.5 text-center text-[10px] leading-tight text-ink/50';

/**
 * The small frame at the head of a row: a mark that a screenshot was added, or
 * the words "no shot". Never the picture — that is the opened gift's alone.
 */
function GiftThumb({ gift }: { gift: StudioWishGift }) {
  return (
    <span data-wish-gift-shot={gift.hasShot ? 'yes' : 'none'} className={THUMB}>
      {gift.hasShot ? (
        <>
          <ShotGlyph aria-hidden className="h-5 w-5 text-ink/45" strokeWidth={1.6} />
          <span className="sr-only">screenshot added</span>
        </>
      ) : (
        'no shot'
      )}
    </span>
  );
}

/** One gift, as a row that opens it. `line` is what sits under the name. */
export function GiftRow({ gift, line, onOpen }: { gift: StudioWishGift; line: string; onOpen: () => void }) {
  return (
    <li data-gift-row={gift.removed ? 'removed' : 'counted'} className="border-t border-ink/10 first:border-t-0">
      <button type="button" data-gift-open={gift.id} onClick={onOpen} className={`flex w-full items-start gap-3 py-2.5 text-left ${gift.removed ? 'opacity-55' : ''}`}>
        <GiftThumb gift={gift} />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className={`truncate text-[14.5px] font-semibold text-ink ${gift.removed ? 'line-through' : ''}`}>{gift.giverName}</b>
          <span className="truncate text-[12.5px] text-ink/60">{line}</span>
          {gift.message ? <em className="truncate text-[13px] text-ink/80">&ldquo;{gift.message}&rdquo;</em> : null}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <b className="text-[14.5px] font-semibold text-ink">{formatPhp(gift.amountPhp)}</b>
          <small className="text-[11px] text-ink/50">{gift.removed ? 'removed' : 'sent'}</small>
        </span>
      </button>
    </li>
  );
}

/** The row under the wish list: "Gifts sent to you · ₱14,500 said sent · 5 gifts ›". */
export function GiftsSentDoor({ summary, onOpen }: { summary: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-studio-gifts-sent=""
      onClick={onOpen}
      className="mt-3.5 flex min-h-12 w-full items-center gap-3 border-t border-ink/10 py-2 text-left"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[14.5px] font-semibold text-ink">{GIFTS_SENT_TITLE}</b>
        <span className="text-[12.5px] text-ink/60">{summary}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
    </button>
  );
}

/** Every record, newest first — and ✓ Done back to the wish list. */
export function GiftsSent({
  gifts,
  wishes,
  sentPhp,
  counted,
  onOpen,
  onDone,
}: {
  /** Every record of the event, newest first (removed ones included). */
  gifts: readonly StudioWishGift[];
  wishes: readonly Pick<StudioWish, 'id' | 'name'>[];
  /** What guests say they sent in all (removed records never count). */
  sentPhp: number;
  counted: number;
  onOpen: (giftId: string) => void;
  onDone: () => void;
}) {
  const live = gifts.filter((g) => !g.removed);
  const removed = gifts.filter((g) => g.removed);
  const lead = giftsSentLeadParts(sentPhp, counted);
  return (
    <div data-gifts-sent="" className="flex flex-col">
      <div className="flex items-start justify-between gap-3 pt-2">
        <h3 className="font-display text-[22px] leading-tight text-ink">{GIFTS_SENT_TITLE}</h3>
        <button type="button" data-gifts-sent-done="" onClick={onDone} className={STUDIO_DONE_BUTTON}>
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} />
          Done
        </button>
      </div>
      <p className="flex flex-wrap items-center gap-x-1 pb-1 pt-1.5 text-[13.5px] leading-snug text-ink/65">
        <span>
          {lead.before}
          {lead.sent ? <b className="font-semibold text-ink">{lead.sent}</b> : null}
          {lead.after}
        </span>
        <InfoTip label="About these gifts" align="start">
          {GIFTS_SENT_TIP}
        </InfoTip>
      </p>
      {live.length > 0 ? (
        <ul data-gifts-sent-rows="" className="mt-1 flex flex-col">
          {live.map((g) => (
            <GiftRow key={g.id} gift={g} line={giftRowLine(g, wishes)} onOpen={() => onOpen(g.id)} />
          ))}
        </ul>
      ) : null}
      {removed.length > 0 ? (
        <>
          <p className="pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">{GIFTS_REMOVED_HEAD}</p>
          <ul data-gifts-removed-rows="" className="flex flex-col">
            {removed.map((g) => (
              <GiftRow key={g.id} gift={g} line={giftRowLine(g, wishes)} onOpen={() => onOpen(g.id)} />
            ))}
          </ul>
        </>
      ) : null}
      <p className="px-2 pb-1 pt-4 text-center text-[12.5px] leading-snug text-ink/55">{GIFTS_SENT_FOOT}</p>
    </div>
  );
}

/**
 * One gift, open. The amount is kept when its field is left and when the sheet
 * closes; "Counts toward" is kept at the pick. Each returns what the server said
 * if it refused — said here, in place.
 */
export function OpenGift({
  gift,
  wishes,
  onClose,
  onAmount,
  onMove,
  onRemove,
  onShot,
}: {
  gift: StudioWishGift;
  wishes: readonly Pick<StudioWish, 'id' | 'name'>[];
  onClose: () => void;
  onAmount: (amountPhp: number) => Promise<string | null>;
  onMove: (wishId: string | null) => Promise<string | null>;
  onRemove: (removed: boolean) => Promise<string | null>;
  /** Ask for THIS gift's screenshot — resolves to its address (null = none), rejects when it could not be loaded. */
  onShot: () => Promise<string | null>;
}) {
  /* 🖼 ONE PICTURE, FOR THE ONE GIFT THAT IS OPEN — asked for when this sheet opens, and only
     if the record says it has one. `gift.shotUrl` is the dev lab's stand-in (the server's list
     read never fills it). Nothing retries by itself: a refusal is said, with Try again. */
  const [shot, setShot] = useState<{ state: 'none' | 'loading' | 'unread' } | { state: 'shown'; url: string }>(() =>
    !gift.hasShot ? { state: 'none' } : gift.shotUrl ? { state: 'shown', url: gift.shotUrl } : { state: 'loading' },
  );
  const askShot = useRef(onShot);
  askShot.current = onShot;
  const [shotTry, setShotTry] = useState(0);
  const needsShot = gift.hasShot && !gift.shotUrl;
  useEffect(() => {
    if (!needsShot) return;
    let open = true;
    askShot.current().then(
      (url) => {
        if (open) setShot(url ? { state: 'shown', url } : { state: 'none' });
      },
      () => {
        if (open) setShot({ state: 'unread' });
      },
    );
    return () => {
      open = false;
    };
  }, [needsShot, shotTry]);

  const [typed, setTyped] = useState(String(gift.amountPhp));
  const kept = useRef(gift.amountPhp);
  const [refused, setRefused] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const id = useId();
  const when = giftWhenLine(gift);
  const toward: PickOption[] = [...wishes.map((w) => ({ key: w.id, label: w.name })), { key: '', label: GIFT_ANY }];

  /** Keep the typed amount, when it differs from what is kept. */
  const keep = async (): Promise<boolean> => {
    const next = cleanGiftAmount(typed);
    if (next === undefined) {
      setRefused(GIFT_AMOUNT_NOT_A_NUMBER);
      return false;
    }
    if (next === kept.current) return true;
    setRefused(null);
    const said = await onAmount(next);
    if (said) {
      setRefused(said);
      return false;
    }
    kept.current = next;
    return true;
  };
  const close = async () => {
    if (gift.removed || (await keep())) onClose();
  };

  return (
    <WishSheet
      title={gift.giverName}
      titleId="gift-open-title"
      onClose={() => void close()}
      pill={
        when ? (
          <span data-gift-pill="" className="rounded-full bg-gild/15 px-2.5 py-0.5 text-[12px] font-medium text-ink/60">
            {when}
          </span>
        ) : null
      }
    >
      <div data-gift-open-shot={shot.state} className="mt-3 flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-ink/10 bg-white">
        {shot.state === 'shown' ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, host-only address of the guest's screenshot
          <img
            src={shot.url}
            alt={`The screenshot ${gift.giverName} added`}
            loading="lazy"
            decoding="async"
            onError={() => setShot({ state: 'unread' })}
            className="max-h-[60dvh] w-auto max-w-full object-contain"
          />
        ) : shot.state === 'unread' ? (
          <>
            <span role="alert" className="px-4 pt-5 text-center text-[13px] text-danger-800">
              {GIFT_SHOT_UNREAD}
            </span>
            <ActionButton
              tone="neutral"
              icon={RotateCw}
              label="Try again"
              className="mb-4"
              data-testid="gift-shot-retry"
              onClick={() => {
                setShot({ state: 'loading' });
                setShotTry((n) => n + 1);
              }}
            />
          </>
        ) : (
          <span className="px-4 py-6 text-center text-[13px] text-ink/55">{shot.state === 'loading' ? GIFT_SHOT_LOADING : GIFT_NO_SHOT}</span>
        )}
      </div>

      {gift.message ? <p className="pt-4 font-display text-[19px] italic leading-snug text-ink">&ldquo;{gift.message}&rdquo;</p> : null}

      {gift.removed ? (
        <p data-gift-removed-line="" className="mt-4 border-t border-ink/10 pt-3 text-[13.5px] leading-snug text-ink/70">
          {GIFT_REMOVED_LINE}
        </p>
      ) : (
        <>
          <div className="mt-4 border-t border-ink/10 pt-3">
            <label className={LABEL} htmlFor={`${id}-amount`}>
              {GIFT_AMOUNT_LABEL} <small className="text-[12px] text-ink/50">{GIFT_AMOUNT_HINT}</small>
            </label>
            <span className="relative block">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-[15px] text-ink/60">
                ₱
              </span>
              <input
                id={`${id}-amount`}
                data-gift-field="amount"
                inputMode="numeric"
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                onBlur={() => void keep()}
                className={`${FIELD} pl-8`}
              />
            </span>
          </div>
          <div className="mt-3 border-t border-ink/10 pt-3">
            <span className={LABEL}>{GIFT_TOWARD_LABEL}</span>
            {/* ONE dropdown — the Maker's own (`PickMenu`): every wish, then "Any gift". Kept at the pick. */}
            <PickMenu
              label={GIFT_TOWARD_LABEL}
              value={gift.wishId ?? ''}
              options={toward}
              dataAttr="data-gift-toward"
              className="mt-1.5"
              onPick={async (key) => {
                if (key === (gift.wishId ?? '')) return;
                setRefused(null);
                const said = await onMove(key === '' ? null : key);
                if (said) setRefused(said);
              }}
            />
          </div>
        </>
      )}

      <p className="pt-3.5 text-[12.5px] leading-snug text-ink/55">{GIFT_SHOT_IS_NOT_MONEY}</p>
      {refused ? (
        <p role="alert" data-gift-refused="" className="pt-2 text-[14px] text-terracotta-700">
          {refused}
        </p>
      ) : null}
      <div data-wish-sheet-foot="gift" className={FOOT}>
        {gift.removed ? (
          <ActionButton
            tone="neutral"
            icon={RotateCcw}
            label="Put it back"
            className="w-full"
            data-testid="gift-put-back"
            onClick={async () => {
              setRefused(null);
              const said = await onRemove(false);
              if (said) setRefused(said);
              else onClose();
            }}
          />
        ) : (
          /* Two taps: the first only asks. */
          <ActionButton
            tone="danger"
            icon={Trash2}
            label={asked ? 'Remove it?' : 'Remove'}
            className="w-full"
            data-testid={asked ? 'gift-remove-asked' : 'gift-remove'}
            onClick={async () => {
              if (!asked) {
                setAsked(true);
                return;
              }
              setRefused(null);
              const said = await onRemove(true);
              if (said) setRefused(said);
              else onClose();
            }}
          />
        )}
        <ActionButton tone="neutral" main icon={Check} label="Done" className="w-full" data-testid="gift-done" onClick={() => void close()} />
      </div>
    </WishSheet>
  );
}
