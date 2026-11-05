import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GuestGreeting, GuestGreetingAsk } from '@/lib/guest-greeting';

/**
 * 🪪 INVITATION › ME, ITS TOP AND ITS FOOT (owner 2026-10-24, approved: "Approve the corrected Me redesign. Build it." —
 * the contract is `Setnayan/prototypes/me_tab_redraw_2026-10-24_fable.html`; the words and rules are
 * `lib/guest-greeting.ts`).
 *
 *   `MeGreeting`  the top of Me: "Your invitation" · the FORMAL name as the hero · the role in small caps
 *                 (· Groom's side) · a hairline · the date · Ceremony / Reception, each on its labelled line.
 *   `MeReply`     the foot of Me (`#me-reply`, where the cover's RSVP button lands): the shipped Reply card's
 *                 question and button (`replyCardOf`) — "Will you join us?" · "Reply by …" · Reply; after a reply
 *                 "You're coming ✓" · "N seats" · an outline "Change my reply". ONE Reply on the page.
 *
 * One centred axis; no box (frames only on what you press — the button). THEME TOKENS ONLY: the display face
 * (`font-pahina`), `text-ink` / `text-gild`, and the arrival's button (`[data-arrival-action] a.bg-mulberry`, the
 * class the couple's Look › Buttons paints and shapes) — so every couple's design and the dark Look wear it.
 */
export function MeGreeting({ greeting }: { greeting: GuestGreeting }) {
  const g = greeting;
  const longName = (g.name ?? '').length > 26;
  return (
    <section data-guest-greeting="" className="text-center">
      <p data-greeting-eyebrow="" className="text-[0.72rem] uppercase tracking-[0.22em] text-gild">
        {g.eyebrow}
      </p>
      {g.name ? (
        <h2
          data-greeting-name=""
          className={`mt-2.5 font-pahina font-medium leading-[1.08] tracking-[-0.005em] text-ink ${longName ? 'text-[29px]' : 'text-[34px]'}`}
          style={{ textWrap: 'balance' }}
        >
          {g.name}
        </h2>
      ) : null}
      {g.role || g.tail ? (
        <p data-greeting-role="" className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-2 text-[0.78rem] uppercase tracking-[0.16em] text-gild">
          {g.role ? <span>{g.role}</span> : null}
          {g.tail ? <span className="tracking-[0.14em] text-ink/70">{g.role ? `· ${g.tail}` : g.tail}</span> : null}
        </p>
      ) : null}
      {/* 🧍 A proxy reads whom they stand in for; the role holder reads who stands in for them (owner 2026-10-27). */}
      {g.standIn ? (
        <p data-greeting-stand-in="" className="mx-auto mt-2.5 max-w-[22rem] text-[13.5px] leading-snug text-ink/75" style={{ textWrap: 'balance' }}>
          {g.standIn}
        </p>
      ) : null}
      {g.date || g.venues.length > 0 ? (
        <>
          <div aria-hidden className="mx-auto mb-[18px] mt-5 h-px w-9 bg-gild/70" />
          {g.date ? (
            <p data-greeting-date="" className="font-pahina text-[21px] font-medium leading-[1.2] text-ink">
              {g.date}
            </p>
          ) : null}
          {g.venues.length > 0 ? (
            <ul data-greeting-venues="" className="mt-3 flex flex-col gap-[9px]">
              {g.venues.map((v, i) => (
                <li key={`${v.label ?? ''}-${i}`} className="flex flex-col gap-px">
                  {v.label ? <span className="text-[0.66rem] uppercase tracking-[0.2em] text-ink/70">{v.label}</span> : null}
                  <span className="text-[15px] leading-[1.35] text-ink" style={{ textWrap: 'balance' }}>
                    {v.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** The id of Me's Reply — where the cover's RSVP button lands (`?tab=me#me-reply`). */
export const ME_REPLY_ID = 'me-reply';

export function MeReply({ ask, landed = false, kit = null }: { ask: GuestGreetingAsk; landed?: boolean; kit?: ReactNode }) {
  return (
    <section
      id={ME_REPLY_ID}
      data-me-reply-foot=""
      data-reply-card={ask.kind}
      data-arrival-action={ask.kind}
      className="scroll-mt-24 text-center"
    >
      {kit}
      <p data-greeting-ask="" className="font-pahina text-[26px] font-normal leading-[1.2] text-ink" data-motion={landed ? 'label-land' : undefined}>
        {ask.line}
        {ask.check ? (
          <>
            {' '}
            <span className="text-gild">✓</span>
          </>
        ) : null}
      </p>
      {ask.sub ? <p className="mt-1.5 text-sm text-ink/70">{ask.sub}</p> : null}
      {/* 📬 A shut window draws no button at all (owner 2026-10-14) — not a disabled one. */}
      {ask.cta ? (
        ask.cta.quiet ? (
          <Link
            href={ask.cta.href}
            className="mt-3.5 inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-ink/40 px-[30px] text-[15px] font-semibold tracking-[0.02em] text-ink transition-colors hover:bg-ink/5"
          >
            {ask.cta.label}
          </Link>
        ) : (
          <Link
            href={ask.cta.href}
            className="mt-3.5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-mulberry px-[30px] text-[15px] font-semibold tracking-[0.02em] text-cream transition-colors hover:bg-mulberry-600"
          >
            {ask.cta.label}
          </Link>
        )
      ) : null}
    </section>
  );
}
