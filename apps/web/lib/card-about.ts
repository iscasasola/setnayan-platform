/**
 * 📝 A CARD'S DESCRIPTION AND VIDEO LINK (HYBRID map Q3, 2026-11-17 — "Description + video link: add in this build";
 * columns `vendor_services.description` / `video_url`, migration 20271351531329).
 *
 * The save reads them only when the screen DREW them (`about_present`), the same missing-key rule the gift row keeps:
 * a screen without the fields never clears what a card already says. Pure — no I/O.
 */
export const DESCRIPTION_MAX = 1000;
export const VIDEO_URL_MAX = 500;

export type CardAbout = { description: string | null; video_url: string | null };

/** "youtu.be/x" → "https://youtu.be/x"; a link that is not https (or not a link) is `null`. */
export function cleanVideoUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  if (withScheme.length > VIDEO_URL_MAX || /\s/.test(withScheme)) return null;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
  return u.toString();
}

export function videoUrlProblem(raw: string): string | null {
  if (raw.trim() === '') return null;
  return cleanVideoUrl(raw) ? null : 'Paste a link that starts with https://';
}

export type CardAboutRead = { present: false } | { present: true; ok: true; about: CardAbout } | { present: true; ok: false; error: string };

export function readCardAbout(formData: FormData): CardAboutRead {
  if (formData.get('about_present') !== '1') return { present: false };
  const d = formData.get('description');
  const v = formData.get('video_url');
  const description = typeof d === 'string' && d.trim() !== '' ? d.trim() : null;
  if (description && description.length > DESCRIPTION_MAX) {
    return { present: true, ok: false, error: `Keep the description to ${DESCRIPTION_MAX.toLocaleString('en-PH')} characters.` };
  }
  const rawUrl = typeof v === 'string' ? v : '';
  const video_url = cleanVideoUrl(rawUrl);
  if (rawUrl.trim() !== '' && !video_url) return { present: true, ok: false, error: 'The video link must be a full link that starts with https://' };
  return { present: true, ok: true, about: { description, video_url } };
}

/** The words the full card shows for a video link: the site's name ("youtube.com"), never the long link. */
export function videoSiteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, '');
  } catch {
    return 'the video';
  }
}
