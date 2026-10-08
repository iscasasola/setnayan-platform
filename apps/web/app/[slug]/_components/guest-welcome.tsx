import type { ReactNode } from 'react';
import type { EventWords } from '../_lib/event-words';
import type { EventRow } from '../_lib/types';
import type { GuestRole } from '@/lib/guests';
import type { MarchPlace } from '@/lib/march-place';
import type { WelcomePart } from '@/lib/invitation-welcome';
import type { PaletteLookId } from '@/lib/palette-looks';
import { DressCodeWidget } from './dress-code-widget';
import { WelcomeGifts } from './guest-doorway-strip';
import { MakerWelcomeGiftsEmpty, MakerWelcomeLook } from './maker-guest-scenes';

/**
 * 🏠 THE INVITATION'S WELCOME PAGE — the guest's own (owner 2026-09-30:
 * *"Home is their personalization. customized mood board. reminders. also
 * E-Gifts should already show."*; the page is called **Welcome** — *"on
 * Invitation, the menu is Welcome - Details - Our Love Story - Me"*).
 *
 * WHAT IS DRAWN, AND IN WHAT ORDER, IS DECIDED ELSEWHERE — `welcomeParts`
 * (`lib/invitation-welcome.ts`), the one rule the guest tree, the stranger's
 * tree and the Maker's navigator all read. This component draws `parts` in the
 * order given and settles nothing: a part that is not listed is not drawn, and
 * nothing here prints an empty block for a guest.
 *
 * 🧩 SELF-CONTAINED ON PURPOSE (controller, 2026-09-30: each guest tab becomes
 * its own page later, reusing the hub shell). Everything it needs arrives as
 * props — no anchor, no neighbour, no read of the page around it — so it can
 * drop into a hub panel unchanged.
 *
 *   · `look`      — the reader's own dress code (their role, colours, figure,
 *                   Do's & Don'ts), `DressCodeWidget part="you"`. Null in the
 *                   Maker's canvas, which has no guest: the place is drawn there.
 *   · `reminders` — the couple's Reminders scene, drawn by the caller in the
 *                   couple's own scene look (background, font — the scene
 *                   frame belongs to the dispatcher that owns it).
 *   · `giftHref`  — the E-Gifts door (`resolveGuestDoorways(...).pabuya`).
 *
 * `mark` is the Maker canvas's navigator handle (`site-body.tsx` `makerMark`):
 * it stands immediately before each part so a tap selects it. Guests get null.
 *
 * `empty:hidden` — a guest whose role has nothing personal to say gets a look
 * that renders nothing; with nothing else listed the wrapper would still hold
 * its place in the page's rhythm, so an empty wrapper is not displayed.
 */
export type WelcomeLook = {
  config: EventRow['dress_code_config'];
  ceremonyType: string | null;
  genderSeparation: string | null;
  guestRole: GuestRole | null;
  march: MarchPlace | null;
  rolePalette: unknown;
  /** 🎨 The Dress code scene's palette look (`paletteLookOfRow`) — the reader's own colours follow it here too. Absent = Tags. */
  paletteLook?: PaletteLookId | null;
};

export function GuestWelcome({
  parts,
  words,
  look,
  reminders,
  march = null,
  venue = null,
  giftHref,
  mark = () => null,
  maker = false,
  partLooks = null,
}: {
  /** 🎨 E-Gifts' and the guest's look's own styles (`lib/scene-styles-parts.ts`) — null: the shipped look. */
  partLooks?: { gifts?: string | null; wear?: string | null } | null;
  parts: readonly WelcomePart[];
  words: EventWords;
  look: WelcomeLook | null;
  reminders: ReactNode;
  /** 🚶 The day's walking order — the shipped entourage section, drawn by the caller. */
  march?: ReactNode;
  /** 🗺 The day's ONE venue with directions (`lib/day-venue-now.ts`), drawn by the caller. */
  venue?: ReactNode;
  giftHref: string | null;
  mark?: (key: string) => ReactNode;
  maker?: boolean;
}) {
  if (parts.length === 0) return null;
  return (
    <div data-welcome-page="" className="space-y-10 empty:hidden">
      {parts.map((part) => {
        if (part === 'look') {
          if (look) {
            return (
              <PartLook key="look" look={partLooks?.wear ?? null}>
              <DressCodeWidget
                key="look"
                part="you"
                words={words}
                config={look.config}
                ceremonyType={look.ceremonyType}
                genderSeparation={look.genderSeparation}
                guestRole={look.guestRole}
                march={look.march}
                rolePalette={look.rolePalette}
                paletteLook={look.paletteLook ?? null}
                hideWhenEmpty
              />
              </PartLook>
            );
          }
          return maker ? (
            <WelcomeSlot key="look">
              {mark('f:look')}
              <MakerWelcomeLook look={partLooks?.wear ?? null} />
            </WelcomeSlot>
          ) : null;
        }
        if (part === 'reminders') {
          return reminders ? (
            <WelcomeSlot key="reminders">
              {mark('w:what_to_bring')}
              {reminders}
            </WelcomeSlot>
          ) : null;
        }
        if (part === 'march') return march ? <WelcomeSlot key="march">{march}</WelcomeSlot> : null;
        if (part === 'venue') return venue ? <WelcomeSlot key="venue">{venue}</WelcomeSlot> : null;
        // gifts
        if (giftHref) {
          return (
            <WelcomeSlot key="gifts">
              {mark('f:gifts')}
              <WelcomeGifts href={giftHref} words={words} look={partLooks?.gifts ?? null} />
            </WelcomeSlot>
          );
        }
        return maker ? (
          <WelcomeSlot key="gifts">
            {mark('f:gifts')}
            <MakerWelcomeGiftsEmpty look={partLooks?.gifts ?? null} />
          </WelcomeSlot>
        ) : null;
      })}
    </div>
  );
}

/** One part's box — its Maker marker and the part as siblings, so the canvas finds the part right after its marker. */
function WelcomeSlot({ children }: { children: ReactNode }) {
  return <div data-welcome-part="">{children}</div>;
}

/** 🎨 A part in its own style (`data-part-look`, `globals.css`) — no wrapper at all for the shipped look. */
function PartLook({ look, children }: { look: string | null; children: ReactNode }) {
  return look ? (
    <div data-part-look={look} className="empty:hidden">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
