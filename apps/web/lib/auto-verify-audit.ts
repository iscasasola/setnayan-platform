/**
 * auto-verify-audit.ts — the names the automatic verification check and the
 * admin queue share, kept in a module with no server dependencies so the
 * admin page can import them without pulling the reader in.
 */

/** `admin_audit_log.action` of the one JSON log written per submission. */
export const AUTO_CHECK_AUDIT_ACTION = 'vendor_verification_auto_check';

/**
 * "Fri, 14 Nov · 10:03 AM Manila time" — the approved design's form. Every
 * time on both sides says Manila (F-W1-61: the live admin printed UTC, 8 hours off).
 */
export function formatManilaDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time} Manila time`;
}
