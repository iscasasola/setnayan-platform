'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Plus, Upload, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { PillSelector } from '@/app/_components/pill-selector';
import { StatusLine } from '@/app/_components/status-line';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import { Sheet } from '@/app/_components/sheet';
import { CHIP_CLASS, CHIP_OFF_CLASS } from '@/app/_components/chips';
import { FileUpload } from '@/app/_components/file-upload';
import { parseGuestInput } from '@/lib/guest-parse';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { MENU_DISH_MAX, MENU_MAX_DISHES, MENU_MAX_MOMENTS, MENU_TITLE_MAX, POSTER_PHOTO_MIN_PX, posterPhotoTooSmall, type MenuMoment, type PosterPhoto } from '@/lib/print-pieces';
import { menuPayload, studioMenuSaveWords } from '@/lib/studio-prints-six';
import { addSingleGuest } from '../../guests/inline-actions';
import { SAME_FIELD_ATTR } from './same-field';

/**
 * 🖨 STUDIO › PRINTS — THE SIX, ON THE TEMPLATES (owner "approved" 2026-10-13, DECISION_LOG "THE MAKER'S PRINTS SIX + THE
 * SEAT COUNTER"; corpus `MAKER_PRINTS_SEAT_COUNTER_2026-10-13_fable.md`, prototype `maker_prints_seat_counter_2026-10-13.html`).
 * Each control → its kind (INTERACTION_RULES § 9):
 *
 *   1 · Changed since you printed → 12 status line (amber) with one quiet "Save again" — `ChangedSincePrinted again=` (print-save-button.tsx)
 *   2 · Parents' cards             → 15 list rows (initials · name · "Bride's parent · on your guest list" · the accent arrow) → the SHIPPED guest
 *                                    card opens as a sheet (`StudioParents`); "＋ Add a parent" = 9 quiet → 1 Bride's | Groom's · 10 the open box ·
 *                                    9 Add; none → 16 "No parents on your guest list yet" + the add
 *   3 · Kindly reply (two doors)  → 2 Dropdown "Who guests reply to" (each host with their number, or "no number on their account"; last
 *                                    "Type it in…") · 6 typed row "Reply line" only for "Type it in…" (`StudioKindlyReply`) — ONE field in two
 *                                    doors, each door's carriers wear `data-same-field`
 *   4 · Menu editor                → 18/34 reorder (dots, hold to lift; arrows behind "Arrange" on a phone, shown on a computer) · 10 open boxes ·
 *                                    11 chips · 9 quiet · 12 toast; SAVES AS YOU GO (`StudioMenuEditor`) — the same endpoint, quietly
 *   5 · Pass card look             → 5 style cards (pass-card-design-picker.tsx `studio`) · 20 Pro mark → the centred note (`StudioProDoor`)
 *   6 · Poster photo               → 1 two-way pill · 21 upload with the 0–100 pie · 12 the plain-words problem with "Change" (`StudioPosterPhoto`)
 *
 * 🔑 NOTHING HERE IS A NEW WRITE: every save is the one that shipped — the print words form (`details-print-words`, posted by its Save),
 * `/api/hub-print/menu` (the same `menu_json`, byte for byte — `menuPayload`), `/api/hub-print/poster-photo`, the Guest list's own
 * `addSingleGuest`, and the parent's own guest card. Loaded through the Studio's ONE lazy door (`StudioTool`, `details-lazy.tsx`) —
 * never in the Maker's first load. Guard: `lib/studio-prints-six-are-the-templates.test.ts`.
 */

/* ── 2 · PARENTS ───────────────────────────────────────────────────────────── */

export type StudioParent = { guestId: string | null; name: string; side: 'bride' | 'groom' | null; card: ReactNode };

/** "MS" — the first letters of the first and last word. */
function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter((x) => /[A-Za-zÀ-ÿ]/.test(x));
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? (w[w.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function parentLineWords(side: StudioParent['side']): string {
  return side === 'bride' ? 'Bride’s parent · on your guest list' : side === 'groom' ? 'Groom’s parent · on your guest list' : 'On your guest list';
}

/**
 * The parents on the invitation: one hairline row per parent → their OWN guest card (the shipped `GuestCardBody`, which posts
 * every column — `the-card-posts-every-column.test.ts`) opens as a sheet. Never a name box: a names-only write would erase a
 * parent's side, role, RSVP and contact (`parent-cards.tsx`). "＋ Add a parent" is the Guest list's own single-guest add.
 */
export function StudioParents({ eventId, parents }: { eventId: string; parents: StudioParent[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [side, setSide] = useState<'bride' | 'groom'>('bride');
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const headId = useId();
  /* The new parent's card opens once the refreshed list carries it. */
  useEffect(() => {
    if (pendingOpen && parents.some((p) => p.guestId === pendingOpen && p.card)) {
      setOpen(pendingOpen);
      setPendingOpen(null);
    }
  }, [parents, pendingOpen]);
  const add = () => {
    const typed = name.trim();
    if (!typed || pending) return;
    setError(null);
    setPending(true);
    const draft = { ...parseGuestInput(typed, { defaultSide: side }), side, groups: [], plusOnes: 0, roleHint: side === 'bride' ? ('bride_parents' as const) : ('groom_parents' as const) };
    void makerSave(() => addSingleGuest(eventId, draft), requestMakerRefresh)
      .then((r) => {
        if (!r.ok) return setError(r.error);
        setName('');
        setAdding(false);
        setPendingOpen(r.guest.guest_id);
      })
      .catch(() => setError('That did not save. Please try again.'))
      .finally(() => setPending(false));
  };
  const openParent = parents.find((p) => p.guestId && p.guestId === open) ?? null;
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  return (
    <div data-studio-parents="" className="flex flex-col">
      {parents.length ? (
        <ul data-parent-list="" className="flex flex-col">
          {parents.map((p, i) => {
            const row = (
              <>
                <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-full bg-ink/[0.06] text-[13px] font-bold text-ink/70">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold text-ink">{p.name}</b>
                  <span className="block text-[12.5px] text-ink/65">{parentLineWords(p.side)}</span>
                </span>
              </>
            );
            return (
              <li key={p.guestId ?? `${p.name}-${i}`} className="border-t border-ink/10 first:border-t-0">
                {p.guestId && p.card ? (
                  <button type="button" data-parent-open={p.guestId} onClick={() => setOpen(p.guestId)} className="sn-press flex min-h-14 w-full items-center gap-3 px-0.5 text-left">
                    {row}
                    <ChevronRight aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2.2} />
                  </button>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-0.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div data-parent-empty="" className="flex flex-col gap-0.5 py-2">
          <b className="text-[14.5px] font-semibold text-ink">No parents on your guest list yet</b>
          <p className="text-[13px] text-ink/65">Add them here — they join your guest list as a parent.</p>
        </div>
      )}
      {adding ? (
        <div data-parent-add="" className="flex flex-col gap-1 pt-1">
          <FormRows data="parent-add">
            <FormRow name="Whose parent" line="Sets their role on your guest list" data="parent-side">
              <PillSelector
                label="Whose parent"
                value={side}
                grow={false}
                data="parent-side"
                options={[
                  { key: 'bride', label: 'Bride’s' },
                  { key: 'groom', label: 'Groom’s' },
                ]}
                onPick={(k) => setSide(k)}
              />
            </FormRow>
          </FormRows>
          <div className="flex items-center gap-2 pb-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              maxLength={120}
              autoFocus
              aria-label="The parent’s name"
              placeholder="Their name"
              data-studio-open-box=""
              className={OPEN_BOX}
            />
            <ActionButton tone="brand" main icon={Plus} label={pending ? 'Adding…' : 'Add'} waiting={pending} disabled={!name.trim()} onClick={add} />
            <ActionButton tone="neutral" iconOnly icon={X} label="Cancel" onClick={() => setAdding(false)} />
          </div>
        </div>
      ) : (
        <span className="self-start pt-1">
          <ActionButton tone="brand" quiet icon={Plus} label="Add a parent" onClick={() => setAdding(true)} />
        </span>
      )}
      {pendingOpen ? <p role="status" className="py-1 text-[12.5px] text-ink/65">Added — opening their card…</p> : null}
      {error ? (
        <StatusLine tone="bad" data="parent-add">
          {error}
        </StatusLine>
      ) : null}
      {/* The parent's OWN guest card, as a sheet — drawn on <body> (the dashboard's transformed box would capture `fixed`). */}
      {body && openParent
        ? createPortal(
            <Sheet open onClose={() => setOpen(null)} labelledById={headId} rise>
              <div data-parent-card={openParent.guestId} className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-3">
                <h2 id={headId} className="pr-12 text-[17px] font-semibold text-ink">
                  {openParent.name}
                </h2>
                {openParent.card}
              </div>
            </Sheet>,
            body,
          )
        : null}
    </div>
  );
}

/** An open box (kind 10 — "filling in something new: the boxes already open"): the Form row's white pill, typed straight into. */
const OPEN_BOX =
  'h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 text-[16px] text-ink placeholder:text-ink/45 focus:border-sn-accent focus:outline-none focus:ring-[3px] focus:ring-sn-accent/15 dark:bg-cream';

/* ── 3 · KINDLY REPLY — one field, two doors ──────────────────────────────── */

export type ReplyHost = { moderatorId: string; label: string; contact: string | null };

/** The dropdown's choices: each host with their number (or "no number on their account"), then "Type it in…". */
export function kindlyReplyOptions(hosts: readonly ReplyHost[]) {
  return [
    ...hosts.map((h) => ({ key: `host:${h.moderatorId}`, label: h.contact ? `${h.label} · ${h.contact}` : h.label, hint: h.contact ? undefined : 'no number on their account' })),
    { key: 'manual', label: 'Type it in…' },
  ];
}

/**
 * Who guests reply to — the SAME two fields the old select and box posted (`rsvp_choice`, `rsvp_manual`, through the print words
 * form by `form=`), now carried by hidden inputs under the dropdown and the typed row. ONE field in TWO doors (Words › Kindly reply
 * and The Finer Details' switch): each carrier wears `data-same-field`, a pick or a keep is copied into the other door
 * (`same-field.ts`, a real `change` event), and this door hears the other's copy on its own carrier.
 */
export function StudioKindlyReply({ form, hosts, choice, manual }: { form: string; hosts: ReplyHost[]; choice: string; manual: string }) {
  const [now, setNow] = useState(choice);
  const [typed, setTyped] = useState(manual);
  const choiceEl = useRef<HTMLInputElement>(null);
  const manualEl = useRef<HTMLInputElement>(null);
  const tell = useRef<'choice' | 'manual' | null>(null);
  /* After a PERSON's pick or keep: tell the other door (and the form) — never from a render or a copy that came in. */
  useEffect(() => {
    const which = tell.current;
    tell.current = null;
    const el = which === 'choice' ? choiceEl.current : which === 'manual' ? manualEl.current : null;
    el?.dispatchEvent(new Event('change', { bubbles: true }));
  }, [now, typed]);
  /* The other door's copy arrives as a `change` on this door's carrier — take it into this door's state. */
  useEffect(() => {
    const c = choiceEl.current;
    const m = manualEl.current;
    const onC = () => c && setNow(c.value);
    const onM = () => m && setTyped(m.value);
    c?.addEventListener('change', onC);
    m?.addEventListener('change', onM);
    return () => {
      c?.removeEventListener('change', onC);
      m?.removeEventListener('change', onM);
    };
  }, []);
  const options = kindlyReplyOptions(hosts);
  return (
    <FormRows data="kindly-reply">
      <ChosenRow
        name="Who guests reply to"
        value={now || null}
        buttonText={now ? undefined : 'Choose…'}
        options={options}
        onPick={(k) => {
          tell.current = 'choice';
          setNow(k);
        }}
        dataAttr="data-kindly-reply-pick"
      />
      {now === 'manual' ? (
        <TypedRow
          name="Reply line"
          value={typed}
          empty="Type it…"
          placeholder="Reply by Nov 18 · Claire, 0917 …"
          maxLength={160}
          data="kindly-reply-line"
          onKeep={(text) => {
            tell.current = 'manual';
            setTyped(text);
            return { ok: true as const };
          }}
        />
      ) : null}
      <input ref={choiceEl} type="hidden" form={form} name="rsvp_choice" value={now} {...{ [SAME_FIELD_ATTR]: 'rsvp_choice' }} data-form-pick="" />
      <input ref={manualEl} type="hidden" form={form} name="rsvp_manual" value={typed} {...{ [SAME_FIELD_ATTR]: 'rsvp_manual' }} data-form-pick="" />
    </FormRows>
  );
}

/* ── 4 · THE MENU — saves as you go ────────────────────────────────────────── */

/** How long the menu waits after the last change before it saves (typing a dish is many changes, one save). */
export const MENU_SAVE_QUIET_MS = 800;

const move = <T,>(list: T[], i: number, j: number): T[] => {
  if (i === j || j < 0 || j >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(i, 1);
  next.splice(j, 0, it!);
  return next;
};

/**
 * The moments of the night, each with its dishes — saved AS YOU GO (owner's answer (2), 2026-10-13: no Save button, no reload).
 * Every change waits `MENU_SAVE_QUIET_MS`, then the SAME endpoint the old form posted (`/api/hub-print/menu`) gets the SAME
 * `menu_json` (`menuPayload`), quietly (`accept: application/json` — the route answers `{ ok }` instead of its 303). A save that
 * landed is the accent toast from the top; one that did not is the red status line with Try again — never the look of success.
 */
export function StudioMenuEditor({
  eventId,
  initial,
  fromCaterer,
  suggestions,
}: {
  eventId: string;
  initial: MenuMoment[];
  fromCaterer: boolean;
  suggestions: string[];
}) {
  const [moments, setMoments] = useState<MenuMoment[]>(initial);
  const [arrange, setArrange] = useState(false);
  const [toast, setToast] = useState<{ n: number; tone: 'ok' | 'bad'; words: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  /* What was last SENT (so an unchanged menu never posts) and the latest to send. */
  const sent = useRef(menuPayload(initial));
  const latest = useRef(sent.current);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);
  const save = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const payload = latest.current;
    if (payload === sent.current) return;
    const n = ++seq.current;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('menu_json', payload);
    const ok = await fetch('/api/hub-print/menu', { method: 'POST', body: fd, credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(async (r) => r.ok && ((await r.json().catch(() => null)) as { ok?: unknown } | null)?.ok === true)
      .catch(() => false);
    if (n !== seq.current) return; // a newer save is on its way — it speaks for both
    if (ok) {
      sent.current = payload;
      setFailed(false);
      setToast({ n, tone: 'ok', words: studioMenuSaveWords(true) });
      /* The Menu card's picture is drawn from what is saved — the Maker's one refresh path. */
      requestMakerRefresh();
    } else {
      setFailed(true);
      setToast({ n, tone: 'bad', words: studioMenuSaveWords(false) });
    }
  }, [eventId]);
  /* Every change: wait for the quiet, then save. Leaving the page sends what is waiting. */
  const change = (next: MenuMoment[] | ((all: MenuMoment[]) => MenuMoment[])) => {
    setMoments((all) => {
      const v = typeof next === 'function' ? next(all) : next;
      latest.current = menuPayload(v);
      return v;
    });
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), MENU_SAVE_QUIET_MS);
  };
  useEffect(() => {
    const flush = () => {
      if (timer.current === null || latest.current === sent.current) return;
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('menu_json', latest.current);
      navigator.sendBeacon?.('/api/hub-print/menu', fd);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      if (timer.current !== null) void save();
    };
  }, [eventId, save]);

  /* 18/34 · hold the dots to lift a moment; it follows the finger and the others slide aside. */
  const list = useRef<HTMLOListElement>(null);
  const [lift, setLift] = useState<{ from: number; to: number; dy: number } | null>(null);
  const press = useRef<{ i: number; y0: number; timer: number; tops: number[]; heights: number[]; pointer: number } | null>(null);
  const onGripDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-menu-moment]') ?? [])];
    const tops = rows.map((r) => r.getBoundingClientRect().top);
    const heights = rows.map((r) => r.getBoundingClientRect().height);
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    const t = window.setTimeout(() => setLift({ from: i, to: i, dy: 0 }), e.pointerType === 'mouse' ? 0 : 180);
    press.current = { i, y0: e.clientY, timer: t, tops, heights, pointer: e.pointerId };
  };
  const onGripMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || !lift) return;
    const dy = e.clientY - p.y0;
    const mid = (p.tops[p.i] ?? 0) + (p.heights[p.i] ?? 0) / 2 + dy;
    let to = p.i;
    p.tops.forEach((top, k) => {
      const m = top + (p.heights[k] ?? 0) / 2;
      if (k > p.i && mid > m) to = Math.max(to, k);
      if (k < p.i && mid < m) to = Math.min(to, k);
    });
    setLift({ from: p.i, to, dy });
  };
  const onGripUp = () => {
    const p = press.current;
    press.current = null;
    if (p) window.clearTimeout(p.timer);
    if (lift && lift.from !== lift.to) change((all) => move(all, lift.from, lift.to));
    setLift(null);
  };
  const shiftOf = (k: number): number => {
    if (!lift || k === lift.from || !press.current) return 0;
    const h = press.current.heights[lift.from] ?? 0;
    if (lift.from < lift.to && k > lift.from && k <= lift.to) return -h;
    if (lift.from > lift.to && k < lift.from && k >= lift.to) return h;
    return 0;
  };

  const used = new Set(moments.map((m) => m.title.trim().toLowerCase()));
  const offers = suggestions.filter((s) => !used.has(s.toLowerCase()));
  const full = moments.length >= MENU_MAX_MOMENTS;
  const setMoment = (i: number, m: MenuMoment) => change((all) => all.map((x, k) => (k === i ? m : x)));
  const addMoment = (title: string) => {
    if (full) return;
    change((all) => [...all, { title, dishes: [''] }]);
  };
  const arrowCls = 'sn-press inline-flex h-11 min-h-11 w-11 flex-none items-center justify-center rounded-full text-sn-accent disabled:text-ink/20';
  return (
    <section id="print-menu" data-print-menu-editor="" data-studio-menu="" aria-label="Your menu for the night" className="flex scroll-mt-4 flex-col">
      <FormRows data="menu-head">
        <FormRow name="Your menu for the night" line="The moments of your night, in order, with their dishes" data="menu-head">
          {moments.length > 1 ? (
            /* On a phone the arrows wait behind Arrange; a computer shows them (ruling 34). */
            <span className="lg:hidden">
              <ActionButton tone="brand" quiet icon={ArrowDown} label={arrange ? 'Done' : 'Arrange'} aria-pressed={arrange} onClick={() => setArrange((a) => !a)} />
            </span>
          ) : null}
        </FormRow>
      </FormRows>
      {fromCaterer ? <p data-print-menu-from-caterer="" className="pb-2 text-[12.5px] text-ink/65">These are your caterer’s package lines — change them and your version is what prints.</p> : null}
      {moments.length === 0 ? (
        <div data-print-menu-empty="" className="flex flex-col gap-0.5 py-2">
          <b className="text-[14.5px] font-semibold text-ink">Your menu card is empty</b>
          <p className="text-[13px] text-ink/65">Add the first moment of your night — the Menu prints once it has a dish.</p>
        </div>
      ) : (
        <ol ref={list} className="flex flex-col" data-menu-moments="">
          {moments.map((m, i) => {
            const lifted = lift?.from === i;
            return (
              <li
                key={i}
                data-menu-moment={i}
                data-print-menu-moment={i}
                style={{ transform: lifted ? `translateY(${lift!.dy}px) scale(1.02)` : shiftOf(i) ? `translateY(${shiftOf(i)}px)` : undefined }}
                className={`relative border-t border-ink/10 pb-2 pt-1 first:border-t-0 ${lifted ? 'z-[3] rounded-2xl bg-white shadow-[0_14px_30px_-10px_rgba(0,0,0,.45)] ring-2 ring-sn-accent dark:bg-cream' : 'transition-transform duration-sn-pill ease-sn-spring motion-reduce:transition-none'}`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-menu-grip=""
                    aria-label={`Hold to move ${m.title || `moment ${i + 1}`}`}
                    onPointerDown={onGripDown(i)}
                    onPointerMove={onGripMove}
                    onPointerUp={onGripUp}
                    onPointerCancel={onGripUp}
                    className="-ml-2 inline-flex h-11 min-h-11 w-8 flex-none cursor-grab touch-none items-center justify-center text-sn-accent"
                  >
                    <GripVertical aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                  <BoxWithX
                    value={m.title}
                    maxLength={MENU_TITLE_MAX}
                    label={`Moment ${i + 1}`}
                    placeholder="A moment — e.g. Cocktail hour"
                    bold
                    onChange={(v) => setMoment(i, { ...m, title: v })}
                    onBlur={() => void save()}
                    onRemove={() => change((all) => all.filter((_, k) => k !== i))}
                    removeLabel={`Remove ${m.title || `moment ${i + 1}`}`}
                  />
                  <span className={`${arrange ? 'flex' : 'hidden'} lg:flex`} data-menu-arrows="">
                    <button type="button" aria-label={`Move ${m.title || `moment ${i + 1}`} earlier`} disabled={i === 0} onClick={() => change((all) => move(all, i, i - 1))} className={arrowCls}>
                      <ArrowUp aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    </button>
                    <button type="button" aria-label={`Move ${m.title || `moment ${i + 1}`} later`} disabled={i === moments.length - 1} onClick={() => change((all) => move(all, i, i + 1))} className={arrowCls}>
                      <ArrowDown aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    </button>
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5 pl-6 pt-1.5">
                  {m.dishes.map((d, j) => (
                    <li key={j} className="flex items-center gap-1.5">
                      <BoxWithX
                        value={d}
                        maxLength={MENU_DISH_MAX}
                        label={`Dish ${j + 1} of ${m.title || `moment ${i + 1}`}`}
                        placeholder="A dish — e.g. Lechon with liver sauce"
                        onChange={(v) => setMoment(i, { ...m, dishes: m.dishes.map((x, k) => (k === j ? v : x)) })}
                        onBlur={() => void save()}
                        onRemove={() => setMoment(i, { ...m, dishes: m.dishes.filter((_, k) => k !== j) })}
                        removeLabel={`Remove ${d || `dish ${j + 1}`}`}
                      />
                      <span className={`${arrange ? 'flex' : 'hidden'} lg:flex`}>
                        <button type="button" aria-label={`Move ${d || `dish ${j + 1}`} up`} disabled={j === 0} onClick={() => setMoment(i, { ...m, dishes: move(m.dishes, j, j - 1) })} className={arrowCls}>
                          <ArrowUp aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                        </button>
                        <button type="button" aria-label={`Move ${d || `dish ${j + 1}`} down`} disabled={j === m.dishes.length - 1} onClick={() => setMoment(i, { ...m, dishes: move(m.dishes, j, j + 1) })} className={arrowCls}>
                          <ArrowDown aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                        </button>
                      </span>
                    </li>
                  ))}
                  <li>
                    <ActionButton tone="brand" quiet icon={Plus} label="Add a dish" disabled={m.dishes.length >= MENU_MAX_DISHES} onClick={() => setMoment(i, { ...m, dishes: [...m.dishes, ''] })} />
                  </li>
                </ul>
              </li>
            );
          })}
        </ol>
      )}
      {!full ? (
        <div className="flex flex-col gap-1.5 pt-2" data-print-menu-add="">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink/55">Add a moment</p>
          <div className="flex flex-wrap gap-2">
            {offers.map((s) => (
              <button key={s} type="button" onClick={() => addMoment(s)} className={`${CHIP_CLASS} ${CHIP_OFF_CLASS} gap-1.5 !text-ink/75`}>
                <Plus aria-hidden className="h-3.5 w-3.5 text-sn-accent" strokeWidth={2.4} />
                {s}
              </button>
            ))}
            <button type="button" onClick={() => addMoment('')} className={`${CHIP_CLASS} ${CHIP_OFF_CLASS} gap-1.5 !text-ink/75`}>
              <Plus aria-hidden className="h-3.5 w-3.5 text-sn-accent" strokeWidth={2.4} />
              A moment of your own
            </button>
          </div>
        </div>
      ) : null}
      {failed ? (
        <div className="pt-2">
          <StatusLine tone="bad" data="menu-save" action={{ label: 'Try again', onClick: () => void save() }}>
            Your menu did not save — what is on paper is the last menu that did.
          </StatusLine>
        </div>
      ) : null}
      {toast && body
        ? createPortal(
            <PeekToast key={toast.n} tone={toast.tone} data="print-menu" onGone={() => setToast((t) => (t?.n === toast.n ? null : t))}>
              {toast.words}
            </PeekToast>,
            body,
          )
        : null}
    </section>
  );
}

/** One open box with its ✕ inside — a moment's name (bold) or a dish. */
function BoxWithX({
  value,
  maxLength,
  label,
  placeholder,
  bold = false,
  onChange,
  onBlur,
  onRemove,
  removeLabel,
}: {
  value: string;
  maxLength: number;
  label: string;
  placeholder: string;
  bold?: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      <input
        value={value}
        maxLength={maxLength}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-studio-open-box=""
        className={`${OPEN_BOX} pr-12 ${bold ? 'font-semibold' : ''}`}
      />
      <button type="button" aria-label={removeLabel} onClick={onRemove} className="sn-press absolute right-0.5 inline-flex h-11 min-h-11 w-11 items-center justify-center rounded-full text-ink/55">
        <X aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>
    </span>
  );
}

/* ── 5 · THE ◆ PRO DOOR — the centred note, never a page jump ─────────────── */

/**
 * A door to the Event Hub Pro unlock that a FREE couple meets on Prints (the zip of every ticket): the same link, the same words and
 * the same mark (`studio-prints-money-is-unchanged.test.ts`) — but a tap opens the centred note (kind 20: "shown, tappable, never a
 * page jump from a row"; owner's answer (5)): "See Pro" goes to the unlock page, "Keep it" closes. Without script it is the link.
 */
export function StudioProDoor({ href, label, icon, note }: { href: string; label: string; icon: React.ReactElement; note: { title: string; body: string } }) {
  const [open, setOpen] = useState(false);
  const link = useRef<HTMLAnchorElement | null>(null);
  /* "See Pro" follows the SAME link (Next's own navigation) — the one press that is let through. */
  const through = useRef(false);
  return (
    <>
      <ActionButton
        ref={link as unknown as React.Ref<HTMLButtonElement | HTMLAnchorElement>}
        tone="neutral"
        href={href}
        label={label}
        icon={icon}
        onClick={(e) => {
          if (through.current) {
            through.current = false;
            return;
          }
          e.preventDefault();
          setOpen(true);
        }}
      />
      <ConfirmDialog
        open={open}
        title={note.title}
        body={note.body}
        confirmLabel="See Pro"
        cancelLabel="Keep it"
        onConfirm={() => {
          setOpen(false);
          through.current = true;
          link.current?.click();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/* ── 6 · THE POSTER'S PHOTO ────────────────────────────────────────────────── */

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * The Our Story poster's background: "Theme's picture | My photo" (the two-way pill). My photo shows the upload square — the 0–100
 * pie of the upload's own measured progress (`FileUpload onProgress`, never a guess), then the photo with ✕. Too small for A3: the
 * red plain-words line with "Change" — ALLOWED and warned (owner's answer (6)), never refused. Saves live, as it always did
 * (`/api/hub-print/poster-photo`, the server measures the pixels).
 */
export function StudioPosterPhoto({ eventId, saved, thumb }: { eventId: string; saved: PosterPhoto | null; thumb: string | null }) {
  const [photo, setPhoto] = useState<PosterPhoto | null>(saved);
  const [mode, setMode] = useState<'theme' | 'photo'>(saved ? 'photo' : 'theme');
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const post = (ref: string) => {
    setError(null);
    setSaving(true);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('ref', ref);
    void fetch('/api/hub-print/poster-photo', { method: 'POST', body: fd, headers: { accept: 'application/json' } })
      .then(async (res) => {
        const b = (await res.json().catch(() => null)) as { ok?: boolean; photo?: PosterPhoto | null; error?: string } | null;
        if (!res.ok || !b?.ok) return setError(b?.error ?? 'That did not save — please try again.');
        setPhoto(b.photo ?? null);
        if (!b.photo) setLocal(null);
        requestMakerRefresh();
      })
      .catch(() => setError('That did not save — check your connection and try again.'))
      .finally(() => setSaving(false));
  };
  const pick = () => root.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  const small = posterPhotoTooSmall(photo);
  const shown = local ?? (photo ? thumb : null);
  return (
    <div ref={root} data-poster-photo={photo ? 'photo' : 'theme'} data-studio-poster-photo="" aria-busy={saving || pct !== null || undefined} className="flex flex-col gap-1">
      <FormRows data="poster-photo">
        <FormRow name="Background" data="poster-background">
          <PillSelector
            label="The poster’s background"
            value={mode}
            grow={false}
            data="poster-photo"
            options={[
              { key: 'theme', label: 'Theme’s picture' },
              { key: 'photo', label: 'My photo' },
            ]}
            onPick={(k) => {
              setMode(k);
              if (k === 'theme' && photo) post('');
            }}
          />
        </FormRow>
      </FormRows>
      {mode === 'photo' ? (
        <div className="flex items-center gap-3.5 py-2" data-poster-photo-row="">
          <span className="relative flex-none">
            <button
              type="button"
              data-poster-photo-square={pct !== null ? 'uploading' : photo ? 'has' : 'empty'}
              aria-label={photo ? 'Change the photo' : 'Upload a photo'}
              disabled={pct !== null || saving}
              onClick={pick}
              className={`sn-press relative flex h-[120px] w-[120px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl text-[13px] font-semibold text-sn-accent ${
                shown || pct !== null ? 'bg-ink/[0.06]' : 'border-[1.5px] border-dashed border-ink/25 bg-white dark:bg-cream'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the photo just picked (a local address) or the poster's own preview */}
              {shown ? <img src={shown} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" /> : null}
              {pct !== null ? (
                <span data-upload-pie={pct} className="relative flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `conic-gradient(rgb(var(--sn-accent)) ${pct}%, rgb(0 0 0 / 0.1) 0)` }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[12px] font-bold tabular-nums text-sn-accent">{pct}%</span>
                </span>
              ) : !shown ? (
                <>
                  <Upload aria-hidden className="h-6 w-6" strokeWidth={2} />
                  Upload
                  <small className="text-[12px] font-normal text-ink/55">JPG · PNG · up to 30 MB</small>
                </>
              ) : null}
            </button>
            {photo && pct === null ? (
              <button type="button" aria-label="Remove this photo" data-poster-photo-remove="" onClick={() => { setMode('theme'); post(''); }} className="sn-press absolute right-1 top-1 inline-flex h-11 min-h-11 w-11 items-center justify-center rounded-full">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
                </span>
              </button>
            ) : null}
          </span>
          <p className="text-[13px] text-ink/70">
            {pct !== null ? 'Uploading…' : photo && !small ? 'Your photo is on the poster.' : photo ? '' : `For a sharp A3 poster use a photo at least ${POSTER_PHOTO_MIN_PX.short} × ${POSTER_PHOTO_MIN_PX.long} pixels.`}
          </p>
          {/* The ONE upload the scenes use — its own picker, its own checks; drawn here only as the square above. */}
          <div className="sr-only" aria-hidden>
            <FileUpload
              bucket="media"
              pathPrefix={`events/${eventId}/poster`}
              multiple={false}
              maxSizeMB={30}
              acceptedTypes={IMAGE_TYPES}
              onFilePicked={(f) => setLocal(URL.createObjectURL(f))}
              onProgress={setPct}
              onChange={(v) => {
                const ref = typeof v === 'string' ? v : null;
                if (ref) post(ref);
              }}
              disabled={saving}
            />
          </div>
        </div>
      ) : null}
      {mode === 'photo' && photo && small ? (
        <StatusLine tone="bad" data="poster-photo-small" action={{ label: 'Change', onClick: pick }}>
          This photo is {photo.w} × {photo.h} pixels — small for A3, so it may print soft. Use one at least {POSTER_PHOTO_MIN_PX.short} × {POSTER_PHOTO_MIN_PX.long}.
        </StatusLine>
      ) : null}
      {error ? (
        <StatusLine tone="bad" data="poster-photo-error">
          {error}
        </StatusLine>
      ) : null}
    </div>
  );
}
