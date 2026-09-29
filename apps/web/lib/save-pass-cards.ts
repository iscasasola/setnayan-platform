/**
 * lib/save-pass-cards.ts — hand one or several pass cards to the phone.
 *
 * The card's NAME is the server's (`Content-Disposition`, `passCardFileName`):
 * `Maria-Santos-pass-Indalecio-Claire-2026-12-18.png`. The client never spells
 * it, so a save from the Me tab, the thank-you, the checklist or the couple's
 * guest card can never disagree about what the file is called.
 *
 *   · where the device can share files (a phone): ONE share sheet with every
 *     card in it — "Save N Images" on iPhone;
 *   · otherwise: one download after another.
 *
 * 🪤 A share needs a FRESH tap: if the cards took long enough to draw that iOS
 * refuses the share (`NotAllowedError`), the files are kept and the caller
 * shows "Tap to save" — the same answer `PrintSaveButton` gives.
 */

export type PassCardSave =
  | { k: 'saved' }
  | { k: 'needsTap'; files: File[] }
  | { k: 'failed'; message: string };

/** `attachment; filename="Maria-Santos-pass-….png"` → the name. */
export function fileNameFromDisposition(header: string | null, fallback = 'pass.png'): string {
  const m = /filename="([^"]+)"/i.exec(header ?? '');
  return m?.[1] ?? fallback;
}

export async function fetchPassCards(hrefs: readonly string[]): Promise<File[] | { message: string }> {
  const out: File[] = [];
  for (const href of hrefs) {
    const res = await fetch(href, { credentials: 'same-origin' }).catch(() => null);
    if (!res || !res.ok) {
      const said = res ? (await res.text().catch(() => '')).trim() : '';
      return { message: said && said.length < 200 ? said : 'Could not get your ticket just now. Try again.' };
    }
    const blob = await res.blob();
    out.push(new File([blob], fileNameFromDisposition(res.headers.get('content-disposition')), { type: 'image/png' }));
  }
  return out;
}

function canShareAll(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })
  );
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Hand files already in hand to the device. */
export async function handPassCards(files: File[]): Promise<PassCardSave> {
  if (files.length === 0) return { k: 'failed', message: 'There is no pass to save yet.' };
  if (canShareAll(files)) {
    try {
      await navigator.share({ files });
      return { k: 'saved' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { k: 'saved' };
      if (e instanceof DOMException && e.name === 'NotAllowedError') return { k: 'needsTap', files };
      // anything else → the download path below
    }
  }
  // Browsers block a burst of downloads; a short gap lets each one land.
  for (let i = 0; i < files.length; i += 1) {
    download(files[i]!);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
  return { k: 'saved' };
}

export async function savePassCards(hrefs: readonly string[]): Promise<PassCardSave> {
  const got = await fetchPassCards(hrefs);
  if (!Array.isArray(got)) return { k: 'failed', message: got.message };
  return handPassCards(got);
}
