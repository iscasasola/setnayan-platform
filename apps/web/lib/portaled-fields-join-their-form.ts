/**
 * portaled-fields-join-their-form.ts
 *
 * 🔴 A FIELD PORTALED OUT OF ITS <form> POSTS NOTHING.
 *
 * `createPortal(…, document.body)` moves the DOM, not the meaning. React keeps
 * the portal inside the component tree — synthetic events still bubble to the
 * form's React handlers — but the BROWSER builds a form's data from the form's
 * DOM descendants plus the controls that name it with `form="<id>"`. A control
 * rendered under <body> is neither, so `new FormData(form)` and the form's
 * submit never see it.
 *
 * Measured 2026-10-14 on the service-card maker: since a1e6887ceb (2026-09-07)
 * its sheets portal to <body> to escape `.sn-page-enter`'s identity transform.
 * The photo, price, gift, what's-included, discounts, crew and lead-time inputs
 * all sit in those sheets, so a supplier's Save as draft posted only kind, name
 * and coverage — the card never painted them and Publish never opened.
 *
 * The fix keeps the portal (the transform problem is real) and puts back the
 * one thing the portal took: the association. Every form control inside the
 * portaled root gets `form="<id>"`, and so does every control mounted into it
 * later (an upload that lands, a row a vendor adds) — so it is by construction,
 * not a list of field names somebody has to remember to extend.
 *
 * Two controls are left alone on purpose:
 *   • one that already names a form (its author chose);
 *   • one inside a <form> of its OWN within the portal — a sibling form such as
 *     the maker's audience sheet must keep submitting to itself.
 */

/** Set on the portaled root so a field inside can find the form it belongs to. */
export const FORM_OWNER_ATTR = 'data-form-owner';

/** Every element the HTML spec lets join a form by its `form` attribute (bar `object`). */
export const FORM_CONTROL_SELECTOR = 'input, select, textarea, button, output, fieldset';

/** The minimal DOM surface used here — real Elements satisfy it; tests can fake it. */
type El = {
  matches(selector: string): boolean;
  querySelectorAll(selector: string): ArrayLike<El> & Iterable<El>;
  closest(selector: string): unknown;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
};

function join(el: El, formId: string): void {
  if (el.hasAttribute('form')) return;
  if (el.closest('form')) return;
  el.setAttribute('form', formId);
}

function sweep(node: El, formId: string): void {
  if (node.matches(FORM_CONTROL_SELECTOR)) join(node, formId);
  for (const el of Array.from(node.querySelectorAll(FORM_CONTROL_SELECTOR))) join(el, formId);
}

/**
 * Associate every form control under `root` — now and as it changes — with the
 * form whose id is `formId`. Returns the disconnect.
 */
export function joinPortaledFieldsToForm(root: Element, formId: string): () => void {
  const r = root as unknown as El;
  r.setAttribute(FORM_OWNER_ATTR, formId);
  sweep(r, formId);
  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      for (const n of Array.from(rec.addedNodes)) {
        if (n.nodeType === 1) sweep(n as unknown as El, formId);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/**
 * Input types whose Enter press would IMPLICITLY SUBMIT their form. Joining a
 * sheet's fields to the card form also makes Enter in them submit the card —
 * through its default button, which is "Publish service". Since the portal
 * shipped, Enter in a sheet did nothing; it must keep doing nothing rather than
 * publish a card from inside the price box. (Textareas take Enter as a newline
 * and never submit; checkboxes, radios and buttons never implicitly submit.)
 */
const NON_SUBMITTING_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'image',
  'checkbox',
  'radio',
  'file',
  'hidden',
  'range',
  'color',
]);

/** True when an Enter keydown on `target` would implicitly submit its form. */
export function enterWouldSubmit(
  key: string,
  target: { tagName?: string; type?: string } | null | undefined,
): boolean {
  if (key !== 'Enter' || !target || target.tagName !== 'INPUT') return false;
  return !NON_SUBMITTING_INPUT_TYPES.has((target.type ?? 'text').toLowerCase());
}

/**
 * The form a node belongs to: its enclosing <form>, else the form its portaled
 * root names. Use this instead of `closest('form')` anywhere a component can be
 * rendered inside a portaled sheet — `closest` is blind across the portal.
 */
export function ownerFormOf(node: Element | null | undefined): HTMLFormElement | null {
  if (!node || typeof node.closest !== 'function') return null;
  const direct = node.closest('form');
  if (direct) return direct;
  const host = node.closest(`[${FORM_OWNER_ATTR}]`);
  const id = host?.getAttribute(FORM_OWNER_ATTR);
  if (!id) return null;
  const found = node.ownerDocument?.getElementById(id);
  return found && found.tagName === 'FORM' ? (found as HTMLFormElement) : null;
}
