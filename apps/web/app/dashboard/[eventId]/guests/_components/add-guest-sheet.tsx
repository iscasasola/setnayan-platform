'use client';

/**
 * add-guest-sheet.tsx — the add sheet: a name box, then the other ways in.
 *
 * ⚖ 2026-10-25 — THE ROUND + IS GONE (owner, verbatim: *"Yes, remove the + on the guest list. Typing in the search
 * adds; put From People, Import and Scan in the search results and the menu."*). The search field is the add (Enter,
 * or the "Add “…” as a guest" row); the other ways are rows in the typed results and items in ≡ (`ADD_WAYS`). This
 * sheet stays as the place a one-name line lands (it needs a last name) and as the empty list's "Add a guest".
 * What follows is the sheet's history.
 *
 * ⚖ Owner 2026-10-01 (via the controller): the phone's Add is a round + (frame
 * 2 of the approved simple phone app) → *"this also should be visible on desktop
 * mode?"* → *"okay keep it similar"*: the computer uses the SAME round + and the
 * SAME sheet. Tapping + opens it: first "Type a name…" (Enter adds — the shipped
 * `CaptureBar`, its parser and its `addSingleGuest`, reused whole — and each name
 * typed is listed under the box at once, `JustAdded`), then the other
 * ways in, as rows: from your People · the full add form · import · a quick add
 * list (`AddDoors`, the same four the ⋯ lists). No new server action.
 *
 * The header's capture bar is gone; this is where it lives now.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { GuestSide } from '@/lib/guests';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GuestPopup } from './guest-popup';
import { CaptureBar } from './capture-bar';
import { JustAdded } from './just-added';
import { openQuickAdd } from './quick-add-sheet';
import { openAddFromPeople } from './add-from-people-sheet';

const OPEN_EVENT = 'setnayan:add-guest-open';

/**
 * Open the sheet from code, optionally with a name already in the box — the
 * Guests search box's `＋ Add` (Maker PR 4f, G3: no match → it is probably a
 * name). The SAME event the round + and the empty list's button dispatch.
 */
export function openAddGuest(name = ''): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { name } }));
}

/**
 * The four other ways in — ONE list (G2, owner 2026-10-07: any set of choices is one dropdown), read by THREE places
 * that must never disagree: this sheet's "Add another way" dropdown, the thumb row's ≡ menu and the rows a typed
 * search draws at the top of its results (owner 2026-10-25, verbatim: *"Yes, remove the + on the guest list. Typing
 * in the search adds; put From People, Import and Scan in the search results and the menu."*). The words are
 * `AddDoors`' words (capture-bar.tsx), the same openers and links.
 *
 * ⚠ "Scan" is in the owner's sentence but NO scan-a-list way ships (re-measured 2026-10-25: nothing under
 * guests/ opens a camera to read a paper list; the check-in desk's scan is arrivals, not adding). It is not invented
 * here — an open owner question, recorded in DECISION_LOG 2026-10-25.
 */
export const ADD_WAYS = [
  { key: 'people', label: 'From your people' },
  { key: 'details', label: 'Add with details' },
  { key: 'import', label: 'Import a file' },
  { key: 'paste', label: 'Paste many names' },
] as const;
export type AddWayKey = (typeof ADD_WAYS)[number]['key'];

/**
 * Open one of the ways — the IMPORTED openers, never an event name re-dispatched by hand (capture-bar.tsx says why:
 * a button that typed the string itself keeps compiling and quietly stops opening anything).
 */
export function openAddWay(key: AddWayKey, eventId: string, push: (href: string) => void): void {
  if (key === 'people') openAddFromPeople();
  else if (key === 'details') openQuickAdd();
  else if (key === 'import') push(`/dashboard/${eventId}/guests/import`);
  else push(`/dashboard/${eventId}/guests/quick`);
}

/**
 * The round + — in the Guests page HEADER, beside ⋯, at every width (owner
 * 2026-10-01, DECISION_LOG "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS · HUB ·
 * MORE": no floating button at the bottom). Same circle and size as the ⋯.
 */
export function OpenAddGuestButton({ label }: { label: string }) {
  return (
    <span className="contents" data-guests-add-plus="">
      <ActionButton
        tone="brand"
        main
        iconOnly
        icon={Plus}
        label={label}
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      />
    </span>
  );
}

/**
 * The empty list's one button (first-timer fix 11, 2026-10-02): "No guests yet."
 * + **Add a guest** — the SAME sheet the header + opens, so there is one way in,
 * worded, where the eye lands on an empty page.
 */
export function OpenAddGuestTextButton({ label }: { label: string }) {
  return (
    <span className="contents" data-guests-empty-add="">
      <ActionButton
        tone="brand"
        main
        icon={Plus}
        label={label}
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      />
    </span>
  );
}

export function AddGuestSheet({
  eventId,
  defaultSide,
  tips,
}: {
  eventId: string;
  /** A new guest's side (the shipped CaptureBar's `defaultSide`). */
  defaultSide: GuestSide;
  /** One example line + the Tips ▾ fold (`lib/quick-add-tips.ts`). */
  tips?: { example: string; tips: string[] };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [openedAt, setOpenedAt] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string } | null>).detail;
      setName(detail?.name ?? '');
      setOpenedAt(Date.now());
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // ⚖ Drawn on <body> by `GuestPopup` (guests-phone-menu.tsx says why: inside the page's
  // `view-transition-name` <main> no z-index rises above the bottom bar), dark and blurred behind
  // (`.sn-popup-dark`), a tap on the dark closes it, and nothing behind it works or scrolls.
  // Mounted only while open — mount = open.
  if (!open) return null;
  return (
    <GuestPopup
      onClose={() => setOpen(false)}
      rootClassName="fixed inset-0 z-50 flex items-end justify-center tab:items-stretch tab:justify-end"
      panelClassName="relative max-h-[85vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-cream px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 tab:max-h-none tab:w-[min(27.5rem,calc(100vw-3.5rem))] tab:rounded-none tab:rounded-l-3xl"
      panelData={{ 'data-add-guest-sheet': '' }}
      label="Add a guest"
      focusFirstInput
    >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Add a guest</span>
          <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setOpen(false)} />
        </div>
        <div data-add-guest-name="">
          <CaptureBar
            key={name}
            eventId={eventId}
            defaultSide={defaultSide}
            withDoors={false}
            placeholder="Type a name…"
            initialValue={name}
          />
        </div>
        {/* ⚡ Every name typed here, drawn the moment Enter is pressed — "Adding…", then "Added", or why not with Retry
            (guest-add-queue.ts). The sheet covers the List, so the names are shown where the host is looking. */}
        <JustAdded eventId={eventId} variant="sheet" since={openedAt} />
        {/* ⚖ What the name box understands (owner 2026-10-01): ONE example line
            that fits this event, and one fold — never a wall of text. The words
            come from `lib/quick-add-tips.ts`, each read by the shipped parser. */}
        {tips ? (
          <div className="-mt-2 space-y-1.5" data-add-guest-tips="">
            <p className="text-xs text-ink/55">{tips.example}</p>
            <details className="group text-xs text-ink/60">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-ink/70">
                Tips
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden />
              </summary>
              <ul className="mt-1.5 space-y-1">
                {tips.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
        {/* ⚖ THE FOUR OTHER WAYS IN ARE ONE DROPDOWN (Maker PR 4f, G2): they
            lived as rows here and again behind the retired ⋯; now one list,
            "Add another way". Picking one closes this sheet and opens theirs. */}
        <div className="space-y-1.5 border-t border-ink/10 pt-3" data-add-guest-doors="">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/55">Add another way</p>
          <PickMenu
            label="Add another way"
            value={null}
            buttonText="From your people"
            options={ADD_WAYS.map((o) => ({ key: o.key, label: o.label }))}
            dataAttr="data-add-another-way"
            onPick={(key) => {
              setOpen(false);
              openAddWay(key as AddWayKey, eventId, (href) => router.push(href));
            }}
          />
        </div>
    </GuestPopup>
  );
}
