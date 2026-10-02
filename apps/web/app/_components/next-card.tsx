import Link from 'next/link';

/**
 * next-card.tsx — THE ONE "Next" CARD, for every phone first screen.
 *
 * Lifted VERBATIM out of the host's phone Home (`home-first-screen.tsx`, #6217,
 * owner-APPROVED 2026-10-01 "THE SIMPLE PHONE APP — APPROVED") when the supplier
 * app copied the same method (DECISION_LOG 2026-10-01 "THE SUPPLIER PHONE APP —
 * APPROVED, WITH THE THREE RECOMMENDED ANSWERS"). ONE card, ONE button: the
 * eyebrow "Next", a title, one line, and the button.
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
}: {
  marker: 'data-home-next' | 'data-today-next';
  kind: string;
  title: string;
  body: string;
  action: string;
  href: string;
  later?: { label: string; action: (formData: FormData) => Promise<void> } | null;
}) {
  return (
    <div {...{ [marker]: kind }} className="sn-glass-bare rounded-2xl p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">Next</p>
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
