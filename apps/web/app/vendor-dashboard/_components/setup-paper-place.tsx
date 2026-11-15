'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { REQUIRED_DOC_SLOT_KEYS, sentBackOf, type DocUpload } from '@/lib/vendor-verification';
import { loadInlineDocs, type InlineDocsPayload } from '../shop/inline-docs-actions';
import { PaperUploadPlace } from '../shop/_components/paper-upload-place';
import { CouldNotLoad } from '../shop/_components/could-not-load';

/**
 * 🧾 STEP 5 · SEND YOUR DOCUMENTS — THE ONE UPLOAD PLACE (owner 2026-11-14, DECISION_LOG "supplier papers demo approved";
 * the approved demo is the contract). The supplier presses ONE upload button and picks all three papers at once; the
 * app reads each file, ticks it Reading… → Recognised, and files it as DTI or SEC · BIR 2303 · Business Permit itself.
 *
 * It is the SAME `PaperUploadPlace` Your details › Get verified draws (`docs-body.tsx`) — the same component, the same
 * read (`loadInlineDocs`) and the same save (`updateDocUploadInline`, intent `intake`). Never a second drawing: the three
 * separate "Add" rows this step used to draw (`setup-papers.tsx`, 7 Nov) are RETIRED with it (15 Nov 2026 — the owner
 * found them still live after #7624).
 *
 *   · `papersMeasured` false — the page's own read of the application was refused: said (`CouldNotLoad`), never drawn
 *     as an empty place to upload into.
 *   · `initial` — the lab hands its fixture in; on Today the place loads its payload once, like the Get verified step.
 *   · A send-back that NAMED its papers says its reason on those papers only (inside the place, #7627). The one line
 *     here is for a send-back made before that rule, which named none.
 *
 * 🔒 the-papers-and-the-qr-hold.test.ts (B) · today-step-5-is-the-one-paper-place.test.ts
 */
export function SetupPaperPlace({
  vendorProfileId,
  isVerified,
  papersMeasured,
  reason,
  initial,
}: {
  vendorProfileId: string;
  /** From the page's one authoritative read, threaded down — never a probe here. */
  isVerified: boolean;
  /** FALSE: the page's application read was refused. */
  papersMeasured: boolean;
  /** Setnayan's reason, when the papers came back (an old send-back that named no paper). */
  reason: string | null;
  /** The lab's fixture; absent on Today, where the place loads its own. */
  initial?: InlineDocsPayload;
}) {
  const [payload, setPayload] = useState<InlineDocsPayload | null>(initial ?? null);
  const [failed, setFailed] = useState(false);

  const reload = () => {
    setFailed(false);
    loadInlineDocs()
      .then((p) => setPayload(p))
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    if (!papersMeasured || initial) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papersMeasured, initial]);

  if (!papersMeasured || failed) return <CouldNotLoad what="your papers" />;

  const namedSendBack = payload
    ? [...REQUIRED_DOC_SLOT_KEYS].some((k) => sentBackOf(payload.docMap[k] as DocUpload | undefined))
    : false;
  const oldSendBack = payload?.status === 'rejected' && reason && !namedSendBack ? reason : null;

  return (
    <div className="space-y-3" data-setup-paper-place="">
      <div className="flex items-center gap-1 text-[13.5px] leading-snug text-ink/70">
        <p>Setnayan checks them before you go live.</p>
        <InfoTip label="" ariaLabel="About the documents" align="start">
          <b>The three required papers</b> — DTI or SEC · BIR 2303 · Mayor’s Permit. PDF / JPG / PNG up to 15 MB each.
          Each one is read and saved the moment it’s in; you send them to Setnayan from <b>Get verified</b>, below.
          <b> Optional, after these</b> — portfolio samples, past client references and your social links, on Your
          details.
        </InfoTip>
      </div>
      {oldSendBack ? (
        <p role="alert" className="text-[13.5px] leading-snug text-danger-700" data-setup-papers-reason="">
          Setnayan sent them back: {oldSendBack}
        </p>
      ) : null}
      {payload ? (
        <PaperUploadPlace payload={payload} vendorProfileId={vendorProfileId} isVerified={isVerified} onSaved={reload} />
      ) : (
        <p className="inline-flex min-h-11 items-center gap-2 text-sm text-ink/70" role="status">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
          Loading your papers…
        </p>
      )}
    </div>
  );
}
