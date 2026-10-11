/**
 * 🖼 AN RSVP PICTURE LINE'S FILE — the ref rule on its own, with NO imports, so the draft door
 * (`hub-draft-actions.ts`, which the Maker's first load reaches) can ask it without carrying the RSVP look's reader
 * and the colour picker it brings (`lib/every-studio-colour-opens-the-one-picker.test.ts` § H). `rsvp-look.ts` (the
 * one strict reader) reads a picture's ref through `rsvpPictureRef` here.
 *
 * A picture's file: an `r2://` ref into the PUBLIC media bucket, inside an event's own `scene-background` folder (the
 * shipped scene upload's — `sceneBackgroundPathPrefix`), a key `/api/upload` could have minted (`<uuid>-<sanitized
 * name>`, `[A-Za-z0-9._-]`), at most `RSVP_ADDED_PICTURE_MAX` characters. Anything else is not a picture (null).
 * WHICH event's folder is asked where the event is known: the draft door holds a ref outside this event's own.
 */

/**
 * A picture's reference is never longer than this: `r2://setnayan-media/events/<uuid>/scene-background/` (81) +
 * `/api/upload`'s `<uuid>-` (37) + its longest sanitized file name (120, `MAX_FILENAME_LEN`) = 238. (It was 200 while
 * the picture was only measured for, which would have dropped a picture whose file had a long name.)
 */
export const RSVP_ADDED_PICTURE_MAX = 240;

const RSVP_PICTURE_REF = /^r2:\/\/setnayan-media\/events\/[0-9a-fA-F-]{36}\/scene-background\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
export function rsvpPictureRef(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= RSVP_ADDED_PICTURE_MAX && RSVP_PICTURE_REF.test(raw) && !raw.includes('..') ? raw : null;
}

/**
 * Every picture ref a RAW `rsvp_ask_config` holds in its added lines (`look.added.<screen>[].p` of kind `p`) that is a
 * picture at all, deduped — what the draft door holds to the event's own folder. (A value the reader would not keep
 * is never drawn or signed, so it needs no hold.)
 */
export function rsvpPictureRefsIn(config: unknown): string[] {
  const out = new Set<string>();
  const look = config && typeof config === 'object' ? (config as { look?: unknown }).look : null;
  const added = look && typeof look === 'object' ? (look as { added?: unknown }).added : null;
  if (!added || typeof added !== 'object') return [];
  for (const lines of Object.values(added as Record<string, unknown>)) {
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      if (!line || typeof line !== 'object' || (line as { k?: unknown }).k !== 'p') continue;
      const ref = rsvpPictureRef((line as { p?: unknown }).p);
      if (ref) out.add(ref);
    }
  }
  return [...out];
}
