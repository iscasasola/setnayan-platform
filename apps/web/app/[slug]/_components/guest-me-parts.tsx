import Link from 'next/link';
import type { EventRow } from '../_lib/types';
import type { EventWords } from '../_lib/event-words';
import type { GuestRole } from '@/lib/guests';
import type { MarchPlace } from '@/lib/march-place';
import type { PaletteLookId } from '@/lib/palette-looks';
import type { RoleNames } from '@/lib/role-names';
import type { GuestMePart, ReplyCard } from '@/lib/guest-me-parts';
import { DressCodeWidget } from './dress-code-widget';

/**
 * 👤 INVITATION › ME — THE FOUR FOR-EACH-GUEST PARTS, each its own part (owner
 * 2026-10-06: *"they will have their own elements per custom part for each
 * guest"* · *"not one whole"*): Your role · What to wear · Arrive by · Coming
 * with you.
 *
 * WHICH ONES IS DECIDED ELSEWHERE — `guestMePartsShown` (`lib/guest-me-parts.ts`):
 * List only · Guests reply, a guest on the list, and only the facts their row
 * carries. This draws `parts` in the order given and settles nothing.
 *
 * 🔁 NOT A SECOND RENDERER. Your role, What to wear and Arrive by are the dress
 * code's own "you" panel (`DressCodeWidget`), one fact per part — the same
 * resolver, the same colours, the same figure as the Welcome and Details.
 * Coming with you is the companions the page already read for "Your guests".
 *
 * Words on the page, no card or box (house rule).
 */
export function GuestMeParts({
  parts,
  words,
  look,
  comingWith,
}: {
  parts: readonly GuestMePart[];
  words: EventWords;
  look: {
    config: EventRow['dress_code_config'];
    ceremonyType: string | null;
    genderSeparation: string | null;
    guestRole: GuestRole | null;
    march: MarchPlace | null;
    rolePalette: unknown;
    roleNames?: RoleNames | null;
    paletteLook?: PaletteLookId | null;
  };
  comingWith: readonly string[];
}) {
  if (parts.length === 0) return null;
  return (
    <div data-me-parts="" className="space-y-10">
      {parts.map((p) =>
        p === 'guests' ? (
          <section key={p} className="space-y-2" data-me-part="guests">
            <p className="pahina-eyebrow">
              <span>Coming with you</span>
            </p>
            <ul className="space-y-1">
              {comingWith.map((name, i) => (
                <li key={`${name}-${i}`} className="font-pahina text-xl font-light leading-snug text-ink">
                  {name}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <DressCodeWidget
            key={p}
            part={p}
            words={words}
            config={look.config}
            ceremonyType={look.ceremonyType}
            genderSeparation={look.genderSeparation}
            guestRole={look.guestRole}
            march={p === 'role' ? look.march : null}
            rolePalette={look.rolePalette}
            roleNames={look.roleNames ?? null}
            paletteLook={look.paletteLook ?? null}
            hideWhenEmpty
          />
        ),
      )}
    </div>
  );
}

/**
 * ✉ THE REPLY CARD (owner 2026-10-06) — under the names on Welcome and at the
 * top of Me: the line, the host's own reply-by date, and ONE control into the
 * shipped reply sheet. Never the Yes / No buttons; no box around it.
 */
export function ReplyCardRow({ card, landed = false }: { card: ReplyCard; landed?: boolean }) {
  return (
    <div
      data-reply-card={card.kind}
      data-arrival-action={card.kind}
      data-motion="arrive-action"
      data-pahina-first-screen=""
      className="flex flex-col items-center gap-2 pt-2 text-center"
    >
      <p className="font-pahina text-xl font-light leading-snug text-ink" data-motion={landed ? 'label-land' : undefined}>
        {card.line}
      </p>
      {card.replyBy ? <p className="text-sm text-ink/60">{card.replyBy}</p> : null}
      <Link
        href={card.href}
        className="mt-1 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-mulberry px-7 text-sm font-semibold tracking-wide text-cream transition-colors hover:bg-mulberry-600"
      >
        {card.cta}
      </Link>
    </div>
  );
}
