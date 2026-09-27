/**
 * THE MAKER'S DRAFT STATUS, IN THE TOOLBAR (owner 2026-09-27: the Logo page's
 * own "Saving… · Saved to your draft" header bar is gone — the status lives in
 * the Maker toolbar's Apply area).
 *
 * A page that autosaves into the draft (the Logo page) tells the toolbar what is
 * happening through one window event; `HubDraftToolbar` shows it beside Apply.
 * An error is never silent: it is shown until the next save succeeds.
 */
export type MakerSaveStatus = { state: 'saving' } | { state: 'saved' } | { state: 'error'; text: string };

export const MAKER_SAVE_STATUS_EVENT = 'setnayan:maker-save-status';

export function announceMakerSave(status: MakerSaveStatus): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<MakerSaveStatus>(MAKER_SAVE_STATUS_EVENT, { detail: status }));
}

export function onMakerSave(fn: (status: MakerSaveStatus) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<MakerSaveStatus>).detail);
  window.addEventListener(MAKER_SAVE_STATUS_EVENT, h);
  return () => window.removeEventListener(MAKER_SAVE_STATUS_EVENT, h);
}

/** The words the toolbar shows for each state. */
export function makerSaveStatusText(s: MakerSaveStatus): string {
  return s.state === 'saving' ? 'Saving…' : s.state === 'saved' ? 'Saved to your draft' : s.text;
}
