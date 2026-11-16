/**
 * build-version.ts — "the page you are looking at is older than the server".
 *
 * ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
 * We deploy on every merge, roughly every 15–25 minutes. A tab someone already
 * has open keeps talking to the build it loaded from. Sometimes that fails
 * LOUDLY — the JavaScript filenames are gone, the browser throws a
 * ChunkLoadError, and `lib/stale-bundle.ts` catches it and reloads once.
 *
 * 🔑 THE OTHER HALF THROWS NOTHING. On 2026-09-20 the owner's guest list went
 * blank after a server action: the action ran on the build his tab was loaded
 * from (05:17Z), the redirect's payload came back from a newer one (05:58Z),
 * and the router rendered NOTHING. No exception, so no error boundary, so no
 * stale-bundle reload — an empty page that looks exactly like an outage on a
 * site that is serving perfectly. He reasonably concluded we were broken. The
 * same thing had happened to him twice before, which is why stale-bundle.ts
 * exists at all; this is the case it cannot see.
 *
 * ── WHY THIS AND NOT VERCEL'S SKEW PROTECTION ──────────────────────────────
 * Skew Protection is the real fix: it PINS a tab to its own deployment so the
 * mismatch never happens. It is a Vercel project setting (not a `next.config`
 * option — that is the Astro adapter's API), and on 2026-09-20 enabling it via
 * the REST API returned `404 Skew Protection not found`: it is not available on
 * this account's plan. Until that changes, this module cannot PREVENT the skew.
 * It DETECTS it, and turns a blank screen into a sentence and a reload button.
 *
 * ⚠ So this is a mitigation, not a cure. If the plan ever allows Skew
 * Protection, turn it on — and KEEP this, because a tab open longer than the
 * pin's max age lands in exactly the same place.
 *
 * ── WHY THE DECISION LIVES HERE ────────────────────────────────────────────
 * The component that shows the bar is a client component doing fetches and
 * timers; a guard can only grep it. The part that can actually be got WRONG is
 * the comparison, so it sits here as a pure function a test can EXECUTE
 * against every shape the two ids arrive in.
 */

/** What the client bundle was built from. Inlined at build time — see next.config.ts. */
export const LOADED_BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '';

/**
 * Should we offer a reload?
 *
 * `loaded` is the version baked into this bundle; `serving` is what
 * `/api/health` reports right now (that route already returns
 * `VERCEL_GIT_COMMIT_SHA.slice(0, 7)`, force-dynamic and no-store — it was
 * built for Better Stack pings in iteration 0035 and needed no change).
 *
 * 🔑 EVERY "NO" HERE IS DELIBERATE. The failure mode of a version notice is
 * nagging someone whose page is fine, and a bar that cries wolf gets ignored
 * on the one day it is right:
 *
 *  · Either side missing → we do not know, so we say nothing. Locally and in
 *    any non-Vercel build both are `''` or `'dev'`.
 *  · `'dev'` on either side → the health route's own fallback when there is no
 *    commit sha. Not a version, so not a mismatch.
 *  · Equal → the common case, on every single check.
 *  · A `serving` value we could not parse (not a string) → silence.
 *
 * It returns true ONLY for two different, real, known versions.
 */
export function shouldOfferReload(
  loaded: unknown,
  serving: unknown,
): boolean {
  if (typeof loaded !== 'string' || typeof serving !== 'string') return false;
  const a = loaded.trim();
  const b = serving.trim();
  if (!a || !b) return false;
  if (a === 'dev' || b === 'dev') return false;
  return a !== b;
}

/** The shape `/api/health` answers with, narrowed to the one field we read. */
export function servingVersionFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as { version?: unknown }).version;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/* ── THE SITE UPDATES BY ITSELF WHEN NOTHING IS TYPED (owner ruling 22e93e56, 16 Nov 2026) ─────────────────────
 *
 * The notice above asked everyone to press Reload. Now a page holding NO unsaved typing takes the new version
 * silently — on its next in-app navigation (the link press becomes a full load) or when the tab is shown again —
 * and the notice stays ONLY for a page where something is typed: that page never reloads by itself.
 *
 * 🔑 Two rules carry the whole thing, both decided here so a test can EXECUTE them:
 *   · When in doubt it is typing. React keeps a controlled field's `defaultValue` in step with its `value`, so
 *     "value differs from default" alone would call a typed-in controlled field clean — a field that received an
 *     `input` event and is still on the page counts too. A wrong "typing" costs a notice; a wrong "clean" costs words.
 *   · Never in a loop: at most ONE self-update per served version, claimed in sessionStorage BEFORE reloading. A
 *     storage that throws cannot promise "once", so it never self-updates — the notice speaks instead.
 */

/** sessionStorage key of the one self-update a served version may cause. */
export const SELF_UPDATE_KEY_PREFIX = 'setnayan:self-updated:';

type FieldLike = {
  tagName?: string;
  type?: string;
  value?: string;
  defaultValue?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  isContentEditable?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  isConnected?: boolean;
  options?: ArrayLike<{ selected: boolean; defaultSelected: boolean }>;
};

/** Input types that carry no typing of their own. */
const NOT_TYPING_INPUT = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

function isEditable(el: FieldLike): boolean {
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return !el.disabled && !el.readOnly;
  if (tag === 'INPUT') return !NOT_TYPING_INPUT.has((el.type ?? 'text').toLowerCase()) && !el.disabled && !el.readOnly;
  return false;
}

/** A field whose current state differs from the one the page drew it with. */
export function fieldIsDirty(el: FieldLike): boolean {
  if (!isEditable(el) || el.isContentEditable) return false;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'SELECT') return Array.from(el.options ?? []).some((o) => o.selected !== o.defaultSelected);
  const type = (el.type ?? 'text').toLowerCase();
  if (type === 'checkbox' || type === 'radio') return Boolean(el.checked) !== Boolean(el.defaultChecked);
  return (el.value ?? '') !== (el.defaultValue ?? '');
}

/**
 * Does the page hold unsaved typing? A focused field (input · textarea · select · contenteditable), a dirty one,
 * or one the person typed into (`touched`) that is still on the page.
 */
export function hasUnsavedTyping(
  doc: { activeElement: unknown; querySelectorAll: (sel: string) => ArrayLike<unknown> },
  touched: (el: unknown) => boolean = () => false,
): boolean {
  const active = doc.activeElement as FieldLike | null;
  if (active && isEditable(active)) return true;
  const fields = Array.from(doc.querySelectorAll('input, textarea, select, [contenteditable]')) as FieldLike[];
  return fields.some((el) => isEditable(el) && (fieldIsDirty(el) || (touched(el) && el.isConnected !== false)));
}

/**
 * Claim the ONE self-update this served version may make. True = go ahead (the claim is already written); false =
 * already used, or storage cannot be trusted to remember — do not reload.
 */
export function claimSelfUpdate(storage: Pick<Storage, 'getItem' | 'setItem'> | null, serving: string): boolean {
  if (!storage) return false;
  try {
    const key = SELF_UPDATE_KEY_PREFIX + serving;
    if (storage.getItem(key)) return false;
    storage.setItem(key, '1');
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * What a stale tab does now: nothing (current), take the update silently, or show the notice.
 * `selfUpdateUsed` is true when this served version already made its one self-update.
 */
export function staleTabAction(input: {
  loaded: unknown;
  serving: unknown;
  typing: boolean;
  selfUpdateUsed: boolean;
}): 'none' | 'update' | 'notice' {
  if (!shouldOfferReload(input.loaded, input.serving)) return 'none';
  if (input.typing || input.selfUpdateUsed) return 'notice';
  return 'update';
}

/* ── THE NOTICE IS NEVER UNDER A SHEET (walk RW-7853-a, 16 Nov 2026) ─────────────────────────────────────────────
 *
 * The notice above speaks ONLY to a page holding typing — and the place people type most is the full-screen chat
 * thread, which on a phone fixes itself over the page at z 45 (globals.css "AN OPEN CHAT THREAD IS FULL SCREEN ON A
 * PHONE"). The notice stood in the page's flow at the top, so it was drawn UNDER the thread: the one person it was for
 * never saw it. Same under every Sheet (z 50), RiseScreen (pop, 40) and blocker.
 *
 * So: on a plain page it stays where the one notice system put it — in the flow, at the very top, never fixed over the
 * page. While a layer covers the page, it moves onto the app's top notification layer (the peek toast's place,
 * `PEEK_TOAST_PLACE`, z 100 — "over everything, it is a notification") until that layer goes. No new layer.
 */

/** What covers the page: an open modal (Sheet · RiseScreen · blockers · dialogs) or the phone's full-screen thread. */
export const MODAL_LAYER = '[aria-modal="true"]';
export const LAYER_OVER_THE_PAGE = `${MODAL_LAYER}, [data-chat-takeover]`;
/** The attributes whose change can open or close such a layer without a node being added or removed. */
export const LAYER_ATTRIBUTES: readonly string[] = ['aria-modal', 'data-chat-takeover', 'hidden'];

/** One element `LAYER_OVER_THE_PAGE` matched, as the browser draws it. */
export type DrawnLayer = {
  /** True for `[aria-modal]`; false for the chat takeover, which is a layer only where it fixes itself (a phone). */
  modal: boolean;
  position: string;
  display: string;
  visibility: string;
  width: number;
  height: number;
};

/** Is the page covered right now? A modal that is drawn covers it; the chat thread covers it only while fixed. */
export function aLayerCoversThePage(layers: readonly DrawnLayer[]): boolean {
  return layers.some(
    (l) =>
      l.display !== 'none' &&
      l.visibility !== 'hidden' &&
      l.width > 0 &&
      l.height > 0 &&
      (l.modal || l.position === 'fixed'),
  );
}
