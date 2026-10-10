import { readRsvpLook, rsvpLookCss } from '@/lib/rsvp-look';
import { RSVP_LOOK_STYLE_ATTR } from '@/lib/rsvp-stage-shared';

/**
 * 🎨 THE LOOK OF A REPLY PAGE'S LINES, AS ONE `<style>` (`lib/rsvp-look.ts`) — the colour and size the couple picked
 * for a line on the Maker's RSVP stage. One rule per styled line, addressed by the line's own name (`data-rsvp-line`),
 * so nothing is threaded through the card, the one-at-a-time flow or the pass.
 *
 * A GUEST of an event with no look gets NOTHING — not an empty tag: the page is byte-identical to before. On the
 * Maker's canvas (`canvas`) the tag is always there, with the event's colours on it, so a look picked in the panel is
 * drawn at the tap (`rsvp-canvas-bridge.tsx` rewrites it from the same strict reader — never from text it was sent).
 *
 * `config`: the RAW `events.rsvp_ask_config` the page already read (no new read). `board`: the event's five colours.
 * `parts`: the Maker parts this page draws.
 */
export function RsvpLookStyle({ config, board, parts, canvas = false }: { config: unknown; board: readonly string[]; parts: readonly string[]; canvas?: boolean }) {
  const css = rsvpLookCss(readRsvpLook(config), parts, board);
  if (!css && !canvas) return null;
  return (
    <style {...{ [RSVP_LOOK_STYLE_ATTR]: parts.join(' ') }} data-rsvp-board={canvas ? board.join(' ') : undefined}>
      {css}
    </style>
  );
}
