/**
 * 📶 R15 — NEEDS INTERNET (owner 2026-11-24, DECISION_LOG "The supplier dashboard works offline…", the greyed-buttons
 * ruling, and R18 for the guest Event Hub). One rule, on every side:
 *   · a control that cannot work without a connection STAYS IN PLACE and greys out, and its label says "Needs
 *     internet" — never hidden, never a broken page;
 *   · a tap shows one quiet line, "Needs internet · it works again when you're back online", and does nothing else
 *     (`aria-disabled`, so a screen reader says why);
 *   · it turns normal by itself when the signal returns.
 *
 * Which controls: (1) every door to an ADDRESS that needs internet, wherever that door is drawn
 * (`NEEDS_INTERNET_ADDRESSES` — the reply and its meal choices, a personal-link hop, the 3D walk and the avatar
 * maker, The Day's photos tab, the Maker, signing in or up), so a new door to one of them greys with no
 * change; and (2) a control marked `data-needs-internet` (Live Watch, the live photo wall, a guest's privacy request,
 * the song request). The Papic camera is NOT here: it already queues its shots offline.
 *
 * `startNeedsInternetGuard` is the one mechanism (mounted by `app/_components/offline-ready/needs-internet-guard.tsx`
 * on the guest Event Hub and on the couple's pages that open with no signal). It only writes ATTRIBUTES — never a
 * child of a React-drawn element — and removes only what it wrote. The look is `needs-internet.css` beside the guard.
 * Held by `lib/needs-internet.test.ts`, which runs this file against a document with the network off and on.
 */

export const NEEDS_INTERNET_ATTR = 'data-needs-internet';
export const NEEDS_INTERNET_WORD = 'Needs internet';
export const NEEDS_INTERNET_TAP = 'Needs internet · it works again when you’re back online';

/** Set on `<html>` while the browser says it is offline — the look keys on it. */
export const OFFLINE_ATTR = 'data-sn-offline';
/** The label the look draws after a control (or above a block): the word above. */
export const NI_WORD_ATTR = 'data-sn-ni-word';
/** A control the guard greyed (not an `ActionButton`, which wears its own waiting look). */
export const NI_GREY_ATTR = 'data-sn-ni-grey';
/** A block (not a button or a link) the guard greyed: its label sits above it, not after it. */
export const NI_BLOCK_ATTR = 'data-sn-ni-block';
/** Marks an `aria-disabled` / `data-waiting` the GUARD wrote — the only ones it ever removes. */
const NI_ARIA_SET = 'data-sn-ni-aria';
const NI_WAIT_SET = 'data-sn-ni-wait';

const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"]';

/** Not a guest page: an app area whose second word could look like an event page's. */
const APP_AREA = '(?!dashboard/|vendor-dashboard/|admin/|api/)';

/**
 * The addresses that need internet, as `pathname + search`. A door to one of them greys wherever it is drawn. None of
 * them is a page the guest's saved copy keeps (`lib/offline-copy-addresses.ts` — held disjoint by the test).
 */
export const NEEDS_INTERNET_ADDRESSES: ReadonlyArray<{ why: string; re: RegExp }> = [
  { why: 'the reply and its meal choices', re: new RegExp(`^/${APP_AREA}(?:[a-z0-9-]+/)?[a-z0-9-]+/invite(?:[/?#]|$)`) },
  { why: 'a personal-link hop', re: /[?&]invite=/ },
  { why: 'a pass hop', re: new RegExp(`^/${APP_AREA}(?:[a-z0-9-]+/)?[a-z0-9-]+/(?:redeem|open-as-pass)(?:[/?#]|$)`) },
  { why: 'the 3D walk and the avatar maker', re: new RegExp(`^/${APP_AREA}(?:[a-z0-9-]+/)?[a-z0-9-]+/(?:venue|avatar)(?:[/?#]|$)`) },
  { why: 'The Day’s photos tab (Memories)', re: /[?&]tab=gallery(?:&|#|$)/ },
  { why: 'the Maker', re: /^\/dashboard\/[^/?#]+\/launch(?:[/?#]|$)/ },
  { why: 'signing in or up', re: /^\/(?:login|signup)(?:[/?#]|$)/ },
];

/** Does a door to `href` (as drawn, resolved against the page's address) need internet? Same-origin only. */
export function needsInternetHref(href: string | null | undefined, pageHref: string): boolean {
  if (!href) return false;
  let at: URL;
  let page: URL;
  try {
    page = new URL(pageHref);
    at = new URL(href, page);
  } catch {
    return false;
  }
  if (at.origin !== page.origin) return false;
  const address = at.pathname + at.search;
  return NEEDS_INTERNET_ADDRESSES.some((a) => a.re.test(address));
}

type GuardWindow = Pick<Window, 'addEventListener' | 'removeEventListener' | 'location'> & {
  navigator: { onLine: boolean };
  requestAnimationFrame?: (cb: () => void) => number;
  MutationObserver?: typeof MutationObserver;
};

/**
 * Starts the one mechanism on a page. `say` shows the quiet line (the house toast). Returns the stop function.
 * Offline: every needs-internet control is `aria-disabled`, greyed and labelled, and a press on it is stopped before
 * any handler, link or form sees it. Online: every mark it wrote is gone, and the page is exactly as drawn.
 */
export function startNeedsInternetGuard(doc: Document, win: GuardWindow, say: (words: string) => void): () => void {
  const html = doc.documentElement;
  const offline = () => win.navigator.onLine === false;

  const targets = (): Element[] => {
    const out = new Set<Element>(Array.from(doc.querySelectorAll(`[${NEEDS_INTERNET_ATTR}]`)));
    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      if (needsInternetHref(a.getAttribute('href'), win.location.href)) out.add(a);
    }
    return [...out];
  };

  const press = (el: Element): Element[] => (el.matches(INTERACTIVE) ? [el] : Array.from(el.querySelectorAll(INTERACTIVE)));

  const mark = (el: Element) => {
    const actionButton = el.classList.contains('ab');
    const label = actionButton ? (el.querySelector('.lbl') ?? el) : el;
    label.setAttribute(NI_WORD_ATTR, NEEDS_INTERNET_WORD);
    if (actionButton) {
      if (!el.hasAttribute('data-waiting')) {
        el.setAttribute('data-waiting', '');
        el.setAttribute(NI_WAIT_SET, '');
      }
    } else {
      el.setAttribute(NI_GREY_ATTR, '');
      if (!el.matches(INTERACTIVE)) el.setAttribute(NI_BLOCK_ATTR, '');
    }
    for (const p of press(el)) {
      if (!p.hasAttribute('aria-disabled')) {
        p.setAttribute('aria-disabled', 'true');
        p.setAttribute(NI_ARIA_SET, '');
      }
    }
  };

  const clearAll = () => {
    for (const el of Array.from(doc.querySelectorAll(`[${NI_WORD_ATTR}],[${NI_GREY_ATTR}],[${NI_BLOCK_ATTR}]`))) {
      el.removeAttribute(NI_WORD_ATTR);
      el.removeAttribute(NI_GREY_ATTR);
      el.removeAttribute(NI_BLOCK_ATTR);
    }
    for (const el of Array.from(doc.querySelectorAll(`[${NI_ARIA_SET}]`))) {
      el.removeAttribute('aria-disabled');
      el.removeAttribute(NI_ARIA_SET);
    }
    for (const el of Array.from(doc.querySelectorAll(`[${NI_WAIT_SET}]`))) {
      el.removeAttribute('data-waiting');
      el.removeAttribute(NI_WAIT_SET);
    }
  };

  const apply = () => {
    if (offline()) {
      html.setAttribute(OFFLINE_ATTR, '');
      for (const el of targets()) mark(el);
    } else {
      html.removeAttribute(OFFLINE_ATTR);
      clearAll();
    }
  };

  // A press on a needs-internet control, offline: stopped here (capture), before any handler, link or form.
  const blocked = (target: EventTarget | null): boolean => {
    if (!offline()) return false;
    const el = target && (target as Element).closest ? (target as Element).closest(`[${NEEDS_INTERNET_ATTR}],a[href]`) : null;
    if (!el) return false;
    return el.hasAttribute(NEEDS_INTERNET_ATTR) || needsInternetHref(el.getAttribute('href'), win.location.href);
  };
  const stop = (e: Event, target: EventTarget | null) => {
    if (!blocked(target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    say(NEEDS_INTERNET_TAP);
  };
  const onClick = (e: Event) => stop(e, e.target);
  const onSubmit = (e: Event) => stop(e, (e as SubmitEvent).submitter ?? e.target);

  // Pages draw more after load (a soft navigation, a streamed part): marked as they arrive while offline.
  let queued = false;
  const later = () => {
    if (queued || !offline()) return;
    queued = true;
    const run = () => {
      queued = false;
      apply();
    };
    if (win.requestAnimationFrame) win.requestAnimationFrame(run);
    else run();
  };
  const observer = win.MutationObserver ? new win.MutationObserver(later) : null;

  doc.addEventListener('click', onClick, true);
  doc.addEventListener('submit', onSubmit, true);
  win.addEventListener('online', apply);
  win.addEventListener('offline', apply);
  if (doc.body) observer?.observe(doc.body, { childList: true, subtree: true });
  apply();

  return () => {
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('submit', onSubmit, true);
    win.removeEventListener('online', apply);
    win.removeEventListener('offline', apply);
    observer?.disconnect();
    html.removeAttribute(OFFLINE_ATTR);
    clearAll();
  };
}
