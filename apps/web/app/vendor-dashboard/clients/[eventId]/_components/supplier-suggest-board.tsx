'use client';

/**
 * 🤝🖼 THE BOOKED SUPPLIER'S VIEW OF THE COUPLE'S PALETTE, WITH "＋ SUGGEST A PHOTO" ON ITS OWN PARTS (owner 2026-10-19,
 * DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED" + "FIVE CONTROLLER
 * RECOMMENDATIONS APPROVED" item 4; prototype `supplier_inspiration_suggestions_2026-10-19.html` frames 1–2).
 *
 *   · the couple's name, the event's line, and what this shop may do ("You are their florist — you can add photos to
 *     Flowers.");
 *   · YOUR MAIN PALETTE — the couple's five, shown, not changeable here;
 *   · each lane of the couple's one-list Palette in the couple's own block shape (h3 · its line · its circle with the
 *     colour's name · its photos), this shop's lanes first. Only a part of THIS shop's category carries "＋ Suggest a
 *     photo" (the one slot→trade map — the board is handed the answer); every other lane says whose it is, "Look only".
 *
 * "＋ Suggest a photo" opens one sheet: Upload a photo · Choose from your shop's photos (owner: "+ pick from the shop's
 * own gallery"). A sent photo sits in the part's line as WAITING ("Waiting to be kept"); tapping it takes it back, and
 * the "Sent to …" toast's Undo does the same. Nothing on the couple's board changes until they keep it.
 *
 * The writes come in as props, so the dev lab (`/dev/supplier-lab?s=suggest`) draws this exact board with stand-ins.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Plus, Store, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { StudioPopup } from '@/app/dashboard/[eventId]/studio/mood-board/_components/colour-picker-sheet';
import { NamedColourDot } from '@/app/dashboard/[eventId]/studio/mood-board/_components/colour-dot';
import { compressImageForWeb } from '@/lib/image-compress';
import { STUDIO_GROUP, STUDIO_GROUP_HEAD, STUDIO_GROUP_HEAD_LINE } from '@/lib/studio-skin';
import type { BoardPart, SupplierBoard } from '@/lib/supplier-suggest-board';
import { POOL_TICK_LEAD, SUGGESTIONS_WAITING_MAX, SUGGEST_REFUSAL, poolLine, sentToast, suggestionFor, supplierCountLine, type SuggestionPoolResult, type SupplierSuggestion } from '@/lib/inspiration-suggestions';
import { InspirationCardPick } from '@/app/_components/inspiration-card-pick';
import { preselectedCard, type CardChoice } from '@/lib/inspiration-card-link';
import { RIGHTS_WARRANTY_TEXT } from '@/lib/moodboard-gallery-pure';

export type SuggestBoardActions = {
  suggest: (fd: FormData) => Promise<{ status: 'ok'; suggestion: { id: string; slotKey: string; url: string }; pool?: SuggestionPoolResult } | { status: 'refused'; message: string }>;
  withdraw: (eventId: string, suggestionId: string) => Promise<{ status: 'ok' | 'refused'; message?: string }>;
  listShopPhotos: () => Promise<{ photos: Array<{ ref: string; url: string }>; failed: boolean }>;
};

export function SupplierSuggestBoard({
  eventId,
  couple,
  eventLine,
  roleLine,
  board,
  mine,
  actions,
  cardsByPart,
  children,
}: {
  eventId: string;
  couple: string;
  eventLine: string | null;
  roleLine: string;
  board: SupplierBoard;
  /** This shop's photos waiting on the couple's parts. `null` = the read was refused — said, never drawn as none. */
  mine: SupplierSuggestion[] | null;
  actions: SuggestBoardActions;
  /**
   * 🔗 "Which of your services is this?" (owner 2026-10-30) — per part, this shop's live cards whose Service links it
   * (`shopCardChoices`, on the server). `null` = the cards could not be read (said in the sheet); absent = not offered.
   */
  cardsByPart?: Record<string, CardChoice[]> | null;
  /** What the shipped page already shows above the design — the sign-off asks and the granted colours (each renders
   *  nothing when there is nothing for this supplier), between the header and the palette. */
  children?: ReactNode;
}) {
  const [sent, setSent] = useState<SupplierSuggestion[]>(() => (mine ?? []).filter((m) => m.state === 'waiting'));
  const [sheet, setSheet] = useState<BoardPart | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** 🔗 The library half of the last send — "also sent for the inspiration library" or why not (status, never alert). */
  const [poolNote, setPoolNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toastSeq = useRef(0);
  const [toast, setToast] = useState<{ n: number; text: string; undo?: () => void } | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  const fileFor = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<BoardPart | null>(null);
  /** The sheet's card + rights tick, carried to the file picker's send (the sheet closes before the file is chosen). */
  const uploadExtra = useRef<(fd: FormData) => void>(() => {});

  const waitingIn = (slot: string) => sent.filter((s) => s.slotKey === slot);

  const send = async (part: BoardPart, fill: (fd: FormData) => Promise<void> | void) => {
    setSheet(null);
    setProblem(null);
    setPoolNote(null);
    setBusy(part.slotKey);
    try {
      const fd = new FormData();
      fd.set('eventId', eventId);
      fd.set('slotKey', part.slotKey);
      await fill(fd);
      const r = await actions.suggest(fd);
      if (r.status !== 'ok') {
        setProblem(r.message);
        return;
      }
      const s: SupplierSuggestion = { id: r.suggestion.id, slotKey: r.suggestion.slotKey, url: r.suggestion.url, state: 'waiting' };
      setSent((all) => [...all, s]);
      setPoolNote(poolLine(r.pool));
      setToast({ n: ++toastSeq.current, text: sentToast(couple), undo: () => void takeBack(s) });
    } catch {
      setProblem(SUGGEST_REFUSAL.failed);
    } finally {
      setBusy(null);
    }
  };
  const takeBack = async (s: SupplierSuggestion) => {
    const before = sent;
    setSent((all) => all.filter((x) => x.id !== s.id));
    try {
      const r = await actions.withdraw(eventId, s.id);
      if (r.status !== 'ok') {
        setSent(before);
        setProblem(r.message ?? SUGGEST_REFUSAL.failed);
      } else setProblem(null);
    } catch {
      setSent(before);
      setProblem(SUGGEST_REFUSAL.failed);
    }
  };
  const openSuggest = (part: BoardPart) => {
    if (waitingIn(part.slotKey).length >= SUGGESTIONS_WAITING_MAX) {
      setProblem(SUGGEST_REFUSAL.full);
      return;
    }
    setSheet(part);
  };

  const block = (part: BoardPart, first: boolean) => {
    const mineHere = waitingIn(part.slotKey);
    const full = mineHere.length >= SUGGESTIONS_WAITING_MAX;
    /* Three or more photos in the line: the count drops to its own line under them, read whole (as the couple's). */
    const crowded = part.photos.length + mineHere.length >= 3;
    return (
      <section key={part.slotKey} data-suggest-part={part.slotKey} className={`flex flex-col gap-1 py-3.5 ${first ? '' : 'border-t border-ink/10'}`}>
        <h3 className="font-serif text-[21px] font-medium leading-tight text-ink">{part.label}</h3>
        {part.line ? <p className="text-[14px] text-ink/60">{part.line}</p> : null}
        {part.colour ? (
          <span className="flex flex-wrap items-start">
            <NamedColourDot label={`${part.label} — ${part.colour.name ?? 'its colour'}`} colour={part.colour.hex} name={part.colour.name} data={`suggest-${part.slotKey}`} />
          </span>
        ) : null}
        <div className="flex min-h-11 items-center gap-1.5">
          {part.photos.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- the couple's own photo, already sized by the board
            <img key={`c${i}`} src={u} alt="" className="h-[34px] w-[34px] flex-none rounded-lg object-cover" />
          ))}
          {mineHere.map((s) => (
            <ActionButton
              key={s.id}
              tone="neutral"
              quiet
              iconOnly
              // eslint-disable-next-line @next/next/no-img-element -- the photo this shop sent, waiting
              icon={<img src={s.url} alt="" className="h-[34px] w-[34px] rounded-lg object-cover opacity-[0.78]" />}
              label="Take this photo back"
              name={`Take this photo back from ${part.label}`}
              onClick={() => void takeBack(s)}
            />
          ))}
          <span className="ml-1 min-w-0 flex-1 truncate text-[14px] text-ink/60" data-suggest-count={crowded ? undefined : part.slotKey}>
            {crowded ? '' : supplierCountLine(part.photos.length, mineHere.length)}
          </span>
          {part.canSuggest ? (
            <span data-suggest-button={part.slotKey}>
              <ActionButton
                tone="neutral"
                icon={Plus}
                label="Suggest a photo"
                name={`Suggest a photo for ${part.label}`}
                waiting={full || busy === part.slotKey}
                onClick={() => openSuggest(part)}
              />
            </span>
          ) : null}
        </div>
        {crowded ? (
          <p className="text-[14px] text-ink/60" data-suggest-count={part.slotKey}>
            {supplierCountLine(part.photos.length, mineHere.length)}
          </p>
        ) : null}
      </section>
    );
  };

  return (
    <div data-supplier-suggest-board="" className="flex flex-col">
      <header className="pb-3.5 pt-1">
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">{couple}</h1>
        {eventLine ? <p className="mt-1.5 text-[15px] text-ink/60">{eventLine}</p> : null}
        <p className="mt-2.5 text-[15px] text-ink" data-suggest-role="">{roleLine}</p>
      </header>

      {problem ? (
        <p role="alert" data-suggest-problem="" className="px-1.5 pb-2 text-[13px] font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
      {poolNote ? (
        <p role="status" data-suggest-pool="" className="px-1.5 pb-2 text-[13px] text-ink/65">
          {poolNote}
        </p>
      ) : null}
      {mine === null ? (
        <p role="status" className="px-1.5 pb-2 text-[13px] text-ink/65" data-suggest-unread="">
          We couldn’t read the photos you sent just now — reopen this in a moment.
        </p>
      ) : null}

      {children}

      <p className={STUDIO_GROUP_HEAD}>Your main palette</p>
      <div className={STUDIO_GROUP} data-suggest-five="">
        <div className="flex flex-wrap items-start justify-between pt-1">
          {board.five.map((c, i) => (
            <span key={i} className="w-16">
              <NamedColourDot label={`${c.slot}: ${c.name ?? 'its colour'}`} colour={c.hex} slot={c.slot} name={c.name} data={`suggest-main-${i}`} />
            </span>
          ))}
        </div>
        {board.main.canSuggest || board.main.photos.length > 0 ? block(board.main, true) : <div className="h-2.5" />}
      </div>

      {board.lanes.map((lane) => (
        <div key={lane.key} data-suggest-lane={lane.key} data-suggest-look-only={lane.lookOnly ? '' : undefined}>
          <p className={STUDIO_GROUP_HEAD}>
            {lane.title}
            {lane.lookOnly ? <span className={STUDIO_GROUP_HEAD_LINE}>Look only</span> : null}
          </p>
          <div className={STUDIO_GROUP}>{lane.parts.map((p, i) => block(p, i === 0))}</div>
        </div>
      ))}

      <input
        ref={fileFor}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-suggest-file=""
        onChange={(e) => {
          const f = e.target.files?.[0];
          const part = uploadFor;
          e.target.value = '';
          const extra = uploadExtra.current;
        if (f && part) void send(part, async (fd) => { extra(fd); fd.set('file', await compressImageForWeb(f)); });
        }}
      />

      {sheet ? (
        <SuggestSheet
          part={sheet}
          cards={cardsByPart === undefined ? undefined : cardsByPart === null ? null : (cardsByPart[sheet.slotKey] ?? [])}
          onClose={() => setSheet(null)}
          onUpload={(extra) => {
            uploadExtra.current = extra;
            setUploadFor(sheet);
            setSheet(null);
            fileFor.current?.click();
          }}
          onPick={(ref, extra) => void send(sheet, (fd) => { extra(fd); fd.set('shopPhotoRef', ref); })}
          listShopPhotos={actions.listShopPhotos}
        />
      ) : null}

      {toast && body
        ? createPortal(
            <PeekToast
              key={toast.n}
              data="suggest"
              action={toast.undo ? { label: 'Undo', onPress: () => { const u = toast.undo; setToast(null); u?.(); } } : undefined}
              onGone={() => setToast((t) => (t?.n === toast.n ? null : t))}
            >
              {toast.text}
            </PeekToast>,
            body,
          )
        : null}
    </div>
  );
}

/** "＋ Suggest a photo" — the two ways in: a file, or one of the shop's own photos (read when asked for, never guessed). */
function SuggestSheet({
  part,
  cards,
  onClose,
  onUpload,
  onPick,
  listShopPhotos,
}: {
  part: BoardPart;
  /** 🔗 This part's fitting cards (`[]` none, `null` unreadable, `undefined` not offered). */
  cards: CardChoice[] | null | undefined;
  onClose: () => void;
  /** `extra` writes the sheet's card + rights tick onto the send's form data. */
  onUpload: (extra: (fd: FormData) => void) => void;
  onPick: (ref: string, extra: (fd: FormData) => void) => void;
  listShopPhotos: SuggestBoardActions['listShopPhotos'];
}) {
  const [shop, setShop] = useState<{ photos: Array<{ ref: string; url: string }>; failed: boolean } | 'loading' | null>(null);
  const [card, setCard] = useState<string>(() => preselectedCard(cards ?? []));
  /* 🛑 Never pre-ticked: the tick is a warranty AND the offer to the library (owner 2026-10-30 · RIGHTS_WARRANTY_TEXT). */
  const [rights, setRights] = useState(false);
  const extra = (fd: FormData) => {
    if (cards && card) fd.set('vendorServiceId', card);
    if (rights) fd.set('rightsWarranted', '1');
  };
  const openShop = async () => {
    setShop('loading');
    try {
      setShop(await listShopPhotos());
    } catch {
      setShop({ photos: [], failed: true });
    }
  };
  return createPortal(
    <StudioPopup label={suggestionFor(part.label)} onClose={onClose}>
      <div className="flex flex-col gap-2 px-3 pb-2" data-suggest-sheet={part.slotKey}>
        <InspirationCardPick choices={cards} value={card} onChange={setCard} dataAttr="data-suggest-card" withHiddenField={false} />
        <label className="flex items-start gap-2 text-[12px] leading-snug text-ink/70" data-suggest-pool-tick="">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <b className="font-medium text-ink">{POOL_TICK_LEAD}</b> {RIGHTS_WARRANTY_TEXT}
          </span>
        </label>
        <div className="flex flex-col gap-2 [&_.ab]:w-full">
          <ActionButton tone="neutral" icon={ImagePlus} label="Upload a photo" onClick={() => onUpload(extra)} />
          <span data-suggest-from-shop="">
            <ActionButton tone="neutral" icon={Store} label="Choose from your shop’s photos" waiting={shop === 'loading'} onClick={() => void openShop()} />
          </span>
        </div>
        {shop && shop !== 'loading' ? (
          shop.failed ? (
            <p role="alert" className="text-[13px] text-danger-700">We couldn’t read your shop’s photos just now — please try again in a moment.</p>
          ) : shop.photos.length === 0 ? (
            <p className="text-[13px] text-ink/65">Your shop has no photos yet — add them on your shop page, or upload one here.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 pt-1" data-suggest-shop-photos="">
              {shop.photos.map((p) => (
                <button key={p.ref} type="button" aria-label="Suggest this photo" onClick={() => onPick(p.ref, extra)} className="sn-press block aspect-square overflow-hidden rounded-xl bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the shop's own photo */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )
        ) : null}
        <span className="[&_.ab]:w-full">
          <ActionButton tone="neutral" quiet icon={X} label="Not now" onClick={onClose} />
        </span>
      </div>
    </StudioPopup>,
    document.body,
  );
}
