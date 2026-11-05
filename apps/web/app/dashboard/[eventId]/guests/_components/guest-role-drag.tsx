'use client';

/**
 * ✋ GUESTS › LIST: DRAG A GUEST INTO ANOTHER SECTION TO CHANGE THEIR ROLE (owner 2026-11-01, DECISION_LOG "GUESTS ›
 * LIST: DRAG TO CHANGE ROLE · HONOUR ATTENDANTS GET THEIR OWN GROUP", part 1).
 *
 *   · Role grouping only. PRESS AND HOLD a guest to lift them (a mouse may also just drag 4 px); drag over a section and
 *     let go. Near the list's top or bottom it scrolls by itself — the ONE shared drag piece, `lib/drag-edge-scroll.ts`.
 *   · TAP · MOVE, the fallback: hold, let go without dragging, then TAP the section they go to (Cancel puts them back).
 *   · What the drop means is `lib/guest-role-drop.ts` (pure, executed by the guard): a role section changes their role —
 *     several roles there → a small PickMenu asks which; "Guests of [Role]" makes a guest with no role of their own the
 *     +1 of someone in that role ("Whose guest?" when there are several), and refuses anybody else in one line.
 *   · The couple and the honoree are never picked up.
 *   · Every change says itself with an Undo (`pushUndo`). The row moves at once (the optimistic overlay) and the screen
 *     is never reset — no navigation, no re-read of the page in front of the move.
 *   · The ONE writer is the shipped `setGuestPrimaryRole` with `via: 'list-drag'` (server checks again: offered roles,
 *     the couple, the owner's "Guests of" rule).
 *
 * The lifted row and the section under the finger are marked on the DOM (`data-role-lifted`, `data-role-drop`) — a frame
 * of drag never re-renders the list.
 * 🔒 a-guest-is-dragged-to-a-new-role.test.ts
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf } from '@/lib/drag-edge-scroll';
import { TAP_SLOP_MOUSE, TAP_SLOP_TOUCH } from '@/lib/march-drag';
import { mayDragForRole, planRoleDrop, type RoleDropChoice } from '@/lib/guest-role-drop';
import type { GuestRole, GuestRow } from '@/lib/guests';
import type { RoleNames } from '@/lib/role-names';
import { useGuestActions } from './guest-actions-context';
import { guestOptimistic } from './guest-optimistic-store';
import { pushUndo, guestToast } from './undo-store';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';

/** How long a press is held before the guest lifts (the Maker's scene and the RSVP line: 350 ms). */
export const ROLE_HOLD_MS = 350;

/** The list's band as the finger sees it: the scroller's own, less the pinned top row and the floating thumb row. */
function seenBand(scroller: HTMLElement): { top: number; bottom: number } {
  const band = dragBandOf(scroller);
  const stick = document.querySelector('[data-guests-stick]')?.getBoundingClientRect();
  const thumb = document.querySelector('[data-guests-thumb][data-on="true"]')?.getBoundingClientRect();
  const top = stick && stick.bottom > band.top && stick.bottom < band.bottom ? stick.bottom : band.top;
  const bottom = thumb && thumb.height > 0 && thumb.top > top && thumb.top < band.bottom ? thumb.top : band.bottom;
  return { top, bottom: Math.max(top + 1, bottom) };
}

type Pending = { el: HTMLElement; id: string; x: number; y: number; touch: boolean; pid: number; timer: ReturnType<typeof setTimeout> | null };
type Held = { id: string; el: HTMLElement; ghost: HTMLElement; ox: number; oy: number; x: number; y: number; scroller: HTMLElement; wandered: boolean; startX: number; startY: number; touch: boolean };
/** A drop that needs one more answer: which role, or whose guest. */
type Asking = { id: string; name: string; label: string; kind: 'role' | 'guests_of'; landsIn: string; choices: RoleDropChoice[] };

/** A finger's lift is a pointerup and THEN a click on the row — which would open the guest card. Swallow that one click. */
function swallowNextClick(): void {
  const eat = (ev: Event) => {
    // Only the finger's own click — never the PickMenu opening itself right after a drop.
    if (!ev.isTrusted) return;
    // Immediate: the tap · move listener (also on the window's capture) must not hear this click either.
    ev.stopImmediatePropagation();
    ev.preventDefault();
    window.removeEventListener('click', eat, true);
  };
  window.addEventListener('click', eat, true);
  setTimeout(() => window.removeEventListener('click', eat, true), 500);
}

export function useGuestRoleDrag({
  on,
  eventId,
  listRef,
  roster,
  offeredRoles,
  roleNames,
  nameOf,
}: {
  /** Role grouping, not selecting, and the host may write. */
  on: boolean;
  eventId: string;
  listRef: RefObject<HTMLDivElement | null>;
  /** The WHOLE list as drawn (with the optimistic overlay). */
  roster: readonly GuestRow[];
  offeredRoles: readonly GuestRole[];
  roleNames: RoleNames | null;
  nameOf: (g: GuestRow) => string;
}): { bar: ReactNode } {
  const { setGuestPrimaryRole, addRoleToGuest } = useGuestActions();
  const [carried, setCarried] = useState<{ id: string; name: string } | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const pending = useRef<Pending | null>(null);
  const held = useRef<Held | null>(null);
  const over = useRef<HTMLElement | null>(null);
  const raf = useRef(0);

  /* The latest facts, read by the stable listeners below. */
  const live = useRef({ roster, offeredRoles, roleNames, nameOf, eventId, setGuestPrimaryRole, addRoleToGuest });
  live.current = { roster, offeredRoles, roleNames, nameOf, eventId, setGuestPrimaryRole, addRoleToGuest };
  const guestOf = (id: string) => live.current.roster.find((g) => g.guest_id === id) ?? null;
  const planFor = (g: GuestRow, sectionKey: string) =>
    planRoleDrop(g, sectionKey, { roster: live.current.roster, offeredRoles: live.current.offeredRoles, roleNames: live.current.roleNames, nameOf: live.current.nameOf });

  /* ── the writes ──────────────────────────────────────────────────────────────────────────────────────────────── */
  const commitRole = useCallback(async (id: string, role: GuestRole, landsIn: string) => {
    const g = guestOf(id);
    if (!g) return;
    const { eventId: eid, setGuestPrimaryRole: write, addRoleToGuest: addBack, nameOf: nm } = live.current;
    const name = nm(g);
    const was = g.role;
    const wasExtras = g.extra_roles ?? [];
    const moved = { kind: 'setField' as const, guestIds: [id], override: { role } };
    guestOptimistic.apply(moved);
    const res = await hearAction(() => write(eid, id, role, { via: 'list-drag' }));
    if (!res.ok) {
      guestOptimistic.clear(moved);
      guestToast.error(plainRefusal(res.error, `Couldn’t move ${name}. Try again.`));
      return;
    }
    pushUndo({
      label: `${name} moved to ${landsIn}`,
      undo: async () => {
        guestOptimistic.clear(moved);
        const back = { kind: 'setField' as const, guestIds: [id], override: { role: was } };
        guestOptimistic.apply(back);
        const r = await hearAction(() => write(eid, id, was, { via: 'list-drag' }));
        if (!r.ok) {
          guestOptimistic.clear(back);
          guestToast.error('Could not undo — refresh and try again.');
          return;
        }
        // The new role had been one of their extra roles: it goes back there.
        if (wasExtras.includes(role)) await hearAction(() => addBack(eid, id, role));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads `live`, which is always current
  }, []);

  const commitPlusOne = useCallback(async (id: string, hostId: string, landsIn: string) => {
    const g = guestOf(id);
    if (!g) return;
    const { eventId: eid, setGuestPrimaryRole: write, nameOf: nm } = live.current;
    const name = nm(g);
    const was = g.plus_one_of_guest_id && g.plus_one_of_guest_id !== g.guest_id ? g.plus_one_of_guest_id : null;
    const res = await hearAction(() => write(eid, id, 'guest', { via: 'list-drag', broughtBy: hostId }));
    if (!res.ok) {
      guestToast.error(plainRefusal(res.error, `Couldn’t move ${name}. Try again.`));
      return;
    }
    pushUndo({
      label: `${name} moved to ${landsIn}`,
      undo: async () => {
        const r = await hearAction(() => write(eid, id, 'guest', { via: 'list-drag', broughtBy: was }));
        if (!r.ok) guestToast.error(plainRefusal(r.error, 'Could not undo — refresh and try again.'));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads `live`, which is always current
  }, []);

  /** Let go over `sectionKey`: refuse in one line, do it, or ask the one question left. */
  const dropOn = useCallback(
    (id: string, sectionKey: string) => {
      const g = guestOf(id);
      if (!g) return;
      const plan = planFor(g, sectionKey);
      if (plan.kind === 'stay') return;
      if (plan.kind === 'refuse') {
        guestToast.error(plan.words);
        return;
      }
      const name = live.current.nameOf(g);
      if (plan.kind === 'role') {
        if (plan.roles.length === 1) void commitRole(id, plan.roles[0]!.key as GuestRole, plan.landsIn);
        else setAsking({ id, name, label: plan.label, kind: 'role', landsIn: plan.landsIn, choices: plan.roles });
        return;
      }
      if (plan.hosts.length === 1) void commitPlusOne(id, plan.hosts[0]!.key, plan.label);
      else setAsking({ id, name, label: plan.label, kind: 'guests_of', landsIn: plan.label, choices: plan.hosts });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads `live`, which is always current
    [commitRole, commitPlusOne],
  );

  /* ── the drag ────────────────────────────────────────────────────────────────────────────────────────────────── */
  const sectionAt = (x: number, y: number): HTMLElement | null => {
    const box = listRef.current;
    if (!box) return null;
    // What the finger SEES there: a section hidden under the pinned top row is not a place to drop.
    const top = document.elementFromPoint(x, y);
    const sec = top?.closest<HTMLElement>('[data-guest-section]');
    return sec && box.contains(sec) ? sec : null;
  };

  const mark = (sec: HTMLElement | null, id: string) => {
    if (over.current === sec) return;
    over.current?.removeAttribute('data-role-drop');
    over.current = sec;
    if (!sec) return;
    const g = guestOf(id);
    const plan = g ? planFor(g, sec.dataset.guestSection ?? '') : null;
    sec.setAttribute('data-role-drop', plan && plan.kind !== 'refuse' && plan.kind !== 'stay' ? 'ok' : plan?.kind === 'refuse' ? 'no' : 'here');
  };

  const stopListening = useRef<() => void>(() => {});

  const settle = useCallback(() => {
    const h = held.current;
    held.current = null;
    cancelAnimationFrame(raf.current);
    h?.ghost.remove();
    h?.el.removeAttribute('data-role-lifted');
    over.current?.removeAttribute('data-role-drop');
    over.current = null;
    document.documentElement.style.removeProperty('user-select');
  }, []);

  const loop = useCallback(() => {
    const h = held.current;
    if (!h) return;
    /* ✋ Near the list's edge it scrolls by itself, faster the nearer — the ONE shared edge scroll, on the part of the
       list the finger can SEE: under the pinned top row and above the thumb row (on a phone they cover ~120 px and
       ~180 px of the page, so the page's own band would start scrolling only over the menu). Anywhere above still
       means "further up" (the Maker scene's reach). */
    const v = dragEdgeStep(h.y, seenBand(h.scroller), { pastTop: Infinity });
    if (v) {
      dragScrollBy(h.scroller, v);
      mark(sectionAt(h.x, h.y), h.id);
    }
    raf.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM helpers only
  }, []);

  const lift = useCallback(
    (x: number, y: number) => {
      const p = pending.current;
      if (!p || held.current) return;
      if (p.timer) clearTimeout(p.timer);
      const r = p.el.getBoundingClientRect();
      const ghost = p.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-guest-row');
      ghost.removeAttribute('data-search-result');
      ghost.removeAttribute('data-tour');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.dataset.roleGhost = '';
      Object.assign(ghost.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: '0',
        zIndex: '9999',
        pointerEvents: 'none',
        transform: `translate(${r.left}px,${r.top}px) scale(1.02)`,
        boxShadow: '0 18px 34px -14px rgba(44,42,41,.55)',
        background: 'var(--sn-surface)',
        borderRadius: 'var(--m-r-md)',
        willChange: 'transform',
      });
      document.body.appendChild(ghost);
      p.el.setAttribute('data-role-lifted', '');
      document.documentElement.style.setProperty('user-select', 'none');
      held.current = { id: p.id, el: p.el, ghost, ox: x - r.left, oy: y - r.top, x, y, scroller: dragScrollerOf(p.el), wandered: false, startX: p.x, startY: p.y, touch: p.touch };
      try {
        navigator.vibrate?.(10);
      } catch {
        /* no haptics here */
      }
      raf.current = requestAnimationFrame(loop);
    },
    [loop],
  );

  useEffect(() => {
    const box = listRef.current;
    if (!on || !box) return;

    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || e.pointerId !== p.pid) return;
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!held.current) {
        // A touch that moves before the hold ends is a scroll — let it be one. A mouse lifts at 4 px.
        if (p.touch) {
          if (moved > TAP_SLOP_TOUCH) stop();
          return;
        }
        if (moved > TAP_SLOP_MOUSE) lift(e.clientX, e.clientY);
        if (!held.current) return;
      }
      e.preventDefault();
      const h = held.current!;
      h.x = e.clientX;
      h.y = e.clientY;
      if (!h.wandered && moved > (h.touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE)) h.wandered = true;
      h.ghost.style.transform = `translate(${h.x - h.ox}px,${h.y - h.oy}px) scale(1.02)`;
      mark(sectionAt(h.x, h.y), h.id);
    };
    const onUp = (e: PointerEvent) => {
      const p = pending.current;
      if (p && e.pointerId !== p.pid) return;
      const h = held.current;
      stop();
      if (!h) return; // a quick tap: the row opens its card, as ever
      swallowNextClick();
      const sec = h.wandered ? sectionAt(e.clientX, e.clientY) : null;
      settle();
      if (!h.wandered) {
        // 🖐 TAP · MOVE: held and let go where it was — now tap the section they go to.
        const g = guestOf(h.id);
        if (g) setCarried({ id: h.id, name: live.current.nameOf(g) });
        return;
      }
      if (sec?.dataset.guestSection) dropOn(h.id, sec.dataset.guestSection);
    };
    const onCancel = () => {
      stop();
      settle();
    };
    function stop() {
      const p = pending.current;
      if (p?.timer) clearTimeout(p.timer);
      pending.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    }
    stopListening.current = stop;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || held.current || pending.current) return;
      const t = e.target as HTMLElement;
      // The row's own buttons (Share, Delete, a jump) keep their press.
      if (t.closest('[data-row-acts], [data-jump-to], [data-jump-kids]')) return;
      const el = t.closest<HTMLElement>('[data-guest-row]');
      const id = el?.dataset.guestId;
      if (!el || !id || !box.contains(el)) return;
      const g = guestOf(id);
      if (!g || !mayDragForRole(g)) return;
      const touch = e.pointerType !== 'mouse';
      pending.current = { el, id, x: e.clientX, y: e.clientY, touch, pid: e.pointerId, timer: null };
      pending.current.timer = setTimeout(() => lift(e.clientX, e.clientY), ROLE_HOLD_MS);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    };
    /* 📱 While a guest is lifted the page must not scroll under the finger (the edges scroll instead). On the list from
       the start: a browser decides at touchstart whether anything may block its scroll. */
    const block = (e: TouchEvent) => {
      if (held.current) e.preventDefault();
    };
    /* The hold must not open the phone's own long-press menu over the name. */
    const noMenu = (e: Event) => {
      if (held.current || pending.current) e.preventDefault();
    };
    // The List marks itself as holdable (no copy menu on a held name) — on the element, so its markup is unchanged.
    box.setAttribute('data-role-drag', '');
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('touchmove', block, { passive: false });
    box.addEventListener('contextmenu', noMenu);
    return () => {
      stop();
      settle();
      box.removeAttribute('data-role-drag');
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('touchmove', block);
      box.removeEventListener('contextmenu', noMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `live` carries the rest
  }, [on, listRef, lift, settle, dropOn]);

  /* 🖐 TAP · MOVE: while someone is carried, a tap on a section puts them there; a tap anywhere else puts them back. */
  useEffect(() => {
    if (!carried) return;
    const box = listRef.current;
    const lit = new Set<HTMLElement>();
    const g = guestOf(carried.id);
    box?.querySelectorAll<HTMLElement>('[data-guest-section]').forEach((sec) => {
      const plan = g ? planFor(g, sec.dataset.guestSection ?? '') : null;
      if (plan && (plan.kind === 'role' || plan.kind === 'guests_of')) {
        sec.setAttribute('data-role-drop', 'ok');
        lit.add(sec);
      }
    });
    const tap = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-role-carry-bar]')) return;
      e.preventDefault();
      e.stopPropagation();
      const sec = box && t.closest<HTMLElement>('[data-guest-section]');
      setCarried(null);
      if (sec && box?.contains(sec) && sec.dataset.guestSection) dropOn(carried.id, sec.dataset.guestSection);
    };
    window.addEventListener('click', tap, true);
    return () => {
      window.removeEventListener('click', tap, true);
      lit.forEach((sec) => sec.removeAttribute('data-role-drop'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `live` carries the rest
  }, [carried, listRef, dropOn]);

  /* Leaving Role grouping (or Select) mid-move puts the guest back. */
  useEffect(() => {
    if (on) return;
    setCarried(null);
    setAsking(null);
  }, [on]);

  /* The one question opens at once — the PickMenu is already in the finger's reach. */
  const askRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asking) return;
    const id = requestAnimationFrame(() => askRef.current?.querySelector<HTMLButtonElement>('[data-role-drop-pick]')?.click());
    return () => cancelAnimationFrame(id);
  }, [asking]);

  const answer = (key: string) => {
    const a = asking;
    setAsking(null);
    if (!a) return;
    if (a.kind === 'role') void commitRole(a.id, key as GuestRole, a.landsIn);
    else void commitPlusOne(a.id, key, a.landsIn);
  };

  const shell = (attr: string, body: ReactNode) =>
    typeof document === 'undefined'
      ? null
      : createPortal(
          <div
            {...{ [attr]: '' }}
            role="status"
            className="sn-glass-bare fixed left-[max(0px,var(--sn-safe-l))] right-[max(0px,var(--sn-safe-r))] bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[90] mx-auto flex w-[min(100%-32px,480px)] flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-[14px] text-ink"
          >
            {body}
          </div>,
          document.body,
        );

  const bar = asking
    ? shell(
        'data-role-ask-bar',
        <div ref={askRef} className="flex w-full flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1">
            {asking.kind === 'role' ? `${asking.name}: which role in ${asking.label}?` : `${asking.name}: whose guest?`}
          </span>
          <PickMenu
            label={asking.kind === 'role' ? `${asking.name}’s role in ${asking.label}` : `Whose guest ${asking.name} is`}
            value={null}
            options={asking.choices}
            onPick={answer}
            dataAttr="data-role-drop-pick"
            buttonText={asking.kind === 'role' ? 'Pick a role' : 'Pick who'}
            compact
          />
          <ActionButton tone="neutral" icon={X} label="Cancel" name="Cancel the move" onClick={() => setAsking(null)} />
        </div>,
      )
    : carried
      ? shell(
          'data-role-carry-bar',
          <>
            <span className="min-w-0 flex-1">Tap a section to move {carried.name} there.</span>
            <ActionButton tone="neutral" icon={X} label="Cancel" name="Put them back" onClick={() => setCarried(null)} />
          </>,
        )
      : null;

  return { bar };
}
