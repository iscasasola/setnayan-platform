import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * next-card.tsx — THE ONE "Next" CARD, for every phone first screen.
 *
 * Lifted VERBATIM out of the host's phone Home (`home-first-screen.tsx`, #6217,
 * owner-APPROVED 2026-10-01 "THE SIMPLE PHONE APP — APPROVED") when the supplier
 * app copied the same method (DECISION_LOG 2026-10-01 "THE SUPPLIER PHONE APP —
 * APPROVED, WITH THE THREE RECOMMENDED ANSWERS"). ONE card, ONE button: the
 * eyebrow "Your next step", a title, one line, and the button.
 *
 * 🗣 "Your next step", not "Next" (owner, live phone test 2026-10-02, asking what
 * the "Next card" was): the eyebrow says what the card IS in plain words, and
 * the button names the action. No caption explains it.
 *
 * 🔒 ONE MECHANISM. What goes IN the card is decided by each surface's pure
 * picker (`lib/home-first-screen.ts` for a host, `lib/supplier-today.ts` for a
 * supplier); how it LOOKS is decided only here. A second card component is how
 * two first screens drift apart.
 *
 * A server component — it adds nothing to any client bundle. `marker` names the
 * data attribute each surface's guard reads (`data-home-next`, `data-today-next`).
 *
 * 🧭 `later` — the ONE exception to one button: a once-offer ("Start / Later",
 * the Event Hub setup right after onboarding, owner-approved 2026-10-01) adds a
 * quiet "Later" under the button. It posts an EXISTING server action (no new
 * one), so the offer is answered without a line of client code.
 */
export function NextCard({
  marker,
  kind,
  title,
  body,
  action,
  href,
  later = null,
  actions,
  bad = false,
}: {
  marker: 'data-home-next' | 'data-today-next';
  kind: string;
  title: string;
  body: string;
  action: string;
  href: string;
  later?: { label: string; action: (formData: FormData) => Promise<void> } | null;
  /**
   * 🔘 THE BUTTON RULE'S CARD (owner 2026-10-07, the couple's Home — PR 4e,
   * `prototypes/home_and_guests_2026-10-07_fable.html`): the same eyebrow ·
   * title · line, drawn the prototype's way, with the caller's `ActionButton`
   * row in place of the one full-width link. Absent → the card exactly as it
   * was (the supplier's Today is untouched). `href`/`action`/`later` are then
   * the caller's to draw inside `actions`.
   */
  actions?: ReactNode;
  /** A read failed — the card says so in the danger wash (H3), never as success. */
  bad?: boolean;
}) {
  if (actions !== undefined) {
    return (
      <div {...{ [marker]: kind }} data-next-bad={bad ? '' : undefined} className={`home-card${bad ? ' home-card-bad' : ''}`}>
        <p className="home-eyebrow">Your next step</p>
        <h2 className="home-card-title">{title}</h2>
        <p className="home-card-body">{body}</p>
        <div className="home-acts">{actions}</div>
      </div>
    );
  }
  return (
    <div {...{ [marker]: kind }} className="sn-glass-bare rounded-2xl p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">Your next step</p>
      <h2 className="mt-1 font-display text-[24px] leading-tight text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink/65">{body}</p>
      <Link
        href={href}
        className="sn-press mt-3 flex w-full items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[15px] font-semibold text-cream transition hover:bg-ink/90"
      >
        {action}
      </Link>
      {later ? (
        <form action={later.action} className="mt-1 flex justify-center">
          <button type="submit" data-next-later="" className="sn-press min-h-11 px-4 text-[14px] font-semibold text-ink/65 underline underline-offset-2">
            {later.label}
          </button>
        </form>
      ) : null}
    </div>
  );
}
