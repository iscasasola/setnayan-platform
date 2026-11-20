'use client';

import { PaperUploadPlace } from '@/app/vendor-dashboard/shop/_components/paper-upload-place';
import type { InlineDocsPayload } from '@/app/vendor-dashboard/shop/inline-docs-actions';

/** The REAL upload place, with a no-op reload — the lab has no database to reload from. */
export function LabUploadPlace({ payload, vendorProfileId }: { payload: InlineDocsPayload; vendorProfileId: string }) {
  return <PaperUploadPlace payload={payload} vendorProfileId={vendorProfileId} isVerified onSaved={() => undefined} />;
}
