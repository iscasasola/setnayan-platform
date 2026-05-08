import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentEvent } from "@/lib/db/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateGuestQrSvg } from "@/lib/server/qr";
import { ROLE_LABELS, type Guest } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tayo · Print QR Sheet",
  robots: { index: false, follow: false },
};

export default async function PrintSheetPage() {
  const event = await getCurrentEvent();
  if (!event) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: guests } = await admin
    .from("guests")
    .select("*")
    .eq("event_id", event.event_id)
    .is("deleted_at", null)
    .order("last_name");

  const guestsArr = (guests as Guest[] | null) ?? [];

  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const cards = await Promise.all(
    guestsArr.map(async (g) => ({
      guest: g,
      svg: await generateGuestQrSvg({
        origin,
        event_id: event.event_id,
        event_slug: event.slug,
        guest_id: g.guest_id,
        qr_token: g.qr_token,
      }),
    })),
  );

  return (
    <div className="print-page min-h-screen bg-page-bg p-4 print:bg-white print:p-0">
      <div className="screen-only mx-auto mb-6 flex max-w-[680px] items-center justify-between gap-3">
        <p className="meta-label">Print preview · {cards.length} cards</p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="btn-accent text-[12px]"
          // print() is fine inside an inline onClick on a server component
          // because Next ships this as a static button; the client browser
          // handles the call.
        >
          🖨 Print
        </button>
      </div>

      <div className="print-grid mx-auto grid max-w-[210mm] grid-cols-3 gap-2 bg-white p-4 print:max-w-none print:p-0 print:gap-1.5">
        {cards.map(({ guest, svg }) => (
          <article key={guest.guest_id} className="qr-card">
            <div className="qr-card-svg" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="qr-card-meta">
              <div className="qr-card-name">
                {guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`}
              </div>
              <div className="qr-card-role">{ROLE_LABELS[guest.role]}</div>
            </div>
            <div className="qr-card-foot">tayo.app · powered by Tayo</div>
          </article>
        ))}
      </div>

      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { background: white; }
          .screen-only { display: none !important; }
          .print-grid { break-inside: avoid; }
          .qr-card { page-break-inside: avoid; }
        }
        .qr-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px;
          border: 1px solid var(--rule-strong);
          border-radius: 8px;
          background: white;
          break-inside: avoid;
        }
        .qr-card-svg {
          aspect-ratio: 1 / 1;
          background: white;
          padding: 2px;
          border-radius: 4px;
        }
        .qr-card-svg svg {
          width: 100%;
          height: 100%;
        }
        .qr-card-meta {
          flex: 1;
          padding: 0 2px;
          min-width: 0;
        }
        .qr-card-name {
          font-size: 10px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .qr-card-role {
          font-size: 8px;
          font-family: var(--font-dm-mono), monospace;
          color: var(--ink-soft);
          line-height: 1.1;
          margin-top: 2px;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .qr-card-foot {
          font-size: 7px;
          font-family: var(--font-dm-mono), monospace;
          color: var(--ink-faint);
          letter-spacing: 0.08em;
          text-align: center;
          padding-top: 2px;
          border-top: 1px dashed var(--rule);
        }
      `}</style>
    </div>
  );
}
