/**
 * apps/web/lib/rsvp-stage-shared.ts
 *
 * The RSVP stage's NAMES — the bar key, the bridge's message sources and keys,
 * the window events — with NO imports, so the Maker's first load (its bar) and
 * the guest page's canvas bridge can read them without pulling the RSVP
 * config's code in with them. Everything else is `lib/rsvp-stage.ts`, which
 * re-exports these.
 */

/** The Maker bar's key for the stage (a page of the Maker, not a lifecycle phase). */
export const RSVP_STAGE_KEY = 'rsvp-stage' as const;

/** The stage's name on the bar. */
export const RSVP_STAGE_LABEL = 'RSVP';

/** Every message the Maker posts carries this; the frame ignores anything else. */
export const RSVP_BRIDGE_SOURCE = 'setnayan-editor';
/** Every message the frame posts back carries this. */
export const RSVP_SITE_SOURCE = 'setnayan-site';

/** The `words` key of one RSVP word on the canvas — `data-rsvp-word` carries it. */
export const rsvpWordBridgeKey = (key: string) => `rsvp:${key}`;

/* ── The Maker's side: one window event per change, never a save ──────────── */

/** The panel changed the RSVP config — `detail` is the WHOLE config, as drawn. */
export const RSVP_PREVIEW_EVENT = 'setnayan:rsvp-preview';
/** The reply-by date changed — `detail` is `{ line }` (`rsvpReplyByLine`). */
export const RSVP_REPLY_BY_EVENT = 'setnayan:rsvp-reply-by';

/** The Maker's draft-copy key for the config (`lib/maker-draft-store.ts`) — never a widget type. */
export const RSVP_DRAFT_TYPE = 'events.rsvp_ask_config';
/** 🎨 The `<style>` a reply page carries its lines' look in (`lib/rsvp-look.ts`, `rsvp-look-style.tsx`). */
export const RSVP_LOOK_STYLE_ATTR = 'data-rsvp-look';
/** The bridge message's `t` — `{ source, t: 'rsvpLook', look }`: the RAW `look`, read strictly by the page. */
export const RSVP_LOOK_MESSAGE = 'rsvpLook';
/** 🃏 "Open the card" (a line's Background): the RSVP panel asks the Stages toolbar to pick the line's card. */
export const RSVP_OPEN_CARD_EVENT = 'setnayan:rsvp-open-card';
