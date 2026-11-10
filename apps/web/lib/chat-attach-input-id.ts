/**
 * The composer's own file input id — the ＋ tools sheet's "Attach" row clicks it inside the tap (a phone only opens
 * a file picker from a user gesture). A plain module, not the 'use client' sheet: the thread page and the chat lab
 * are server files, and a server file must never take a value from a client module
 * (lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts).
 */
export const CHAT_ATTACH_INPUT_ID = 'thread-attach-input';

/**
 * 📷 · 🖼 The composer's camera and photo inputs (v8.3, approved 9 Nov: the composer is (+) · 🔒 · box · Send — camera and
 * photo live INSIDE the (+)). The sheet's Camera / Photo rows click these inside the tap; each hands its file to the ONE
 * `attachment` input, so it rides the same path, limits and compression.
 */
export const CHAT_CAMERA_INPUT_ID = 'thread-camera-input';
export const CHAT_PHOTO_INPUT_ID = 'thread-photo-input';
