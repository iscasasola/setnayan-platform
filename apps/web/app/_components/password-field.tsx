'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Circle, Eye, EyeOff, X } from 'lucide-react';
import { assessNewPassword, type RuleState, type StrengthLevel } from '@/lib/password-strength';

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
 * `mode="new"` — EVERY box where a person CREATES a password (owner 2026-11-06:
 * *"password strength test for all password creation text boxes … only if they
 * create their own password"*). Under the box: a weak / okay / strong bar and
 * three live rules — 8+ characters · not your name or email · not a known leaked
 * password. No forced symbols or capitals (lib/password-strength.ts says why).
 *   · The name/email rule reads the SAME form's name and email boxes as they
 *     are typed (`PERSONAL_FIELDS`), plus `personal` for a page that already
 *     knows who is signed in (reset, join, profile).
 *   · The leak rule is answered by the server on Continue, through
 *     lib/leaked-password.ts — the page passes `leaked` when that check refused.
 *     The field never sends the password anywhere itself.
 * Never on sign-in, and never on a "type it once more" confirm box.
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
  /** `"new"` = a box where the person creates a password: shows the strength bar + rules. */
  mode?: 'new';
  /** Name / email the page already knows (signed-in doors) — the password must not contain them. */
  personal?: ReadonlyArray<string | null | undefined>;
  /** The server's breach check refused the password this box holds. */
  leaked?: boolean;
  /**
   * 🤫 `mode="new" quiet` — a create-password box that shows NO bar and NO checklist: once the box is not empty, ONE
   * rule line ("At least 8 characters") that ticks as they type, plus a warning only if it holds their name/email
   * (`QuietRule`); the leak check speaks only if it fails, on submit, under the box. The supplier sign-up's account
   * step (owner, prototype open-shop v16 → v19, 6–7 Nov). The box is still a NEW-password box
   * (`autoComplete="new-password"`, the same server rules) — only the meter is not drawn.
   */
  quiet?: boolean;
};

/** The form boxes whose words a new password must not contain. */
const PERSONAL_FIELDS = ['email', 'contact_email', 'full_name', 'first_name', 'last_name', 'display_name', 'contact_name'] as const;

function readPersonal(form: HTMLFormElement | null | undefined): string[] {
  if (!form) return [];
  const out: string[] = [];
  for (const name of PERSONAL_FIELDS) {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement && el.value) out.push(el.value);
  }
  return out;
}

export function PasswordField({
  revealed: revealedProp,
  onRevealedChange,
  wrapperClassName,
  wrapperProps,
  className,
  id: idProp,
  ref: refProp,
  mode,
  personal,
  leaked,
  quiet = false,
  ...input
}: PasswordFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const meterId = `${id}-strength`;
  const isNew = mode === 'new' && !quiet;
  // Both create-password shapes follow what is typed: the full meter, and the quiet one-line rule (v19).
  const tracks = mode === 'new';
  const quietId = `${id}-rule`;
  // What the box holds (mode="new" only) and the name/email words around it.
  const [typed, setTyped] = useState('');
  const [formPersonal, setFormPersonal] = useState<string[]>([]);
  // The value the server refused as leaked: the rule stays red while the box
  // still holds it, and goes back to "checked when you continue" once it changes.
  const [leakedValue, setLeakedValue] = useState<string | null>(null);
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

  // mode="new": follow the box (also an autofilled or controlled value) and the
  // form's name/email boxes, which may be typed after the password.
  useEffect(() => {
    if (!tracks) return;
    const el = inputRef.current;
    if (!el) return;
    setTyped(el.value);
    const form = el.form;
    const sync = () => setFormPersonal(readPersonal(form));
    sync();
    form?.addEventListener('input', sync);
    return () => form?.removeEventListener('input', sync);
  }, [tracks, input.value]);

  // STICKY ON PURPOSE: remembered until the box changes, never cleared when the
  // prop drops. The app-wide <ToastFromParams> strips `?error=` right after the
  // page loads, which re-renders the door with `leaked` false — clearing here
  // would wipe the refusal the moment it was shown.
  useEffect(() => {
    if (!isNew || !leaked) return;
    setLeakedValue(inputRef.current?.value ?? '');
  }, [isNew, leaked]);

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

  const box = (
    <>
      <input
        // field-ok: the one password template; every password box routes through it (each door wraps it in its own label) — lib/one-password-field.test.ts
        {...input}
        {...(tracks
          ? {
              'aria-describedby': [input['aria-describedby'], isNew ? meterId : typed ? quietId : ''].filter(Boolean).join(' ') || undefined,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                setTyped(e.target.value);
                input.onChange?.(e);
              },
            }
          : {})}
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
    </>
  );

  return (
    <span
      {...restWrapper}
      ref={wrapRef}
      className={[tracks ? 'block' : 'relative block', wrapperClassName, wrapperPropsClass].filter(Boolean).join(' ')}
    >
      {tracks && quiet ? (
        <>
          <span className="relative block">{box}</span>
          {typed ? <QuietRule id={quietId} password={typed} personal={[...formPersonal, ...(personal ?? [])]} /> : null}
        </>
      ) : isNew ? (
        <>
          <span className="relative block">{box}</span>
          <NewPasswordMeter
            id={meterId}
            password={typed}
            personal={[...formPersonal, ...(personal ?? [])]}
            leaked={leakedValue !== null && typed === leakedValue}
          />
        </>
      ) : (
        box
      )}
    </span>
  );
}

const LEVEL_WORD: Record<StrengthLevel, string> = { empty: 'Strength', weak: 'Weak', okay: 'Okay', strong: 'Strong' };
const LEVEL_FILL: Record<StrengthLevel, number> = { empty: 0, weak: 1, okay: 2, strong: 3 };
/** Theme tokens (globals.css) — each has a light and a dark value. */
const LEVEL_INK: Record<StrengthLevel, string> = {
  empty: 'transparent',
  weak: 'rgb(var(--color-danger))',
  okay: 'rgb(var(--color-warn))',
  strong: 'rgb(var(--color-ok))',
};
const RULE_INK: Record<RuleState, string> = {
  pending: 'currentColor',
  ok: 'rgb(var(--color-ok))',
  fail: 'rgb(var(--color-danger))',
};

/**
 * The bar + the three rules. Spans only (it can sit inside a <label>), in the
 * box's own ink (`--pw-eye-ink`), so it reads on every door's paint.
 */
function NewPasswordMeter({
  id,
  password,
  personal,
  leaked,
}: {
  id: string;
  password: string;
  personal: ReadonlyArray<string | null | undefined>;
  leaked: boolean;
}) {
  const { level, rules } = assessNewPassword(password, { personal, leaked });
  const fill = LEVEL_FILL[level];
  return (
    <span
      id={id}
      data-password-meter=""
      data-level={level}
      className="mt-2 block text-left text-xs leading-snug"
      style={{ color: 'var(--pw-eye-ink, currentColor)', fontFamily: 'inherit', fontStyle: 'normal' }}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="flex flex-1 gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              data-filled={i < fill ? 'true' : 'false'}
              className="block h-1.5 flex-1 rounded-full transition-colors"
              style={{
                background:
                  i < fill ? LEVEL_INK[level] : 'color-mix(in srgb, var(--pw-eye-ink, currentColor) 18%, transparent)',
              }}
            />
          ))}
        </span>
        <span aria-live="polite" className={`min-w-[4.5rem] text-right font-semibold ${level === 'empty' ? 'opacity-60' : ''}`}>
          {level === 'empty' ? LEVEL_WORD.empty : `${LEVEL_WORD[level]} password`}
        </span>
      </span>
      <span role="list" className="mt-1.5 block space-y-1">
        <Rule state={rules.length}>8 or more characters</Rule>
        <Rule state={rules.personal}>Not your name or email</Rule>
        <Rule state={rules.leaked}>
          {rules.leaked === 'fail' ? (
            'Found in a known data leak — choose another'
          ) : (
            <>
              Not a known leaked password <span className="opacity-70">· checked when you continue</span>
            </>
          )}
        </Rule>
      </span>
    </span>
  );
}

function Rule({ state, children }: { state: RuleState; children: React.ReactNode }) {
  const Mark = state === 'ok' ? Check : state === 'fail' ? X : Circle;
  const said = state === 'ok' ? 'Done: ' : state === 'fail' ? 'Not met: ' : '';
  return (
    <span role="listitem" data-rule={state} className="flex items-start gap-1.5">
      <Mark
        aria-hidden
        className={`mt-px h-3.5 w-3.5 shrink-0 ${state === 'pending' ? 'opacity-50' : ''}`}
        strokeWidth={state === 'pending' ? 2 : 2.5}
        style={{ color: RULE_INK[state] }}
      />
      <span className={state === 'pending' ? 'opacity-80' : ''} style={state === 'fail' ? { color: RULE_INK.fail } : undefined}>
        <span className="sr-only">{said}</span>
        {children}
      </span>
    </span>
  );
}

/**
 * 🤫 THE QUIET RULE (`mode="new" quiet` — the supplier sign-up, prototype v19 `zPw`; owner 7 Nov). Drawn only once the
 * box holds something: ONE line, "At least 8 characters", that ticks green as they type. The leak check is the
 * server's, on submit, and the door draws its refusal under the box — it never speaks here. "Not your name or email"
 * is a WARNING line that appears only when it fails; it never blocks (the server does not refuse it either).
 */
function QuietRule({
  id,
  password,
  personal,
}: {
  id: string;
  password: string;
  personal: ReadonlyArray<string | null | undefined>;
}) {
  const { rules } = assessNewPassword(password, { personal });
  const long = rules.length === 'ok';
  return (
    <span
      id={id}
      data-password-quiet-rule=""
      className="mt-1.5 block space-y-1 text-left text-xs leading-snug"
      style={{ color: 'var(--m-slate-3, currentColor)', fontFamily: 'inherit', fontStyle: 'normal' }}
    >
      <span data-rule={long ? 'ok' : 'pending'} className="flex items-center gap-1.5" aria-live="polite">
        {long ? (
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} style={{ color: RULE_INK.ok }} />
        ) : (
          <Circle aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-50" strokeWidth={2} />
        )}
        <span style={long ? { color: RULE_INK.ok } : undefined}>
          <span className="sr-only">{long ? 'Done: ' : ''}</span>
          At least 8 characters
        </span>
      </span>
      {rules.personal === 'fail' ? (
        <span data-rule="warn" className="flex items-center gap-1.5" style={{ color: 'rgb(var(--color-warn))' }}>
          <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>Better not to use your name or email in it</span>
        </span>
      ) : null}
    </span>
  );
}
