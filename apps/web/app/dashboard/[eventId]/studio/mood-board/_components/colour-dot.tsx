'use client';

/**
 * 🎨 THE STUDIO'S ONE COLOUR CIRCLE — every colour Studio › Mood Board & Dress Code draws (owner 2026-10-19, on the
 * Attire rows and the Palette side by side, verbatim: *"i like the circles on the attire. but they look different on the
 * palette. palette has a dropdown but attire does not. all colors can be edited on palette. no need for code. just name
 * if it has name. and just the circle like attire"*).
 *
 *   · `RoleColourDot` — the circle itself: 44 px to the finger, the colour on a 28 px circle inside, a hairline ring.
 *     Moved here unchanged from `mood-board-studio.tsx`, where Attire drew it inline (its call sites' props are the same).
 *   · `NamedColourDot` — the circle with its word under it, in the Attire dots' own type (`DOT_WORD`): Palette's five,
 *     the room's parts and the flowers. The word is the colour's NAME when it has one, never its code; no arrow.
 *
 * `colour-circles-are-one.test.ts` holds that the Studio draws no other colour circle and no colour code.
 */

/** The word under a circle — the Attire dots' own type. */
export const DOT_WORD = '-mt-1 max-w-[64px] text-center text-[10.5px] leading-tight text-ink/65';

/** The circle, without the button (the one drawing of it). */
function Circle({ colour, tight }: { colour: string; tight: boolean }) {
  return <i aria-hidden className={`${tight ? 'h-[26px] w-[26px]' : 'h-7 w-7'} rounded-full border border-ink/10`} style={{ background: colour }} />;
}

/**
 * 🎨 THE ROLE'S COLOUR CIRCLE — the one hand-made button for a colour a role wears (a zone's dot, a guest's option, a
 * pick's colour): tap it to change the colour. 44 px to the finger, the colour on the circle inside.
 */
export function RoleColourDot({ label, colour, index, onPick, tight = false }: { label: string; colour: string; index: number; onPick: () => void; tight?: boolean }) {
  return (
    <button type="button" aria-label={label} data-mood-board-role-colour={index} onClick={onPick} className={`sn-press inline-flex h-11 w-11 items-center justify-center rounded-full ${tight ? '-my-1' : ''}`}>
      <Circle colour={colour} tight={tight} />
    </button>
  );
}

/**
 * A Palette colour: the same circle, its NAME under it (only when it has one — never the code). `onPick` absent = shown,
 * not changeable (a part a supplier has agreed): the same circle, not a button, and its line says why.
 */
export function NamedColourDot({ label, colour, name, onPick, data }: { label: string; colour: string; name: string | null; onPick?: () => void; data: string }) {
  return (
    <span className="flex flex-col items-center" data-mood-board-colour={data}>
      {onPick ? (
        <RoleColourDot label={label} colour={colour} index={0} onPick={onPick} />
      ) : (
        <span role="img" aria-label={label} className="inline-flex h-11 w-11 items-center justify-center" data-mood-board-colour-shown="">
          <Circle colour={colour} tight={false} />
        </span>
      )}
      {name ? (
        <small className={DOT_WORD} data-mood-board-dot-word={name}>
          {name}
        </small>
      ) : null}
    </span>
  );
}
