import 'server-only';
import { cookies } from 'next/headers';

/**
 * lib/stay-news.server.ts — 📍 THE STEP A SCREEN DRAWS FROM ITS LAST SAVE, WHEN THE SAVE STAYED IN PLACE (owner,
 * 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE SCREEN — APP-WIDE").
 *
 * Some screens draw a step from the redirect that ended the press — Requests' "Accepted · just now · Send invite ·
 * Undo" comes from `?done=kept&who=<guest>`. Saved in place there is no new address, so the door
 * (`app/_actions/save-in-place.ts`, for an area with `keepNews`) keeps the same `?<news>` in a short-lived, httpOnly
 * cookie scoped to that screen's path, and the screen reads it here alongside its own search params. The re-render the
 * save triggers sees it at once; it lapses in two minutes (as `?done=` lingered in the address before). A no-JavaScript
 * press still lands on the redirect, exactly as before.
 */
export const STAY_NEWS_COOKIE = 'stay_news';
export const STAY_NEWS_MAX_AGE = 120;

export async function readStayNews(path: string): Promise<Record<string, string>> {
  try {
    const raw = (await cookies()).get(STAY_NEWS_COOKIE)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { p?: unknown; q?: unknown };
    if (parsed.p !== path || !parsed.q || typeof parsed.q !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.q as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export async function keepStayNews(path: string, news: Record<string, string>): Promise<void> {
  (await cookies()).set(STAY_NEWS_COOKIE, JSON.stringify({ p: path, q: news }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path,
    maxAge: STAY_NEWS_MAX_AGE,
  });
}
