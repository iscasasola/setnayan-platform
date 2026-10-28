'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * PasswordField — the ONE password box (owner 2026-10-29: "allow them to see the
 * password they typed in with an eye icon").
 *
 * A drop-in for `<input type="password" …>`: every input prop passes straight
 * through (id, name, autoComplete, minLength, required, value/onChange, style,
 * className), so each door keeps its own look and its own password-manager hint
 * (`current-password` / `new-password` / `off`). The only thing added is an eye
 * button INSIDE the box on the right:
 *   · `Eye` while masked  → "Show password"
 *   · `EyeOff` while shown → "Hide password"
 *   · 44 px tap target, `aria-pressed`, `aria-controls` → the box.
 *
 * What it promises (held by lib/one-password-field.test.ts):
 *   1. NEVER changes the value — only the box's `type` flips.
 *   2. KEEPS FOCUS AND THE CARET. The button never takes focus from the box on
 *      a mouse/touch press, and the selection is put back after the flip
 *      (WebKit moves the caret to the end when `type` changes).
 *   3. MASKS AGAIN after a submit (so the browser's save-password prompt sees a
 *      password box, and a re-rendered failed form does not sit there showing
 *      it), and after the page comes back from the back/forward cache.
 *   4. iOS: no zoom on focus — the 16 px floor for coarse pointers is global
 *      (globals.css, `@media (pointer: coarse)`), not repeated here.
 *
 * `revealed` / `onRevealedChange` let a caller drive it (the admin Secrets board
 * shows a value it just generated); omitted, the field holds its own state.
 * `wrapperProps` reaches the wrapper — e.g. `data-password-only` for the
 * typed-Google-address door, which must fold the eye away with the box.
 */
type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export type PasswordFieldProps = InputProps & {
  revealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  wrapperClassName?: string;
  wrapperProps?: React.HTMLAttributes<HTMLSpanElement> & Record<`data-${string}`, string | undefined>;
  ref?: React.Ref<HTMLInputElement>;
};

export function PasswordField({
  revealed: revealedProp,
  onRevealedChange,
  wrapperClassName,
  wrapperProps,
  className,
  id: idProp,
  ref: refProp,
  ...input
}: PasswordFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const [ownRevealed, setOwnRevealed] = useState(false);
  const revealed = revealedProp ?? ownRevealed;
  const caret = useRef<{ start: number; end: number; dir: 'forward' | 'backward' | 'none' } | null>(null);

  const setRevealed = useCallback(
    (next: boolean) => {
      if (revealedProp === undefined) setOwnRevealed(next);
      onRevealedChange?.(next);
    },
    [revealedProp, onRevealedChange],
  );

  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof refProp === 'function') refProp(el);
      else if (refProp && typeof refProp === 'object') (refProp as React.MutableRefObject<HTMLInputElement | null>).current = el;
    },
    [refProp],
  );

  // Put the caret back where it was after the type flip.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const at = caret.current;
    caret.current = null;
    if (!el || !at) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    try {
      el.setSelectionRange(at.start, at.end, at.dir);
    } catch {
      /* a type that has no selection API — nothing to restore */
    }
  }, [revealed]);

  // Mask again on submit and on a back/forward-cache restore.
  useEffect(() => {
    const el = inputRef.current;
    const form = el?.form;
    const mask = () => {
      if (inputRef.current) inputRef.current.type = 'password';
      setRevealed(false);
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) mask();
    };
    form?.addEventListener('submit', mask, true);
    window.addEventListener('pageshow', onShow);
    return () => {
      form?.removeEventListener('submit', mask, true);
      window.removeEventListener('pageshow', onShow);
    };
  }, [setRevealed]);

  // The eye wears the box's own ink, whatever theme or door paints it (white
  // admin boxes, the dark sign-in card, the onboarding paper) — read from the
  // box, re-read when the theme flips.
  useEffect(() => {
    const el = inputRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const sync = () => wrap.style.setProperty('--pw-eye-ink', getComputedStyle(el).color);
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', sync);
    };
  }, []);

  const toggle = () => {
    const el = inputRef.current;
    if (el && document.activeElement === el && el.selectionStart !== null && el.selectionEnd !== null) {
      caret.current = {
        start: el.selectionStart,
        end: el.selectionEnd,
        dir: (el.selectionDirection as 'forward' | 'backward' | 'none' | null) ?? 'none',
      };
    }
    setRevealed(!revealed);
  };

  const label = revealed ? 'Hide password' : 'Show password';
  const Icon = revealed ? EyeOff : Eye;
  const { className: wrapperPropsClass, ...restWrapper } = wrapperProps ?? {};

  return (
    <span
      {...restWrapper}
      ref={wrapRef}
      className={['relative block', wrapperClassName, wrapperPropsClass].filter(Boolean).join(' ')}
    >
      <input
        {...input}
        id={id}
        ref={setRef}
        type={revealed ? 'text' : 'password'}
        className={[className, '!pr-11'].filter(Boolean).join(' ')}
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={revealed}
        aria-controls={id}
        disabled={input.disabled}
        data-password-eye=""
        // A press never steals focus from the box — the keyboard stays up on a
        // phone and the caret stays put. Keyboard users still Tab to it.
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--pw-eye-ink,currentColor)] opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta disabled:pointer-events-none disabled:opacity-30"
      >
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </span>
  );
}
