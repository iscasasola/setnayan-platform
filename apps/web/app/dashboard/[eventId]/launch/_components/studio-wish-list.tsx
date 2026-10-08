'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Gift, GripVertical, Plus, RotateCw, Trash2, TriangleAlert, X } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import { SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh, type Superseded } from '@/lib/maker-refresh';
import { formatPhp } from '@/lib/php';
import { STUDIO_GROUP_HEAD, STUDIO_GROUP_HEAD_LINE, STUDIO_SWITCH_TRACK } from '@/lib/studio-skin';
import { WISH_LINK_MAX, WISH_NAME_MAX, WISH_NOTE_MAX } from '@/lib/wish-list';
import {
  WISH_GIFTS_ONLY_YOU,
  WISH_LIST_EMPTY,
  WISH_LIST_NO_WAY,
  WISH_LIST_TIP,
  WISH_LIST_UNREAD_LINE,
  WISH_LIST_UNREAD_TITLE,
  WISH_PRICE_TIP,
  WISH_SHEET_KEEPS,
  aWayToGiveIsOn,
  cleanWishPrice,
  giftWhenLine,
  giftsSentLine,
  studioWishIsGot,
  studioWishesInOrder,
  wishGotLine,
  wishListCount,
  wishRowLineParts,
  wishRowMeter,
  wishSheetPill,
  type StudioWish,
  type StudioWishKept,
  type StudioWishList,
} from '@/lib/wish-list-studio';

/**
 * 🎁 STUDIO › E-GIFTS › WISH LIST (owner 2026-10-08, "ok wish list"; design
 * `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2, prototype
 * `egifts_wish_list_2026-10-08_fable.html` frames 02–06 · 09 · 11).
 *
 * ONE section, between Ways to give and the Thank-you message: what the couple
 * would love, and — beside each wish — what guests say they SENT toward it
 * through the couple's own GCash or bank. Setnayan never holds the money.
 *
 *   · rows, never boxes: photo · name · "₱ sent of ₱ price · n gifts" + a thin
 *     meter (gold while filling, green when got) · Got it ✓ · the grip;
 *   · ＋ Add an item is the ONE creating button — a sheet from the thumb zone
 *     (Photo · Name · Price · Link · Note; ✕ Not now · ＋ Add it);
 *   · a wish opens to the same fields, KEPT AS YOU TYPE — no Save, no "Saved" —
 *     with the Got it switch on top and the gifts sent toward it under it;
 *     Remove is two taps;
 *   · hold the grip (or the arrow keys) to reorder — one drag, one write.
 *
 * 🔴 LIVE, NOT DRAFTED (owner: "live"). Every write here is `send` — the E-Gifts
 * page's own door (`saveEgiftMethod` carrying `wish_op`; +0 server actions),
 * handed in by `studio-tools.tsx` — and guests see it right away — it sits under the SAME "Guests see this right away" line
 * the ways to give carry, so no second note is drawn. ✓ Apply does not cover it.
 *
 * ⚡ ONE PRESS, ONE REQUEST, NO PAGE RENDERED (owner rule 2026-10-08). Each of
 * the five writes is drawn on this list first and saved behind it HELD — the
 * Maker is not re-read, because an add or an edit is answered with the row as
 * kept and the rest is already on screen. The only thing here that asks the
 * Maker to render is the couple's own "Try again" on a list that could not be
 * read. Held by `lib/the-wish-list-costs-one-request.test.ts`.
 *
 * 🔴 A REFUSED READ IS SAID. `list.read === false` draws "Couldn't load your
 * wish list." and Try again — never "No wishes yet" with an add button under it.
 *
 * Lazy: rides the `StudioTool` door (`details-lazy.tsx`, the `maker-details`
 * chunk) — never the Maker's first load.
 */

const FIELD =
  'mt-1.5 min-h-11 w-full scroll-mb-24 rounded-md border border-ink/15 bg-white px-3 py-2 text-[15px] text-ink placeholder:text-ink/45 focus:border-ink/40 focus:outline-none';
const LABEL = 'flex items-center justify-between gap-2 text-[13px] text-ink/60';
const FOOT = 'sn-glass-row sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 px-5 py-3';
const PHOTO = 'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gild/15';

type Draft = { name: string; price: string; link: string; note: string; photo: string };

const draftOf = (w: StudioWish | null): Draft => ({
  name: w?.name ?? '',
  price: w?.pricePhp != null ? String(w.pricePhp) : '',
  link: w?.linkUrl ?? '',
  note: w?.note ?? '',
  photo: w?.photoRef ?? '',
});

const sameDraft = (a: Draft, b: Draft) =>
  a.name.trim() === b.name.trim() &&
  a.price.trim() === b.price.trim() &&
  a.link.trim() === b.link.trim() &&
  a.note.trim() === b.note.trim() &&
  a.photo === b.photo;

/**
 * The E-Gifts page's one write door, as the lazy Studio tools hand it in (`saveEgiftMethod`).
 * A save answers with the row it kept (`wish`), which the list lays over what it drew.
 */
type WishResult = { ok: true; wish?: StudioWishKept } | { ok: false; error: string };
export type WishAction = (form: FormData) => Promise<WishResult>;

/** A write a LATER one for the same wish carried is as good as kept — that later write answers for both. */
const kept = (r: WishResult | Superseded): boolean => r === SUPERSEDED || r.ok;
/** What a refused write said — nothing, when it was kept or carried by a later one. */
const refusal = (r: WishResult | Superseded): string | null => (r === SUPERSEDED || r.ok ? null : r.error);

/** What a draft becomes on a row, before the server's own row replaces it. */
const drawn = (w: StudioWish, d: Draft): StudioWish => ({
  ...w,
  name: d.name.trim() || w.name,
  pricePhp: cleanWishPrice(d.price) ?? null,
  linkUrl: d.link.trim() || null,
  note: d.note.trim() || null,
  photoRef: d.photo || null,
  photoUrl: d.photo && d.photo === w.photoRef ? w.photoUrl : null,
});

export function StudioWishList({
  eventId,
  methods,
  list,
  action,
}: {
  eventId: string;
  /** The ways to give as the server last read them — is one switched on? */
  methods: readonly { is_enabled: boolean }[];
  list: StudioWishList;
  /**
   * The write. Handed in by the Studio's lazy door (`studio-tools.tsx`), which
   * owns the E-Gifts page's one action — so this file imports no server action.
   */
  action: WishAction;
}) {
  const served = list.read ? list.wishes : null;
  const [wishes, setWishes] = useState<StudioWish[]>(served ?? []);
  /* The server's read is the truth: whatever it brings back replaces what was shown meanwhile. */
  useEffect(() => {
    if (served) setWishes(served);
  }, [served]);

  const [sheet, setSheet] = useState<{ kind: 'add' } | { kind: 'edit'; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* An item the server refused comes back into the add sheet, as it was typed. */
  const [addSeed, setAddSeed] = useState<Draft | null>(null);
  const pendingNo = useRef(0);
  const form = (fields: Record<string, string>): FormData => {
    const f = new FormData();
    f.set('event_id', eventId);
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  /* ⚡ ONE PRESS, ONE REQUEST, AND THE MAKER IS NOT RENDERED AGAIN (owner rule
     2026-10-08). Every write is DRAWN FIRST — the list on this screen is the
     drawing — then saved behind it as a HELD Maker save: no Maker re-read is
     owed, because nothing the server would bring back is missing here. An add or
     an edit is answered with the row as it was kept (`wish`), laid over what was
     drawn; a refusal puts back ONLY the wish it was about, and is said in place.
     Quick repeats on one wish (two fields left in a row, the switch flipped
     twice, the arrow keys) fold into ONE write — the latest carries everything
     (`makerLatestWrite`). `every-maker-edit-shows-before-it-saves.test.ts` and
     `the-wish-list-costs-one-request.test.ts` hold this. */

  /** Lay the server's row over a wish on screen — its sum and gifts stay the screen's own. */
  const lay = (id: string, row: StudioWishKept) =>
    setWishes((cur) => cur.map((w) => (w.id === id || w.id === row.id ? { ...w, ...row } : w)));
  /** Put ONE wish back as it was — never the whole list (another change may have landed meanwhile). */
  const putBack = (was: StudioWish) => setWishes((cur) => cur.map((w) => (w.id === was.id ? was : w)));

  /** A new wish still on its way: its on-screen id → the promise of its real one (null = refused). */
  const adding = useRef(new Map<string, Promise<string | null>>());

  /** ＋ Add it: the wish is on the list at the tap; the row the server kept replaces it when the save answers. */
  const addWish = async (draft: Draft) => {
    pendingNo.current += 1;
    const temp: StudioWish = drawn(
      { id: `pending:${pendingNo.current}`, name: '', pricePhp: null, photoRef: null, photoUrl: null, linkUrl: null, note: null, gotBy: null, sentPhp: 0, gifts: [] },
      draft,
    );
    setWishes((cur) => [...cur, temp]);
    setSheet(null);
    setAddSeed(null);
    setError(null);
    const saved = makerSave(
      () => action(form({ wish_op: 'save', name: draft.name, price: draft.price, link: draft.link, note: draft.note, photo_r2_key: draft.photo })),
      requestMakerRefresh,
      { held: true },
    );
    adding.current.set(
      temp.id,
      saved.then(
        (r) => (r.ok ? (r.wish?.id ?? null) : null),
        () => null,
      ),
    );
    const res = await saved;
    adding.current.delete(temp.id);
    if (res.ok) {
      const row = res.wish;
      /* The row as kept takes the drawn one's place — or joins the list, if a Maker render
         from elsewhere replaced the list while the save was on its way. */
      if (row) setWishes((cur) => (cur.some((w) => w.id === temp.id) ? cur.map((w) => (w.id === temp.id ? { ...w, ...row } : w)) : cur.some((w) => w.id === row.id) ? cur : [...cur, { ...temp, ...row }]));
      return;
    }
    setWishes((cur) => cur.filter((w) => w.id !== temp.id));
    setAddSeed(draft);
    setSheet({ kind: 'add' });
    setError(res.error);
  };

  /** A field was left (or the sheet closed): the row shows it at once. Returns what the server said, if it refused. */
  const keepWish = async (id: string, draft: Draft): Promise<string | null> => {
    const was = wishes.find((w) => w.id === id);
    setWishes((cur) => cur.map((w) => (w.id === id ? drawn(w, draft) : w)));
    const res = await makerSave(
      () =>
        makerLatestWrite(`wish:${id}`, () =>
          action(form({ wish_op: 'save', wish_item_id: id, name: draft.name, price: draft.price, link: draft.link, note: draft.note, photo_r2_key: draft.photo })),
        ),
      requestMakerRefresh,
      { held: true, ok: kept },
    );
    if (res !== SUPERSEDED && res.ok && res.wish) lay(id, res.wish);
    if (kept(res)) return null;
    if (was) putBack(was);
    return refusal(res);
  };

  /** The couple's own Got it switch. */
  const gotWish = async (id: string, got: boolean): Promise<string | null> => {
    const was = wishes.find((w) => w.id === id);
    setWishes((cur) => cur.map((w) => (w.id === id ? { ...w, gotBy: got ? 'host' : null } : w)));
    const res = await makerSave(
      () => makerLatestWrite(`wish-got:${id}`, () => action(form({ wish_op: 'got', wish_item_id: id, got: got ? '1' : '0' }))),
      requestMakerRefresh,
      { held: true, ok: kept },
    );
    if (kept(res)) return null;
    if (was) setWishes((cur) => cur.map((w) => (w.id === id ? { ...w, gotBy: was.gotBy } : w)));
    return refusal(res);
  };

  /** 🗑 Remove it? — the second tap: the row leaves at once, and comes back (in its place) if the server refuses. */
  const removeWish = async (id: string) => {
    const at = wishes.findIndex((w) => w.id === id);
    const was = wishes[at];
    setWishes((cur) => cur.filter((w) => w.id !== id));
    setSheet(null);
    setError(null);
    const res = await makerSave(() => action(form({ wish_op: 'delete', wish_item_id: id })), requestMakerRefresh, { held: true });
    if (res.ok) return;
    if (was) setWishes((cur) => (cur.some((w) => w.id === id) ? cur : [...cur.slice(0, at), was, ...cur.slice(at)]));
    setError(res.error);
  };

  /* ── reorder: hold the grip, or the arrow keys — one drag, one write ── */
  const rows = useRef(new Map<string, HTMLElement>());
  const [dragging, setDragging] = useState<string | null>(null);
  const before = useRef<StudioWish[]>([]);
  /** While moves are on their way: the ids in the order the server still holds (null = nothing is on its way). */
  const orderHeld = useRef<string[] | null>(null);
  const shown = studioWishesInOrder(wishes);
  const moveTo = (id: string, to: number) => {
    setWishes((cur) => {
      const order = studioWishesInOrder(cur);
      const from = order.findIndex((w) => w.id === id);
      if (from < 0 || to === from || to < 0 || to >= order.length) return cur;
      /* A wish moves among its own kind — an open one never lands among the got ones. */
      if (studioWishIsGot(order[to]!) !== studioWishIsGot(order[from]!)) return cur;
      const next = order.filter((w) => w.id !== id);
      next.splice(to, 0, order[from]!);
      return next;
    });
  };
  const placeAt = (y: number): number => {
    let at = shown.length - 1;
    for (const [i, w] of shown.entries()) {
      const el = rows.current.get(w.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        at = i;
        break;
      }
    }
    return at;
  };
  /**
   * The drop: the list already shows the new order (`moveTo`); this is the one write behind it.
   * Several arrow-key presses in a row are ONE write — the last order carries them all. A wish
   * still on its way in is waited for, so the order names real rows only.
   */
  const finish = async (order: readonly StudioWish[]) => {
    setDragging(null);
    if (order.map((w) => w.id).join(',') === before.current.map((w) => w.id).join(',')) return;
    /* The order the server still holds: the one from before the FIRST move of this run of moves. */
    orderHeld.current ??= before.current.map((w) => w.id);
    const was = orderHeld.current;
    setError(null);
    const res = await makerSave(
      () =>
        makerLatestWrite('wish-order', async () => {
          const ids = await Promise.all(order.map((w) => adding.current.get(w.id) ?? w.id));
          return action(form({ wish_op: 'move', order: ids.filter((id): id is string => id !== null).join(',') }));
        }),
      requestMakerRefresh,
      { held: true, ok: kept },
    );
    /* A later move carried this one: that later write answers for the whole run. */
    if (res === SUPERSEDED) return;
    orderHeld.current = null;
    if (res.ok) return;
    setWishes((cur) => {
      /* Back to the order the server holds — keeping whatever else changed on the rows meanwhile. */
      const place = new Map(was.map((id, i) => [id, i]));
      return [...cur].sort((x, y) => (place.get(x.id) ?? was.length) - (place.get(y.id) ?? was.length));
    });
    setError(res.error);
  };

  if (!list.read) {
    return (
      <section data-studio-wish-list="unread" className="flex flex-col">
        <WishHead summary={null} />
        <div role="alert" className="flex flex-col items-start gap-2.5 border-t border-ink/10 pb-1 pt-4 text-[14px]">
          <b className="font-medium text-danger-800">{WISH_LIST_UNREAD_TITLE}</b>
          <span className="text-ink/60">{WISH_LIST_UNREAD_LINE}</span>
          <ActionButton tone="neutral" icon={RotateCw} label="Try again" data-testid="wish-retry" onClick={() => requestMakerRefresh()} />
        </div>
      </section>
    );
  }

  const noWay = !aWayToGiveIsOn(methods);
  const open = sheet?.kind === 'edit' ? (wishes.find((w) => w.id === sheet.id) ?? null) : null;
  const addButton = (
    <ActionButton tone="brand" icon={Plus} label="Add an item" className="w-full" data-testid="wish-add" onClick={() => setSheet({ kind: 'add' })} />
  );

  return (
    <section data-studio-wish-list={wishes.length ? 'list' : 'empty'} className="flex flex-col">
      <WishHead summary={wishListCount(wishes)} />
      {wishes.length === 0 ? (
        <>
          {/* Sample shapes — the editor's own, never a guest's: three grey rows that say "a list goes here". */}
          <div aria-hidden data-wish-samples="" className="pointer-events-none flex flex-col opacity-45">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0">
                <span className="h-11 w-11 shrink-0 rounded-md bg-ink/10" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="h-[11px] w-[62%] rounded-full bg-ink/10" />
                  <span className="h-[9px] w-[46%] rounded-full bg-ink/10" />
                </span>
              </div>
            ))}
          </div>
          <p className="px-1.5 pb-2.5 pt-1 text-center text-[12px] text-ink/50">{WISH_LIST_EMPTY}</p>
          {addButton}
        </>
      ) : (
        <>
          <ul data-wish-rows="" className="flex flex-col">
            {shown.map((w, i) => {
              const got = studioWishIsGot(w);
              const meter = wishRowMeter(w);
              const line = wishRowLineParts(w);
              const pending = w.id.startsWith('pending:');
              return (
                <li
                  key={w.id}
                  ref={(el) => {
                    if (el) rows.current.set(w.id, el);
                    else rows.current.delete(w.id);
                  }}
                  data-wish-row={got ? 'got' : 'open'}
                  className={`flex items-center gap-1 border-t border-ink/10 first:border-t-0 ${dragging === w.id ? 'bg-ink/[0.03]' : ''}`}
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setSheet({ kind: 'edit', id: w.id })}
                    className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 text-left disabled:opacity-60"
                  >
                    <span className={`${PHOTO} ${got ? 'opacity-55 grayscale' : ''}`}>
                      {w.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- the couple's own upload in the public media bucket
                        <img src={w.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        /* 🎁 No photo: ONE neutral gift glyph in the square, never an empty box (controller
                           2026-10-08, frame 03). The prototype's fryer / cooker / luggage drawings are
                           stand-ins for the couple's own photos — there is no per-item rule behind them. */
                        <Gift aria-hidden data-wish-no-photo="" className="h-5 w-5 text-gild" strokeWidth={1.75} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className={`truncate text-[14.5px] font-semibold ${got ? 'text-ink/55' : 'text-ink'}`}>{w.name}</b>
                      <span className="truncate text-[12.5px] text-ink/60">
                        {line.sentPhp != null ? <Count value={line.sentPhp} format="peso" id={`wish-sent-${w.id}`} /> : null}
                        {line.rest}
                      </span>
                      {meter ? (
                        <span aria-hidden data-wish-meter={meter.got ? 'got' : 'filling'} className="mt-1.5 block h-1 overflow-hidden rounded-full bg-ink/10">
                          <Fill value={meter.percent} id={`wish-meter-${w.id}`} className={`block h-full rounded-full ${meter.got ? 'bg-success-600' : 'bg-gild'}`} />
                        </span>
                      ) : null}
                    </span>
                    {got ? (
                      <span data-wish-got="" className="shrink-0 rounded-full bg-success-600/10 px-2.5 py-0.5 text-[12px] font-medium text-success-700">
                        Got it ✓
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Move ${w.name} — drag, or use the arrow keys`}
                    data-wish-grip={w.id}
                    className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-ink/30 active:cursor-grabbing"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      before.current = shown;
                      setDragging(w.id);
                    }}
                    onPointerMove={(e) => {
                      if (dragging === w.id) moveTo(w.id, placeAt(e.clientY));
                    }}
                    onPointerUp={() => {
                      if (dragging === w.id) void finish(shown);
                    }}
                    onPointerCancel={() => {
                      setDragging(null);
                      setWishes(before.current);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                      e.preventDefault();
                      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
                      if (to < 0 || to >= shown.length || studioWishIsGot(shown[to]!) !== got) return;
                      before.current = shown;
                      const next = shown.filter((x) => x.id !== w.id);
                      next.splice(to, 0, w);
                      setWishes(next);
                      void finish(next);
                    }}
                  >
                    <GripVertical aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
          {noWay ? (
            <p data-wish-no-way="" className="flex items-start gap-2 pb-0.5 pt-2.5 text-[13px] leading-snug text-warn-700">
              <TriangleAlert aria-hidden className="mt-px h-4 w-4 shrink-0" strokeWidth={2} />
              <span>{WISH_LIST_NO_WAY}</span>
            </p>
          ) : null}
          <div className="pt-2.5">{addButton}</div>
          {/* Every record's own screen is wish list 5/5 — until then this row counts, and opens nothing. */}
          <div data-studio-gifts-sent="" className="mt-3.5 flex min-h-12 flex-col justify-center border-t border-ink/10 py-2">
            <b className="text-[14.5px] font-semibold text-ink">Gifts sent to you</b>
            <span className="text-[12.5px] text-ink/60">{giftsSentLine(list.totalSentPhp, list.totalGifts)}</span>
          </div>
        </>
      )}
      {error && sheet?.kind !== 'add' ? (
        <p role="alert" className="pt-2 text-[13px] text-terracotta-700">
          {error} Nothing else was changed.
        </p>
      ) : null}

      {sheet?.kind === 'add' ? (
        <WishSheet title="Add an item" titleId="wish-add-title" onClose={() => setSheet(null)}>
          <AddWish eventId={eventId} seed={addSeed} refused={addSeed ? error : null} onNotNow={() => setSheet(null)} onAdd={(draft) => void addWish(draft)} />
        </WishSheet>
      ) : null}

      {open ? (
        <OpenWish
          key={open.id}
          eventId={eventId}
          wish={open}
          onClose={() => setSheet(null)}
          onKeep={(draft) => keepWish(open.id, draft)}
          onGot={(got) => gotWish(open.id, got)}
          onRemove={() => void removeWish(open.id)}
        />
      ) : null}
    </section>
  );
}

/** The eyebrow: "Wish list" ⓘ — and "4 wishes · 1 got" on the right. */
function WishHead({ summary }: { summary: string | null }) {
  return (
    <div data-studio-heading="wish-list" className={STUDIO_GROUP_HEAD}>
      <InfoTip label="Wish list" align="start">
        {WISH_LIST_TIP}
      </InfoTip>
      {summary ? <small className={STUDIO_GROUP_HEAD_LINE}>{summary}</small> : null}
    </div>
  );
}

/** The Schedule's sheet, portalled to <body> and lifted over the Maker's bars (as Love Story's add sheet). */
function WishSheet({ title, titleId, pill, onClose, children }: { title: string; titleId: string; pill?: ReactNode; onClose: () => void; children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div data-wish-sheet="" className="relative z-[90]">
      <Sheet open onClose={onClose} labelledById={titleId} wide rise>
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
            <h3 id={titleId} className="font-display text-[22px] leading-tight text-ink">
              {title}
            </h3>
            {pill}
          </div>
          {children}
        </div>
      </Sheet>
    </div>,
    document.body,
  );
}

/** Photo · Name · Price · Link · Note — the same five fields in both sheets. */
function WishFields({
  eventId,
  draft,
  set,
  photoUrl,
  onLeave,
  onPhoto,
}: {
  eventId: string;
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  photoUrl: string | null;
  /** A field was left — the open wish keeps itself here; the add sheet does nothing. */
  onLeave?: () => void;
  onPhoto: (ref: string) => void;
}) {
  const id = useId();
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <span className={LABEL}>Photo</span>
        {/* The shipped upload, as it ships (its own drop zone and words) — the label above names it. */}
        <div className="mt-1.5 max-w-[220px]" data-wish-photo="">
          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/wish-list`}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            maxSizeMB={10}
            variant="square"
            compressImage
            currentValue={draft.photo || null}
            initialDisplayUrls={draft.photo && photoUrl ? { [draft.photo]: photoUrl } : {}}
            onChange={(v) => onPhoto(typeof v === 'string' ? v : '')}
          />
        </div>
      </div>
      <label className="block border-t border-ink/10 pt-3" htmlFor={`${id}-name`}>
        <span className={LABEL}>Name</span>
        <input
          id={`${id}-name`}
          data-wish-field="name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={onLeave}
          maxLength={WISH_NAME_MAX}
          placeholder="e.g. Air fryer"
          className={FIELD}
        />
      </label>
      <div className="border-t border-ink/10 pt-3">
        <span className={LABEL}>
          <InfoTip label="Price" align="start">
            {WISH_PRICE_TIP}
          </InfoTip>
          <small className="text-[12px] text-ink/50">optional</small>
        </span>
        <span className="relative block">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-[15px] text-ink/60">
            ₱
          </span>
          <input
            aria-label="Price"
            data-wish-field="price"
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => set({ price: e.target.value.replace(/[^\d]/g, '').slice(0, 9) })}
            onBlur={onLeave}
            placeholder="any amount"
            className={`${FIELD} pl-8`}
          />
        </span>
      </div>
      <label className="block border-t border-ink/10 pt-3" htmlFor={`${id}-link`}>
        <span className={LABEL}>
          Link <small className="text-[12px] text-ink/50">optional</small>
        </span>
        <input
          id={`${id}-link`}
          data-wish-field="link"
          type="url"
          inputMode="url"
          value={draft.link}
          onChange={(e) => set({ link: e.target.value })}
          onBlur={onLeave}
          maxLength={WISH_LINK_MAX}
          placeholder="Paste the shop link"
          className={FIELD}
        />
      </label>
      <label className="block border-t border-ink/10 pt-3" htmlFor={`${id}-note`}>
        <span className={LABEL}>
          Note <small className="text-[12px] text-ink/50">optional</small>
        </span>
        <input
          id={`${id}-note`}
          data-wish-field="note"
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          onBlur={onLeave}
          maxLength={WISH_NOTE_MAX}
          placeholder="e.g. the grey one"
          className={FIELD}
        />
      </label>
    </div>
  );
}

/** ＋ Add an item — the one creating sheet: ✕ Not now · ＋ Add it. */
function AddWish({
  eventId,
  seed,
  refused,
  onNotNow,
  onAdd,
}: {
  eventId: string;
  /** What was typed, when the server refused it — the sheet comes back as it was. */
  seed: Draft | null;
  refused: string | null;
  onNotNow: () => void;
  onAdd: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => seed ?? draftOf(null));
  const [unnamed, setUnnamed] = useState(false);
  const said = unnamed ? 'Give it a name.' : refused;
  return (
    <>
      <WishFields eventId={eventId} draft={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} photoUrl={null} onPhoto={(photo) => setDraft((d) => ({ ...d, photo }))} />
      {said ? (
        <p role="alert" className="pt-3 text-[14px] text-terracotta-700">
          {said}
        </p>
      ) : null}
      <div data-wish-sheet-foot="add" className={FOOT}>
        <ActionButton tone="neutral" icon={X} label="Not now" className="w-full" data-testid="wish-not-now" onClick={onNotNow} />
        <ActionButton
          tone="brand"
          main
          icon={Plus}
          label="Add it"
          className="w-full"
          data-testid="wish-add-it"
          onClick={() => {
            if (draft.name.trim() === '') setUnnamed(true);
            else onAdd(draft);
          }}
        />
      </div>
    </>
  );
}

/**
 * A wish, open: Got it on top, the gifts sent toward it, then its fields — kept
 * when a field is left and when the sheet closes. No Save. 🗑 Remove is two taps.
 */
function OpenWish({
  eventId,
  wish,
  onClose,
  onKeep,
  onGot,
  onRemove,
}: {
  eventId: string;
  wish: StudioWish;
  onClose: () => void;
  onKeep: (draft: Draft) => Promise<string | null>;
  onGot: (got: boolean) => Promise<string | null>;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(wish));
  const kept = useRef<Draft>(draftOf(wish));
  const [refused, setRefused] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const switchId = useId();
  const got = studioWishIsGot(wish);

  /** Keep what is typed, when it differs from what is kept. An emptied name keeps the old one. */
  const keep = async (next: Draft = draft): Promise<boolean> => {
    const send = { ...next, name: next.name.trim() === '' ? kept.current.name : next.name };
    if (sameDraft(send, kept.current)) return true;
    if (cleanWishPrice(send.price) === undefined) {
      setRefused('Type the price as a number, or leave it empty for any amount.');
      return false;
    }
    setRefused(null);
    const said = await onKeep(send);
    if (said) {
      setRefused(said);
      return false;
    }
    kept.current = send;
    return true;
  };
  const close = async () => {
    if (await keep()) onClose();
  };
  const pill = wishSheetPill(wish);

  return (
    <WishSheet
      title={wish.name}
      titleId="wish-open-title"
      onClose={() => void close()}
      pill={
        pill ? (
          <span data-wish-pill="" className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${got ? 'bg-success-600/10 text-success-700' : 'bg-gild/15 text-ink/60'}`}>
            {pill}
          </span>
        ) : null
      }
    >
      <label htmlFor={switchId} data-wish-got-switch="" className="mt-3 flex min-h-[52px] cursor-pointer items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <b className="text-[14.5px] font-semibold text-ink">Got it</b>
          <span className="text-[12.5px] text-ink/60">{wishGotLine(wish)}</span>
        </span>
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          checked={got}
          onChange={async (e) => {
            setRefused(null);
            const said = await onGot(e.target.checked);
            if (said) setRefused(said);
          }}
          className="peer sr-only"
        />
        <span aria-hidden className={STUDIO_SWITCH_TRACK} />
      </label>

      {wish.gifts.length > 0 ? (
        <>
          <ul data-wish-gifts="" className="mt-1 flex flex-col">
            {wish.gifts.map((g) => (
              <li key={g.id} className="flex items-start gap-3 border-t border-ink/10 py-2.5 first:border-t-0">
                <span
                  data-wish-gift-shot={g.hasShot ? 'yes' : 'none'}
                  className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white px-0.5 text-center text-[10px] leading-tight text-ink/50"
                >
                  {g.hasShot ? 'shot' : 'no shot'}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-[14.5px] font-semibold text-ink">{g.giverName}</b>
                  <span className="text-[12.5px] text-ink/60">{giftWhenLine(g)}</span>
                  {g.message ? <em className="truncate text-[13px] text-ink/80">&ldquo;{g.message}&rdquo;</em> : null}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <b className="text-[14.5px] font-semibold text-ink">{formatPhp(g.amountPhp)}</b>
                  <small className="text-[11px] text-ink/50">sent</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="pb-1 pt-1 text-[12px] text-ink/55">{WISH_GIFTS_ONLY_YOU}</p>
        </>
      ) : null}

      <div className="border-t border-ink/10">
        <WishFields
          eventId={eventId}
          draft={draft}
          set={(p) => setDraft((d) => ({ ...d, ...p }))}
          photoUrl={wish.photoUrl}
          onLeave={() => void keep()}
          onPhoto={(photo) => {
            const next = { ...draft, photo };
            setDraft(next);
            void keep(next);
          }}
        />
      </div>
      <p className="flex items-center justify-center gap-1 pt-3.5 text-center text-[12px] text-ink/50">
        {WISH_SHEET_KEEPS} · hold <GripVertical aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> in the list to reorder
      </p>
      {refused ? (
        <p role="alert" className="pt-2 text-[14px] text-terracotta-700">
          {refused} Nothing else was changed.
        </p>
      ) : null}
      <div data-wish-sheet-foot="open" className={FOOT}>
        {/* Two taps: the first only asks. */}
        <ActionButton
          tone="danger"
          icon={Trash2}
          label={asked ? 'Remove it?' : 'Remove'}
          className="w-full"
          data-testid={asked ? 'wish-remove-asked' : 'wish-remove'}
          onClick={() => {
            if (asked) onRemove();
            else setAsked(true);
          }}
        />
        <ActionButton tone="neutral" main icon={Check} label="Done" className="w-full" data-testid="wish-done" onClick={() => void close()} />
      </div>
    </WishSheet>
  );
}
