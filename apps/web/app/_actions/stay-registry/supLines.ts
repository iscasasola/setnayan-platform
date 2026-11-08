import 'server-only';
import type { SupLinesStayDoor } from '@/lib/stay-doors/supLines';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { attachLineToActivity, deleteLine, updateLine } from '@/app/vendor-dashboard/lines/actions';
import { kind, type Door } from './_door';

/** `?error=` already carries the page's own sentence (`lines/page.tsx` prints it as given). Signed out → `/login`, no
 *  shop → `/vendor-dashboard/verify` (outside `within`): both navigate. */
const SUP_LINES_WORDS: StayWords = { within: [supplierScreen('lines')], refuse: (q) => q.get('error') };
const supLines = kind(SUP_LINES_WORDS, null);

export const SUP_LINES: Readonly<Record<SupLinesStayDoor, Door>> = {
  'supLines.updateLine': supLines(updateLine),
  'supLines.deleteLine': supLines(deleteLine),
  'supLines.attachLineToActivity': supLines(attachLineToActivity),
};
