/**
 * admin-request-bits.tsx — the admin's status pill for a service request (the prototype's short words:
 * Pending · Added · Moved · Kept for shop · Not added). Words come from `adminStatusWord`.
 */
import { adminStatusWord, type RequestStatus, type StatusTone } from '@/lib/service-requests';

const TONE: Record<StatusTone, string> = {
  wait: 'bg-terracotta/10 text-terracotta-700',
  ok: 'bg-success-50 text-success-800',
  info: 'bg-mulberry/10 text-mulberry',
  grey: 'bg-ink/[0.05] text-ink/70',
  bad: 'bg-danger-50 text-danger-800',
};

export function AdminStatusPill({ status }: { status: RequestStatus }) {
  const { word, tone } = adminStatusWord(status);
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{word}</span>;
}
