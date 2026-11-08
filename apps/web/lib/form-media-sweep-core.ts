/**
 * 🧹 FORM MEDIA — EVERY UPLOAD HAS A CLEANUP (THE ONE BUILD §4: "library form media kept while the form exists
 * (+ the cleanup sweep)"). Pure, so a test runs the decision.
 *
 * A Form Maker media file is uploaded to `vendors/<shop>/forms/…` in the public media bucket BEFORE the form is saved.
 * If the supplier then removes it, or closes the Maker without saving, the object is referenced by nothing. Those —
 * and ONLY those — are swept:
 *   • a key referenced by ANY item of the shop (live or retired) is kept — a form is never deleted (retired only), so
 *     its files live as long as it does;
 *   • a key newer than the grace window is kept — it may be an upload whose save is still in flight.
 */
export const FORM_MEDIA_BUCKET = 'setnayan-media';
export const FORM_MEDIA_GRACE_MS = 24 * 60 * 60 * 1000;

export function formMediaFolder(vendorProfileId: string): string {
  return `vendors/${vendorProfileId}/forms/`;
}

/** `r2://setnayan-media/<key>` → `<key>`; anything else → null. */
export function keyOfFormMediaRef(ref: string): string | null {
  const p = `r2://${FORM_MEDIA_BUCKET}/`;
  return ref.startsWith(p) ? ref.slice(p.length) : null;
}

export function formMediaOrphans(
  listed: readonly { key: string; lastModified: Date | null }[],
  referencedRefs: readonly string[],
  folder: string,
  nowMs: number,
  graceMs = FORM_MEDIA_GRACE_MS,
): string[] {
  const kept = new Set(referencedRefs.map(keyOfFormMediaRef).filter((k): k is string => !!k));
  return listed
    .filter((o) => o.key.startsWith(folder))
    .filter((o) => !kept.has(o.key))
    .filter((o) => o.lastModified !== null && nowMs - o.lastModified.getTime() > graceMs)
    .map((o) => o.key);
}
