import 'server-only';

/**
 * apps/web/lib/social/tiktok.ts
 *
 * TikTok publishing client (Phase C of the social auto-publish pipeline —
 * corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8). Mirrors
 * lib/social/instagram.ts: same NEVER-THROWS contract, same ~15s timeout,
 * same result shape.
 *
 * We post the branded 9:16 (1080×1920) card as a single-image PHOTO post via
 * the Content Posting API PHOTO mode (TikTok Photo Mode — a real format, NOT a
 * video). The card route serves a public JPEG that TikTok pulls server-side:
 *
 *   POST https://open.tiktokapis.com/v2/post/publish/content/init/
 *     Authorization: Bearer {TIKTOK_ACCESS_TOKEN}
 *     Content-Type: application/json
 *     {
 *       post_info:   { title, description, disable_comment, privacy_level,
 *                      auto_add_music },
 *       source_info: { source: 'PULL_FROM_URL', photo_cover_index, photo_images },
 *       post_mode:   'DIRECT_POST',
 *       media_type:  'PHOTO',
 *     }
 *   → { data: { publish_id }, error: { code, message } }
 *
 * `error.code === 'ok'` means the init was ACCEPTED — publishing is async, so
 * the post keeps processing server-side after this returns. We stamp publish_id
 * as the external id and DON'T long-poll the status endpoint
 * (/v2/post/publish/status/fetch/) inside the flush — init + stamp is enough
 * for V1.
 *
 * IMPORTANT operational gates (owner steps — until done, this stays inert and
 * the admin queue's assisted-manual panel is the working surface):
 *   • PER-ACCOUNT OAuth USER TOKEN. TikTok publishing authorizes against a
 *     specific account's user access token (TIKTOK_ACCESS_TOKEN), not an app
 *     token. Tokens are short-lived — refresh wiring is a follow-on.
 *   • DEVELOPER AUDIT. An UNAUDITED client can only post privately
 *     (SELF_ONLY); PUBLIC_TO_EVERYONE needs the Content Posting API audit. So
 *     auto-posting stays GATED behind isTikTokConfigured() (a token present);
 *     the default + recommended mode is ASSISTED-MANUAL.
 *   • PULL_FROM_URL DOMAIN VERIFICATION. PULL_FROM_URL requires the card
 *     route's domain to be verified in the TikTok dev portal (owner step).
 *   • Rate limit is 6 req/min/token — far above our ≤1/day TikTok governor cap.
 *
 * // PHASE D: real MP4 / Reels-style video publishing (media_type VIDEO via the
 * //          Content Posting API video flow) needs a video render pipeline
 * //          that isn't wired yet — explicitly out of scope here.
 */

const TIKTOK_PHOTO_INIT_URL =
  'https://open.tiktokapis.com/v2/post/publish/content/init/';

/** Abort a hung TikTok call after ~15s — a flush must never wedge a request. */
const TIKTOK_TIMEOUT_MS = 15_000;

/** Photo-post title cap (TikTok rejects longer). */
const TIKTOK_TITLE_MAX = 90;
/** Photo-post description/caption cap. */
const TIKTOK_DESCRIPTION_MAX = 4000;

export type TikTokPostResult =
  | { ok: true; externalId: string; postUrl: string | null }
  | { ok: false; error: string };

/**
 * True once the owner has pasted the per-account user token (Vercel env). The
 * auto-post adapter is wired but INERT until this is true — and even then the
 * client must be audited for the PUBLIC_TO_EVERYONE post to clear.
 */
export function isTikTokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN);
}

/**
 * Publish one single-image PHOTO post (the branded 9:16 card) to the Setnayan
 * TikTok account. init is async — on accept we stamp the publish_id and return;
 * TikTok gives no permalink synchronously (the post processes server-side), so
 * postUrl is null.
 */
export async function postPhotoToTikTok({
  imageUrl,
  title,
  caption,
}: {
  imageUrl: string;
  title: string;
  caption: string;
}): Promise<TikTokPostResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, error: 'TikTok is not configured (TIKTOK_ACCESS_TOKEN missing).' };
  }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return { ok: false, error: 'TikTok requires a public http(s) image URL.' };
  }

  const body = {
    post_info: {
      title: title.slice(0, TIKTOK_TITLE_MAX),
      description: caption.slice(0, TIKTOK_DESCRIPTION_MAX),
      disable_comment: false,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      auto_add_music: true,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_cover_index: 0,
      photo_images: [imageUrl],
    },
    post_mode: 'DIRECT_POST',
    media_type: 'PHOTO',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIKTOK_TIMEOUT_MS);
  try {
    const res = await fetch(TIKTOK_PHOTO_INIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as
      | {
          data?: { publish_id?: string };
          error?: { code?: string; message?: string };
        }
      | null;

    // TikTok returns 200 with error.code 'ok' on accept; any other code (or a
    // non-2xx / non-JSON body) is a failure.
    const code = payload?.error?.code;
    if (!res.ok || !payload || (code && code !== 'ok')) {
      const detail =
        payload?.error?.message ??
        `TikTok API HTTP ${res.status}${payload ? '' : ' (non-JSON body)'}`;
      return { ok: false, error: detail.slice(0, 500) };
    }

    const publishId = payload.data?.publish_id;
    if (!publishId) {
      return { ok: false, error: 'TikTok init returned no publish_id.' };
    }

    // Accepted — publishing continues async. No synchronous permalink.
    return { ok: true, externalId: publishId, postUrl: null };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `TikTok API call timed out after ${TIKTOK_TIMEOUT_MS / 1000}s.`
        : err instanceof Error
          ? err.message
          : 'Unknown TikTok publish error.';
    return { ok: false, error: message.slice(0, 500) };
  } finally {
    clearTimeout(timeout);
  }
}
