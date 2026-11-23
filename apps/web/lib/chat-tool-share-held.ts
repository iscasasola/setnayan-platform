/**
 * 🧰 WHICH TOOLS THIS SHOP MAY SHARE INTO A CHAT — the picker's list and the send's check, from ONE rule.
 *
 * A tool is shareable when it is one of the five (`SHAREABLE_TOOLS`) AND it WORKS for the shop now, read the Store's own
 * way (`toolStatus` + `toolIsOpen`, `lib/supplier-store.ts`, over the facts `readStoreToolFacts` reads): a free tool the
 * shop added to Your tools, or a paid tool it bought AND is on Plus, Pro or Ultra for (owner a02673ac, 23 Nov: no trial;
 * the plan alone opens nothing). A bought tool locked off-plan ("Works again when you subscribe") is NOT shared: the
 * couple's Open would land on a locked tool. Never the layout alone. A paid tool whose state could not be read is NOT
 * offered (`unread`), and the picker says it could not load — never a tool the shop might not have.
 * 🔒 lib/chat-tool-share.test.ts
 */
import { toolIsOpen, toolStatus, type ToolFacts } from './supplier-store';
import { SHAREABLE_TOOLS, type ShareableTool } from './chat-tool-share';

export type ShareableRead = { tools: ShareableTool[]; unread: boolean };

export function shareableTools(f: ToolFacts): ShareableRead {
  const tools: ShareableTool[] = [];
  let unread = false;
  for (const k of SHAREABLE_TOOLS) {
    const s = toolStatus(k, f);
    if (s.kind === 'unread') unread = true;
    else if (toolIsOpen(s)) tools.push(k);
  }
  return { tools, unread };
}
