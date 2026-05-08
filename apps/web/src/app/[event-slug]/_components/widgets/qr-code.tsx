import { QrActions } from "./qr-actions";

interface Props {
  qrSvg: string;
}

export function QrCodeWidget({ qrSvg }: Props) {
  return (
    <section className="overflow-hidden rounded-3xl border-2 border-accent/30 bg-surface px-6 py-9 text-center shadow-tayo-md lg:px-10 lg:py-12">
      <p className="meta-label mb-2" style={{ color: "var(--accent)" }}>
        Your wedding QR
      </p>
      <h2 className="font-serif text-[24px] font-medium text-ink lg:text-[28px]">
        For tagging &amp; pickup
      </h2>

      <div
        className="mx-auto my-7 grid h-[220px] w-[220px] place-items-center rounded-2xl bg-page-bg-soft p-4 lg:h-[260px] lg:w-[260px]"
        aria-label="Personal QR code"
      >
        <div
          className="h-full w-full"
          /* The qrcode npm package returns a complete <svg>…</svg> string. */
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      <p className="mx-auto max-w-[420px] text-[13px] leading-relaxed text-ink-soft lg:text-[14px]">
        Show this when you arrive — our shutterbugs will tag you in photos and
        you'll pick them up here after the wedding. Save it to your phone so it
        works offline.
      </p>

      <div className="mt-6">
        <QrActions />
      </div>
    </section>
  );
}
