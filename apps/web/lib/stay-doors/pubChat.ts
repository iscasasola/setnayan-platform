/** Chat — the thread's ⋮ menu (Archive · Report · Block) and the inbox rows' archive toggle (`lib/chat-actions.ts`),
 *  shared by the couple's and the supplier's Messages. */
export const PUB_CHAT_STAY_DOORS = [
  'pubChat.archiveThread',
  'pubChat.unarchiveThread',
  'pubChat.blockUser',
  'pubChat.unblockUser',
  'pubChat.reportUser',
] as const;
export type PubChatStayDoor = (typeof PUB_CHAT_STAY_DOORS)[number];
