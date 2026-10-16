/**
 * The composer's own file input id — the ＋ tools sheet's "Attach" row clicks it inside the tap (a phone only opens
 * a file picker from a user gesture). A plain module, not the 'use client' sheet: the thread page and the chat lab
 * are server files, and a server file must never take a value from a client module
 * (lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts).
 */
export const CHAT_ATTACH_INPUT_ID = 'thread-attach-input';
