/**
 * lib/event-hub-media.ts — THE EVENT HUB ALBUM'S FILES, as refs (owner 2026-10-23: *"the media files uploaded on
 * event hub [are] on the gallery as well as a separate album"*).
 *
 * No gallery table links them: the Hub points at each file by key, on the live event row and its scenes'
 * canvases (`invitation_widgets.config_json`). This finds every ref to one of THIS event's couple-media folders
 * (`COUPLE_MEDIA_METER_SUBPATHS` — the same folders the media allowance counts) in that text. Music is not a
 * picture and is left out.
 *
 * 🔒 READ-ONLY on Memories, by design: removing one would break the page that points at it — it is changed in the
 * Maker, and the album follows. Pure; the read is `event-hub-media.server.ts`.
 */
import { COUPLE_MEDIA_METER_SUBPATHS } from '@/lib/couple-media-allowance';

export type HubMediaRef = { ref: string; key: string; kind: 'photo' | 'clip' };

/** One Event Hub file on Memories — shown, viewed, saved; never hidden or deleted there. */
export type HubMedia = { id: string; url: string; kind: 'photo' | 'clip' };

const CLIP = /\.(mp4|m4v|mov|webm)$/i;
const SOUND = /\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i;
const NOT_A_PICTURE = new Set(['site-music']);

/** Every Event Hub media ref in `text` (stringified rows), each once, a picture or a clip. */
export function hubMediaRefs(text: string, eventId: string, max = 60): HubMediaRef[] {
  if (!/^[0-9a-fA-F-]{36}$/.test(eventId)) return [];
  // `r2://bucket/events/<id>/…` or a public URL ending in `/events/<id>/…` — keys are `[A-Za-z0-9._/-]`.
  const re = new RegExp(`(r2://[a-z0-9-]+/|https?://[A-Za-z0-9.-]+/(?:[A-Za-z0-9._-]+/)*?)?(events/${eventId}/[A-Za-z0-9._/-]+)`, 'g');
  const seen = new Set<string>();
  const out: HubMediaRef[] = [];
  for (const m of text.matchAll(re)) {
    const key = m[2] ?? '';
    const sub = key.split('/')[2] ?? '';
    if (!COUPLE_MEDIA_METER_SUBPATHS.has(sub) || NOT_A_PICTURE.has(sub) || SOUND.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ref: `${m[1] ?? ''}${key}`, key, kind: CLIP.test(key) ? 'clip' : 'photo' });
    if (out.length >= max) break;
  }
  return out;
}
