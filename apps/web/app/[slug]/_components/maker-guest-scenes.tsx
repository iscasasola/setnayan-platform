import type { ReactNode } from 'react';
import { formatEventDate } from '@/lib/events';

/**
 * 👤 THE GUEST-LINK SCENES, AS THE MAKER DRAWS THEM — never as a guest sees them.
 *
 * Owner, 2026-09-27: the Personal greeting, the Guest's QR pass and the RSVP
 * sat under "Not shown on Invitation" ("Only on each guest's own link"), so the
 * couple could not see where each guest's own part lands on their page. In the
 * Maker's canvas only, they are drawn IN PLACE — right after the names, where a
 * guest meets them — as "Your guest": never sample content, never a real
 * person's details (owner: "no sample content").
 *
 * Each sits right after its own `data-maker-section` marker (`f:greeting`,
 * `f:pass`, `f:rsvp`, passed in as `mark`), so a tap selects it and opens its
 * panel: the greeting and the pass say they come from the guest list, the RSVP
 * offers "Open RSVP editor". A guest never receives this markup.
 *
 * No card: words on the page (house rule, DESIGN_BRIEF §3).
 */
const EACH = 'Each guest sees their own';

export function MakerGuestScenes({
  show,
  eventDate,
  solemn,
  mark,
}: {
  show: { greeting: boolean; pass: boolean; rsvp: boolean };
  eventDate: string | null;
  solemn: boolean;
  mark: (key: string) => ReactNode;
}) {
  if (!show.greeting && !show.pass && !show.rsvp) return null;
  const date = formatEventDate(eventDate);
  return (
    <div className="mt-10 space-y-8" data-maker-guest-scenes="">
      {show.greeting ? (
        <>
          {mark('f:greeting')}
          <section className="space-y-2" data-maker-guest-scene="greeting">
            {/* 🎩 No "Hi, …" — no casual greetings (owner 2026-09-30). */}
            <p className="max-w-prose text-base leading-relaxed text-ink/70">
              {solemn ? 'We hope you can be with us' : 'We’d love to celebrate with you'}
              {date ? ` on ${date}` : ''}.
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40">{EACH}</p>
          </section>
        </>
      ) : null}
      {show.pass ? (
        <>
          {mark('f:pass')}
          <section className="flex flex-col items-center gap-2 text-center" data-maker-guest-scene="pass">
            <span
              aria-hidden
              className="flex h-28 w-28 items-center justify-center font-mono text-xs tracking-[0.2em] text-ink/40 [border:2px_dashed_rgb(var(--color-ink)/0.2)] [border-radius:var(--m-r-md)]"
            >
              QR
            </span>
            <p className="font-pahina text-xl text-ink">Your guest</p>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40">{EACH} pass</p>
          </section>
        </>
      ) : null}
      {show.rsvp ? (
        <>
          {mark('f:rsvp')}
          <section className="space-y-1 text-center" data-maker-guest-scene="rsvp">
            <p className="font-pahina text-xl text-ink">{solemn ? 'Will you be with us?' : 'Will you be there?'}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40">{EACH} reply, from their own link</p>
          </section>
        </>
      ) : null}
    </div>
  );
}

/**
 * 🏠 THE WELCOME PAGE'S TWO GUEST-ONLY PLACES, AS THE MAKER DRAWS THEM (owner
 * 2026-09-30 — `lib/invitation-welcome.ts`). Each guest's own look can only be
 * drawn for a guest, and the E-Gifts door only once a gift method is on; here
 * the couple sees where each lands, after its own marker (`f:look`, `f:gifts`),
 * so a tap selects it. Never sample content; a guest never receives this markup.
 */
export function MakerWelcomeLook({ look = null }: { look?: string | null } = {}) {
  return (
    <section className="space-y-2" data-maker-guest-scene="look" {...(look ? { 'data-part-look': look } : {})}>
      <p className="pahina-eyebrow">
        <span>What to wear</span>
      </p>
      <p className="font-pahina text-xl text-ink">Your guest&rsquo;s role, colors and outfit</p>
      <p className="text-xs uppercase tracking-[0.2em] text-ink/40">{EACH} look, from your Mood Board</p>
    </section>
  );
}

/** The E-Gifts place with no gift method on yet — the page draws the real door once there is one. */
export function MakerWelcomeGiftsEmpty({ look = null }: { look?: string | null } = {}) {
  return (
    <section className="space-y-2" data-maker-guest-scene="gifts" {...(look ? { 'data-part-look': look } : {})}>
      <p className="pahina-eyebrow">
        <span>E-Gifts</span>
      </p>
      <p className="font-pahina text-xl font-light italic text-ink/60">Add a way to receive gifts.</p>
      <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Only you see this · guests see it once a gift method is on</p>
    </section>
  );
}
