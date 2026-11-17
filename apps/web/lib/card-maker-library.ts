/** 📚 What the card maker loads from — the shape only (the read is `card-maker-library.server.ts`). */
import type { PayPlanOption } from '@/lib/vendor-pay-plans';
import type { IncludedTemplate } from '@/lib/included-templates';

export type CardMakerLibrary = {
  payPlans: PayPlanOption[] | null;
  shopCards: { id: string; title: string; payPlanId: string | null }[] | null;
  includedTemplates: IncludedTemplate[] | null;
};
