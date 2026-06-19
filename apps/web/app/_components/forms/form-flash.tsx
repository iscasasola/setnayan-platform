/**
 * Shared form-feedback banner. `tone="error"` → assertive alert (terracotta);
 * `tone="success"` → polite status (emerald).
 *
 * Extracted 2026-06-13 (dashboard-consolidation Track A) from the saved/error
 * `<p>` banners copy-pasted across ~39 files on all three doorways. Only the
 * byte-identical banner chrome lives here — the message text and which search
 * param triggers it stay in each page, so per-surface copy is unaffected.
 * Non-standard one-off tones (amber deletion-pending, neutral reset notices)
 * intentionally stay inline; this covers the two duplicated tones only.
 */
export function FormFlash({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: React.ReactNode;
}) {
  if (tone === 'error') {
    return (
      <p
        role="alert"
        className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
      >
        {children}
      </p>
    );
  }
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
    >
      {children}
    </p>
  );
}
