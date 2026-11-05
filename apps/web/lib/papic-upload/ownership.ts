// lib/papic-upload/ownership.ts — which `papic` queue items the page's uploader
// owns. Pure, so the sync daemon (lib/offline/sync-daemon.ts) can ask without
// importing the uploader — and so the rule is one unit test.
//
// Owned: the save-first shots and their bytes (`save-first` / `save-first-blob`)
// and the OLD guest/supplier multipart items (`guest` / `vendor`), which the
// uploader adopts on page open (lib/papic-upload/browser.ts adoptLegacy). The
// seat camera's items (no `mode`) stay with the daemon.

export function ownedByPageUploader(item: { payload?: Record<string, unknown> | null }): boolean {
  const mode = item.payload?.mode;
  return mode === 'save-first' || mode === 'save-first-blob' || mode === 'guest' || mode === 'vendor';
}
