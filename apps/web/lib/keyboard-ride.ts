/**
 * keyboard-ride.ts — THE ONE READING OF THE PHONE'S KEYBOARD (owner 2026-10-24, "Yes", on
 * `prototypes/keyboard_rides_the_input_2026-10-24.html`: *"This should be a template that will make everyone adapt."*).
 *
 * A phone's on-screen keyboard shrinks the VISUAL viewport only (iPhone Safari, Android Chrome); the layout viewport,
 * and every `position: fixed` box anchored to it, keeps its full height and sits under the keyboard. The keyboard used
 * to be measured in eight places, three ways (the Maker shell's height, a typing bar's bottom, the clear band's floor).
 * This module is the only reader of `window.visualViewport` (`every-bottom-input-rides-the-keyboard.test.ts`); every
 * consumer reads the numbers below instead.
 *
 * ONE listener, shared: the first subscriber installs it on `visualViewport` (resize + scroll) and on the iOS app's
 * keyboard events; the last one to leave removes it. While anything listens it PUBLISHES on `<html>`:
 *   · `--sn-keyboard-h`        how much of the layout viewport the keyboard covers (`bottom`, px; 0 when closed);
 *   · `--sn-ride-h`            ONLY while the keyboard is up: where a row that stands on the bottom bar stands instead
 *                               (`bottom: var(--sn-ride-h, var(--sn-bottomdock-h))`) — the keyboard's top. Removed when
 *                               it closes, so the row is back on the bar. `--sn-bottomdock-h` stays the bar's own
 *                               height throughout (the page's bottom padding and every other reader keep their number);
 *   · `data-keyboard="open"`   while the keyboard is up (the rule below), so CSS can answer without state — the bottom
 *                               bar slides away under it (`bottom-nav.tsx`).
 *
 * THE OPEN RULE is the Maker shell's (2026-09-25): the visual viewport is at scale 1 (never a pinch-zoom) and at least
 * 80 px shorter than the layout one.
 *
 * 📱 THE iOS APP (`apps/mobile/capacitor.config.ts`: `Keyboard.resize = 'native'`): the WebView itself shrinks, so the
 * visual and layout viewports stay equal — `bottom` reads 0 and the open rule never fires from the viewport. The
 * Capacitor Keyboard plugin dispatches `keyboardWillShow` / `keyboardWillHide` on `window` inside the WebView; those
 * set `open` directly. A box at `bottom: var(--sn-keyboard-h)` (= 0 there) then stands on the WebView's foot, which IS
 * the keyboard's top — both paths land on the same pixel.
 */
import { useSyncExternalStore } from 'react';

export type KeyboardRead = {
  /** The keyboard is up (the Maker shell's rule, or the iOS app's keyboard event). */
  open: boolean;
  /** How much of the LAYOUT viewport's foot the keyboard covers: innerHeight − (offsetTop + height). Never < 0. */
  bottom: number;
  /** The visual viewport's top offset in the layout viewport (0 without one). */
  offsetTop: number;
  /** The visual viewport's height (`innerHeight` without one). */
  height: number;
  /** The visual viewport's scale (1 without one). */
  scale: number;
  /** False where the browser has no `visualViewport` (old browsers, the server). */
  present: boolean;
};

/** Why a listener was called — some readers answer the keyboard moving only (`guest-group-picker.tsx`). */
export type KeyboardCause = 'resize' | 'scroll' | 'app' | 'window';

const CLOSED: KeyboardRead = { open: false, bottom: 0, offsetTop: 0, height: 0, scale: 1, present: false };

/** The Maker shell's rule (2026-09-25): at scale 1, the visual viewport at least 80 px shorter than the layout one. */
export function keyboardIsOpen(scale: number, visualHeight: number, layoutHeight: number): boolean {
  return Math.abs(scale - 1) < 0.01 && visualHeight < layoutHeight - 80;
}

/** The iOS app's word, from its keyboard events (null = no word: the viewport decides). Trusted only while a field
 *  that takes typing has the focus — a late `keyboardDidShow` after a hide can never leave the bar hidden. */
let appOpen: boolean | null = null;

/** A field that takes typing (where an on-screen keyboard can be up). */
export function isTypingField(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') return !['date', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'hidden', 'range', 'color', 'image'].includes((el as HTMLInputElement).type);
  return (el as HTMLElement).isContentEditable === true;
}

/** A fresh reading. Safe on the server (closed). */
export function readKeyboard(): KeyboardRead {
  if (typeof window === 'undefined') return CLOSED;
  const vv = window.visualViewport;
  const inner = window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const height = vv?.height ?? inner;
  const scale = vv?.scale ?? 1;
  const bottom = Math.max(0, inner - (offsetTop + height));
  const viewportOpen = vv ? keyboardIsOpen(scale, height, inner) : false;
  const open = appOpen === true ? isTypingField(document.activeElement) || viewportOpen : viewportOpen;
  return { open, bottom, offsetTop, height, scale, present: Boolean(vv) };
}

type Listener = (k: KeyboardRead, cause: KeyboardCause) => void;
const listeners = new Set<Listener>();
let snapshot: KeyboardRead = CLOSED;
let uninstall: (() => void) | null = null;

/** Write the two published values on `<html>` — only when they change (this runs on every scroll frame). */
let lastH = -1;
let lastOpen: boolean | null = null;
let lastRide: string | null = null;
function publish(k: KeyboardRead) {
  const root = document.documentElement;
  const h = k.open ? Math.round(k.bottom) : 0;
  if (h !== lastH) {
    lastH = h;
    root.style.setProperty('--sn-keyboard-h', `${h}px`);
  }
  const ride = k.open ? `${Math.round(k.bottom)}px` : null;
  if (ride !== lastRide) {
    lastRide = ride;
    if (ride) root.style.setProperty('--sn-ride-h', ride);
    else root.style.removeProperty('--sn-ride-h');
  }
  if (k.open !== lastOpen) {
    lastOpen = k.open;
    if (k.open) root.setAttribute('data-keyboard', 'open');
    else root.removeAttribute('data-keyboard');
  }
}

function emit(cause: KeyboardCause) {
  const next = readKeyboard();
  // A new object only when something moved — `useSyncExternalStore` compares by identity.
  if (
    next.open !== snapshot.open ||
    next.bottom !== snapshot.bottom ||
    next.offsetTop !== snapshot.offsetTop ||
    next.height !== snapshot.height ||
    next.scale !== snapshot.scale ||
    next.present !== snapshot.present
  ) {
    snapshot = next;
  }
  publish(snapshot);
  for (const fn of listeners) fn(snapshot, cause);
}

type PluginHandle = { remove: () => unknown };
type KeyboardPlugin = { addListener: (event: string, fn: () => void) => PluginHandle | Promise<PluginHandle> };

function install(): () => void {
  const vv = window.visualViewport;
  const onResize = () => emit('resize');
  const onScroll = () => emit('scroll');
  const onWindow = () => emit('window');
  const onAppShow = () => {
    appOpen = true;
    emit('app');
  };
  const onAppHide = () => {
    appOpen = null;
    emit('app');
  };
  /* A field gaining or losing the focus re-reads (the app's word holds only while a field has it). */
  const onFocusMove = () => window.setTimeout(() => emit('window'), 0);
  vv?.addEventListener('resize', onResize);
  vv?.addEventListener('scroll', onScroll);
  window.addEventListener('resize', onWindow);
  document.addEventListener('focusin', onFocusMove);
  document.addEventListener('focusout', onFocusMove);
  /* The iOS app: the Capacitor Keyboard plugin's window events AND its listener API (either may be the one the remote
     page receives — both say the same thing, so hearing one twice is harmless). */
  const appEvents: Array<[string, () => void]> = [
    ['keyboardWillShow', onAppShow],
    ['keyboardDidShow', onAppShow],
    ['keyboardWillHide', onAppHide],
    ['keyboardDidHide', onAppHide],
  ];
  for (const [name, fn] of appEvents) window.addEventListener(name, fn);
  const plugin = (window as unknown as { Capacitor?: { Plugins?: { Keyboard?: KeyboardPlugin } } }).Capacitor?.Plugins?.Keyboard;
  const handles: Array<PluginHandle | Promise<PluginHandle>> = [];
  if (plugin && typeof plugin.addListener === 'function') {
    for (const [name, fn] of appEvents) {
      try {
        handles.push(plugin.addListener(name, fn));
      } catch {
        /* an older plugin without this event — the window events still speak */
      }
    }
  }
  return () => {
    vv?.removeEventListener('resize', onResize);
    vv?.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onWindow);
    document.removeEventListener('focusin', onFocusMove);
    document.removeEventListener('focusout', onFocusMove);
    for (const [name, fn] of appEvents) window.removeEventListener(name, fn);
    for (const h of handles) void Promise.resolve(h).then((x) => x?.remove?.()).catch(() => {});
    appOpen = null;
    const root = document.documentElement;
    root.style.removeProperty('--sn-keyboard-h');
    root.style.removeProperty('--sn-ride-h');
    root.removeAttribute('data-keyboard');
    lastH = -1;
    lastOpen = null;
    lastRide = null;
  };
}

/**
 * Listen to the keyboard. `fn` gets every reading (with its cause); `opts.now` also calls it once at once. Returns the
 * cleanup. The shared listener is installed by the first subscriber and removed with the last.
 */
export function subscribeKeyboard(fn: Listener, opts: { now?: boolean } = {}): () => void {
  if (typeof window === 'undefined') return () => {};
  listeners.add(fn);
  if (!uninstall) {
    uninstall = install();
    snapshot = readKeyboard();
    publish(snapshot);
  }
  if (opts.now) fn(readKeyboard(), 'window');
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && uninstall) {
      uninstall();
      uninstall = null;
      snapshot = CLOSED;
    }
  };
}

/** `useSyncExternalStore`'s three — the hook below, kept here so a store-shaped reader needs no React. */
export const keyboardStore = {
  subscribe: (onChange: () => void) => subscribeKeyboard(() => onChange()),
  // The cached reading (closed until the first subscriber installs the listener — React re-reads after subscribing).
  get: () => snapshot,
  server: () => CLOSED,
};

/** The bottom of what can be seen, in layout-viewport px: the keyboard's top while it is up (`reveal-above-chrome.ts`). */
export function visibleBottom(): number {
  if (typeof window === 'undefined') return 0;
  const k = readKeyboard();
  return k.present ? Math.min(window.innerHeight, k.offsetTop + k.height) : window.innerHeight;
}

/**
 * THE HOOK — `{ open, bottom, … }`, re-rendering as the keyboard moves. Mounting it is also what publishes
 * `--sn-keyboard-h` / `data-keyboard` (the bottom bar mounts it on every page that has one).
 */
export function useKeyboardRide(): KeyboardRead {
  return useSyncExternalStore(keyboardStore.subscribe, keyboardStore.get, keyboardStore.server);
}
