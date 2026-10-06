/**
 * lib/gift-registry.ts — E-GIFTS › REGISTRY LINK (owner 2026-10-07, "THE MISSING
 * FIELDS ARE APPROVED"; prototype `EDITORS.gifts`: *"Paste a link to your
 * registry"*, optional).
 *
 * ONE rule, read by the writer (`savePabuyaMessage`) and by every reader:
 * http(s) only, one line, at most 500 characters — the same bounds the column's
 * CHECK holds (`events_gift_registry_url_check`, migration 20271265788160), so a
 * value this refuses can never be stored and a stored value always passes here.
 * Empty = no link (NULL). Pure.
 */

export const GIFT_REGISTRY_URL_MAX = 500;

export const GIFT_REGISTRY_URL_ERROR = 'That link does not look right — paste one that starts with https://';

/** Typed words → the link to store: `null` = none, `undefined` = refused (said, nothing written). */
export function cleanGiftRegistryUrl(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (v === '') return null;
  if (v.length > GIFT_REGISTRY_URL_MAX || !/^https?:\/\/\S+$/i.test(v)) return undefined;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  if (!url.hostname.includes('.')) return undefined;
  return v;
}

/** A stored value as guests may be shown it, or null (a value that no longer passes is never drawn). */
export function giftRegistryHref(stored: unknown): string | null {
  const v = cleanGiftRegistryUrl(stored);
  return typeof v === 'string' ? v : null;
}
