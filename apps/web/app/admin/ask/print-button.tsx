'use client';

/** "Download PDF" — the browser's own Save as PDF over the one A4 page (no file is built on our side). */
import { Download } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

export function PrintButton() {
  return <ActionButton tone="ok" main icon={<Download />} label="Download PDF" type="button" onClick={() => window.print()} />;
}
