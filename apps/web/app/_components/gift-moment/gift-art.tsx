/**
 * 🎉 THE GIFT MOMENT'S CONFETTI — the shipped bits (owner 14 Nov: "the gold flash and confetti are the same as
 * today"). The box that used to be drawn here is now the approved realistic box (`gift-box.tsx`, 15 Nov), so only the
 * confetti stays. Colours are the app's tokens, never typed.
 */

/** Confetti, drawn once in a fixed pattern (no randomness, so a re-render never reshuffles it). */
const CONFETTI_COLOURS = ['var(--m-orange)', 'var(--m-mulberry)', 'var(--m-sage-deep)', 'var(--m-blush-deep)', 'var(--m-ivory)'];
export const CONFETTI: ReadonlyArray<{ left: string; colour: string; delay: string; drift: string; spin: string }> = Array.from(
  { length: 36 },
  (_, i) => ({
    left: `${(i * 37) % 100}%`,
    colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!,
    // a share of one "elem", so the whole fall still reads the token
    delay: `calc(var(--sn-dur-elem) * ${((i * 7) % 10) / 10})`,
    drift: `${((i * 53) % 21) - 10}vw`,
    spin: `${((i * 97) % 720) - 360}deg`,
  }),
);
