'use client';

/**
 * clear-field.tsx — THE ONE ✕ THAT EMPTIES A TYPE BOX (owner 2026-10-31, live iPhone, Guests › March: *"Why does the x
 * inside the type box not clearing the type box. We want every type box too have the clear button"*).
 *
 * Three parts, and every ✕ in the app that empties a box is drawn and wired through them:
 *
 *   · `clearTyped(input)` — empties the box AS A PERSON WOULD: the native value setter (so React's value tracker sees
 *     a change) and a bubbling `input` event, so a React `onChange` / `onInput` hears the empty words exactly as it
 *     hears a backspace. A box that saves as you type therefore saves the empty value the way typing would — through
 *     its own path, with its own Undo where it has one — and never behind its back.
 *   · `ClearButton` — the ✕ itself: a 28 px grey disc in a press target, named for a screen reader. Its press NEVER
 *     takes the focus (mousedown's default prevented — on `mousedown` only: a cancelled `pointerdown` also cancels a
 *     touch's click in WebKit, measured 2026-10-24), so a box being typed into keeps its keyboard, and a box that was
 *     not focused is not focused by it (no keyboard rises).
 *   · `isClearableField(el)` — WHICH boxes get one (the rule below), read by the app-wide ✕
 *     (`app/_components/global-clear-field.tsx`) and held by `lib/every-type-box-has-the-clear-button.test.ts`.
 *
 * WHICH BOXES. Every single-line box that takes words: `text`, `search`, `email`, `url`, `tel`, or no type. NOT:
 *   · `password` — a hidden word is retyped whole, and a ✕ next to it reads as "show";
 *   · `number`, and a text box that is a number in disguise (`inputMode="numeric" | "decimal"`: an amount, a count, a
 *     code) — a number is corrected, not emptied, and an empty amount is a different fact from ₱0;
 *   · `date`, `time`, `datetime-local`, `month`, `week` — a picker, not words; its own control clears it;
 *   · `autocomplete="one-time-code"` — a code box fills itself from the message;
 *   · a `<textarea>` — a long note is never one tap from gone;
 *   · `readOnly` or `disabled` — nobody can change it, so nobody can empty it;
 *   · a box that already draws its own ✕ (the thumb row's, the Search box's — anything with a `[data-clear-x]` or a
 *     "Clear…" button beside it) — never two;
 *   · a box under `[data-no-clear="<why>"]` — the reason is the attribute's value, and the guard refuses an empty one.
 */
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';

/** Empty the box (or put `value` in it) as a person would — the host's `onChange` / `onInput` hear it. */
export function clearTyped(input: HTMLInputElement, value = ''): void {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (set) set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** A press on the ✕ never takes the focus from where it is (the keyboard stays as it was). */
export const holdFocus = (e: { preventDefault: () => void }) => e.preventDefault();

/** The input types that take words — the only ones with a ✕. */
export const CLEARABLE_TYPES: readonly string[] = ['text', 'search', 'email', 'url', 'tel', ''];

/** The input modes that make a text box a number. */
export const NUMBER_MODES: readonly string[] = ['numeric', 'decimal'];

/** Something beside the box that already empties it — the shared ✕, or a hand-drawn "Clear…" one older than it. */
export const OWN_CLEAR_SELECTOR = '[data-clear-x], [data-thumb-clear], button[aria-label^="Clear"]';

/** The rule above, on a live element. */
export function isClearableField(el: Element | null): el is HTMLInputElement {
  if (!el || el.tagName !== 'INPUT') return false;
  const input = el as HTMLInputElement;
  const type = (input.getAttribute('type') ?? '').toLowerCase();
  if (!CLEARABLE_TYPES.includes(type)) return false;
  if (input.readOnly || input.disabled) return false;
  if (NUMBER_MODES.includes((input.getAttribute('inputmode') ?? '').toLowerCase())) return false;
  if ((input.getAttribute('autocomplete') ?? '').toLowerCase() === 'one-time-code') return false;
  if (input.closest('[data-no-clear]')) return false;
  const own = input.parentElement?.querySelectorAll(OWN_CLEAR_SELECTOR) ?? [];
  // The app-wide ✕ (`[data-global-clear]`) is drawn beside the box it clears — it is not the box's own.
  if ([...own].some((n) => !n.closest('[data-global-clear]'))) return false;
  return true;
}

export function ClearButton({
  onClear,
  label = 'Clear',
  className,
  discClassName,
  style,
  ...data
}: {
  /** Empty the box — usually `clearTyped(input)`, then anything the host must hear at once. */
  onClear: () => void;
  /** Its name for a screen reader ("Clear the search"). */
  label?: string;
  /** The press target's look (its size and where it stands are the host's). */
  className?: string;
  /** The disc's look; the house disc when not given. */
  discClassName?: string;
  style?: CSSProperties;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <button
      type="button"
      aria-label={label}
      data-clear-x=""
      {...data}
      style={style}
      className={className}
      onMouseDown={holdFocus}
      onClick={() => onClear()}
    >
      <span aria-hidden className={discClassName ?? 'grid h-7 w-7 place-items-center rounded-full bg-ink/[0.08] text-ink/70'}>
        <X className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    </button>
  );
}
