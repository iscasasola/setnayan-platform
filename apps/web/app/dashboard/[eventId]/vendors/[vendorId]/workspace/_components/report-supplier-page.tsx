'use client';

/**
 * 🚩 REPORT — the host's picked supplier's last page (owner 11 Nov 2026: *"Clients side is not fixed also. There is also
 * no report."*). The supplier's picked client ends on Report (`vendor-dashboard/clients/[eventId]/_pages/report.tsx`);
 * the host's picked supplier now does too.
 *
 * Reused, not invented: the host's SHIPPED "Report a problem" — the (+)'s last row (`lib/chat-plus.ts`, door
 * `host-report`) has always opened the Disputes page, and this is that page's own form (`NewFlagForm`, the same action
 * `fileForceMajeureFlag`, the same stay door), drawn open and about THIS supplier (the supplier is filled in, never
 * picked). It lands where every couple report lands — the admins' Disputes queue — and is tracked on Disputes, which the
 * line after a sent report links to. No new table, no new action.
 *
 * Why not the supplier's "Report to Setnayan" (`help_messages`): its database guard admits only a shop reporting on an
 * event it talks to (`help_messages_origin_guard`) — a host's row would be refused, and widening it is a migration.
 */
import { useState } from 'react';
import Link from 'next/link';
import { NewFlagForm } from '@/app/dashboard/[eventId]/disputes/_components/dispute-parts';

export function ReportSupplierPage({ eventId, eventVendorId, supplierName }: { eventId: string; eventVendorId: string; supplierName: string }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-3" data-picked-supplier-page="report">
      <NewFlagForm eventId={eventId} supplier={{ id: eventVendorId, name: supplierName }} onSaved={() => setSent(true)} />
      {sent ? (
        <p role="status" className="text-sm text-success-700" data-report-sent="">
          Report sent to Setnayan.{' '}
          <Link href={`/dashboard/${eventId}/disputes`} className="inline-flex min-h-11 items-center text-terracotta-700 underline">
            Track it on Disputes ›
          </Link>
        </p>
      ) : null}
    </div>
  );
}
