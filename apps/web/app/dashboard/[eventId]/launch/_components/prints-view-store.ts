'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import type { PickNoun } from '@/lib/print-picked-guests';
import type { PrintGuest } from '@/lib/studio-prints-settings';
import type { StudioChartInput, StudioPaper } from './print-paper';

/**
 * 🖨 STUDIO › PRINTS' SHARED PICKS — the guest View as ▾ shows (ONE pick for every guest print), what each print's SLIDE holds, and
 * the ⚙ Print settings sheet's open state. A store, not a context: the prints are separate lazy pieces under a server-drawn form,
 * with no common client parent to hold a provider.
 *
 * 🎠 THE CAROUSEL READS THE SLIDES (owner 2026-10-26, *"So we can make like a swipe carousel type where they can see the preview
 * larger then under is the toolbar to pick style? and download options?"*; DECISION_LOG "APPROVED — PRINTS IS A SWIPE CAROUSEL"):
 * each print's part (`maker-prints.tsx` → `StudioTool`) no longer draws a row — it REGISTERS its slide here (its picture, its
 * size ▾, its guests, its files, its count line) and `studio-prints-carousel.tsx` draws one slide per print from what is registered.
 * The files and routes are the parts' own: the carousel never builds an address.
 */

const LISTENERS = new Set<() => void>();
let tick = 0;
const tell = () => {
  tick += 1;
  for (const l of LISTENERS) l();
};
const subscribe = (l: () => void) => {
  LISTENERS.add(l);
  return () => {
    LISTENERS.delete(l);
  };
};

/* ── the guest every guest print shows ─────────────────────────────────────────────────────────────────────────────────────── */

const GUESTS = new Map<string, string>();

/** The guest every guest print shows — ONE pick per event (pick a guest once and every guest print redraws for them). */
export function usePrintGuest(eventId: string, fallback: string | null): [string | null, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, () => GUESTS.get(eventId) ?? fallback, () => fallback);
  return [id, (next) => {
    GUESTS.set(eventId, next);
    tell();
  }];
}

/* ── what a slide holds ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** An all-guests file — `icon`: the ◆ unlocked mark on a Pro file; none on a free all-guests file (2026-10-22). */
export type AllInOneF =
  | { kind: 'save'; href: string; file: string; label: string; icon?: ReactElement }
  | { kind: 'door'; href: string; label: string; icon: ReactElement; note: { title: string; body: string } }
  | null;

/** The print's size ▾ — a pick NAVIGATES to the same address the row's `PrintChoicePicker` always did. */
export type SlideSize = { label: string; value: string; dataAttr?: string; options: Array<{ key: string; label: string; href: string }> };

/** A guest print (the Event pass · Digital ticket · Guest QR codes · Table signs & place cards). */
export type SlideGuests = {
  eventId: string;
  /** Who this file holds, in its own order; null — the list could not be read (said, never "nobody"). */
  guests: readonly PrintGuest[] | null;
  /** The picture's `src` carries the guest (`GUEST_TOKEN`) — the slide redraws for the guest View as ▾ shows. */
  guestPicture: boolean;
  /** One guest's file — `GUEST_TOKEN` / `GUEST_WORD_TOKEN` stand where the guest goes. */
  one: { href: string; file: string };
  /** Every guest's file (free, or the ◆ door). */
  all: AllInOneF;
  /** The count line, word for word (`guestPrintCountLine`). */
  holds: string;
  /** Said when nobody is on this file yet. */
  none: string;
  /** Pick guests… — offered only where All guests itself saves (a ◆ door is not a file). */
  pickNoun: PickNoun | null;
};

export type PrintSlide = {
  name?: string;
  /** The spec line under the name — the chosen size, never every size. */
  line?: string;
  paper?: StudioPaper;
  size?: SlideSize | null;
  /** A print with two files and ONE dropdown (the seat plan's Colours ▾, the caterer's File ▾) — the pick is the file. */
  choice?: { label: string; options: ReadonlyArray<{ key: string; label: string; href: string; file: string }> } | null;
  guest?: SlideGuests;
  /** A plain print's ONE file — one press, one file. Null: nothing to save yet (no menu, no Love Story). */
  download?: { href: string; file: string; label: string } | null;
  /** Everything ◆ — every piece in one PDF. */
  everything?: { line: string; holds: string | null; all: AllInOneF };
  /** 🪧 The entrance chart — its size and layout are the chart's own pick (`useChartPick`). */
  chart?: StudioChartInput;
  /** "Changed since you printed" — said inside the ⓘ. */
  changed?: ReactNode;
  /** What the piece's printed stamp is read against (`lib/printed-stamp.ts`) — the small amber dot on the name when it applies. */
  printed?: { eventId: string; piece: string; version: string | null };
  /** Content a print needs that is not a setting (the Menu's dishes): opened from the ⓘ and the slide's empty line. */
  edit?: { label: string; body: ReactNode } | null;
  /** What the ⓘ says — words the print already carried (its blurb, the set's free/Pro rule). */
  tip?: string;
};

const SLIDES = new Map<string, Map<string, PrintSlide>>();

/** The parts of a slide that are React nodes or functions — never compared, only drawn. */
const NOT_COMPARED = new Set(['changed', 'body', 'icon', 'note']);

/**
 * A part registers ITS share of a slide (`part`): a plain print's head and its Download are two parts of one slide. Unmounted, its
 * share leaves; the carousel merges the shares.
 */
export function useRegisterSlide(item: string, part: string, slide: PrintSlide) {
  const key = JSON.stringify(slide, (k, v) => (NOT_COMPARED.has(k) ? undefined : v));
  const told = useRef<string | null>(null);
  /* Every render hands the store the newest share (its nodes are the newest the server drew); the carousel is told only when
     something it compares moved. */
  useEffect(() => {
    const parts = SLIDES.get(item) ?? new Map<string, PrintSlide>();
    parts.set(part, slide);
    SLIDES.set(item, parts);
    if (told.current !== key) {
      told.current = key;
      tell();
    }
  });
  useEffect(
    () => () => {
      SLIDES.get(item)?.delete(part);
      tell();
    },
    [item, part],
  );
}

/** Every registered slide, its parts merged. */
export function usePrintSlides(): ReadonlyMap<string, PrintSlide> {
  useSyncExternalStore(subscribe, () => tick, () => 0);
  const out = new Map<string, PrintSlide>();
  for (const [item, parts] of SLIDES) {
    if (parts.size === 0) continue;
    out.set(item, Object.assign({}, ...parts.values()) as PrintSlide);
  }
  return out;
}

/* ── ⚙ Print settings: one sheet, opened from every slide ─────────────────────────────────────────────────────────────────── */

let settingsOpen = false;
export function setPrintSettingsOpen(open: boolean) {
  settingsOpen = open;
  tell();
}
export function usePrintSettingsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => settingsOpen, () => false);
}
