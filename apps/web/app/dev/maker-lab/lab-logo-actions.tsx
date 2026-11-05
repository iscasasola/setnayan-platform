'use client';

import type { ReactNode } from 'react';
import { LogoActionsProvider } from '@/app/dashboard/[eventId]/launch/_components/logo-actions-context';
import { LAB_LOGO_ACTIONS, LAB_LOGO_REFUSALS } from './lab-logo-stand-ins';

/** 🧪 The lab gives Studio › Logo its stand-in writer (DEV-ONLY). The app never provides the context. `refuse` = `&refuse=1`. */
export function LabLogoActions({ refuse = false, children }: { refuse?: boolean; children: ReactNode }) {
  return <LogoActionsProvider actions={refuse ? LAB_LOGO_REFUSALS : LAB_LOGO_ACTIONS}>{children}</LogoActionsProvider>;
}
