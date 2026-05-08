import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getCurrentEvent } from "@/lib/db/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateGuestQrSvg } from "@/lib/server/qr";
import type { Guest, ScanEvent } from "@/lib/db/types";
import { QrAdminTable } from "./_components/qr-admin-table";

export const dynamic = "force-dynamic";

export default async function QrCodesPage() {
  const event = await getCurrentEvent();
  if (!event) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: guests }, { data: scans }] = await Promise.all([
    admin
      .from("guests")
      .select("*")
      .eq("event_id", event.event_id)
      .is("deleted_at", null)
      .order("last_name"),
    admin
      .from("scan_events")
      .select("scan_id, guest_id, source, scanned_at")
      .eq("event_id", event.event_id)
      .order("scanned_at", { ascending: false }),
  ]);

  const guestsArr = (guests as Guest[] | null) ?? [];
  const scansArr = (scans as Pick<ScanEvent, "scan_id" | "guest_id" | "source" | "scanned_at">[] | null) ?? [];

  // Latest scan per guest, indexed for the table.
  const latestScanByGuest = new Map<string, string>();
  for (const s of scansArr) {
    if (!latestScanByGuest.has(s.guest_id)) {
      latestScanByGuest.set(s.guest_id, s.scanned_at);
    }
  }

  // Pre-render thumbnail SVGs (cached in memory for the request lifecycle).
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const qrSvgs = new Map<string, string>();
  await Promise.all(
    guestsArr.map(async (g) => {
      const svg = await generateGuestQrSvg({
        origin,
        event_id: event.event_id,
        event_slug: event.slug,
        guest_id: g.guest_id,
        qr_token: g.qr_token,
      });
      qrSvgs.set(g.guest_id, svg);
    }),
  );

  const stats = {
    total: guestsArr.length,
    sent: guestsArr.filter((g) => !!g.invitation_sent_at).length,
    scanned: latestScanByGuest.size,
  };

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="meta-label mb-2">Dashboard / Guest QRs</p>
            <h1 className="display-title">Guest QRs &amp; Scan Status</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              {stats.total} generated · {stats.scanned} scanned · {stats.sent} sent
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/qr-codes/print"
              target="_blank"
              className="btn-default text-[12px]"
            >
              <span aria-hidden>🖨</span> Print sheet (A4)
            </Link>
            <button type="button" disabled className="btn-ghost cursor-not-allowed opacity-60">
              <span aria-hidden>⇪</span> Export PDF
            </button>
            <button type="button" disabled className="btn-default cursor-not-allowed opacity-60">
              <span aria-hidden>✉</span> Send invitation links
            </button>
          </div>
        </header>

        <CoverageLegend />

        <QrAdminTable
          guests={guestsArr}
          qrSvgs={Object.fromEntries(qrSvgs)}
          latestScanByGuest={Object.fromEntries(latestScanByGuest)}
        />
      </div>
    </div>
  );
}

function CoverageLegend() {
  return (
    <div className="rounded-2xl border border-rule bg-surface px-5 py-4">
      <p className="meta-label mb-3">Coverage legend</p>
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Dot k="A" filled={false} /> Arrival (first-rule)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Dot k="C" filled={false} /> Ceremony
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Dot k="Co" filled={false} /> Cocktails
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Dot k="R" filled={false} /> Reception
        </span>
        <span className="text-ink-faint">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Dot k="✓" filled /> Photographed in segment
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Dot k="✓" filled withClip /> Photographed + has clip
        </span>
      </div>
    </div>
  );
}

function Dot({
  k,
  filled,
  withClip,
}: {
  k: string;
  filled: boolean;
  withClip?: boolean;
}) {
  return (
    <span
      className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
      style={{
        background: filled ? "var(--rsvp-attending)" : "var(--page-bg-soft)",
        color: filled ? "white" : "var(--ink-soft)",
        border: filled ? "none" : "1px solid var(--rule-strong)",
      }}
    >
      {k}
      {withClip && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      )}
    </span>
  );
}
