'use client';

/**
 * 💬 A GROUP'S (+) — the shipped sheet (`ToolsSheetButton`), with the group's rows only (owner, 12 Nov — "EVENT GROUP
 * CHATS APPROVED AS DRAWN" (2)): Decision · Poll · Meeting · Photos & files, and a last quiet row that points money to
 * each supplier's own chat. Its rows are also the composer's "/" list (the sheet publishes them), so a typed "/quote"
 * offers nothing in a group. Loaded only when a group is opened (the page imports it through `next/dynamic`).
 * 🔒 lib/event-group-chats.test.ts
 */
import { ToolsSheetButton, type SheetRow } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { PLUS_ROW_PAGE, groupPlusRows } from '@/lib/chat-plus';
import { usePlus } from '@/lib/chat-plus-store';

export default function GroupThreadToolsSheet({ threadId }: { threadId: string }) {
  // 🗳 One open poll per chat: the stream's poll card tells the store; the Poll row goes grey with its reason.
  const { pollOpen } = usePlus(threadId);
  const rows: SheetRow[] = groupPlusRows({ pollOpen }).map((r) => ({
    key: r.key,
    label: r.label,
    line: r.line,
    icon: 'file',
    shut: r.shutNow ?? null,
    card: r.card,
    page: PLUS_ROW_PAGE[r.key],
  }));
  return <ToolsSheetButton rows={rows} sheetMark="group" threadId={threadId} />;
}
