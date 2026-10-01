/**
 * The longest side, in pixels, an uploaded photo keeps after the browser
 * compresses it (`image-compress.ts`). Its own tiny module so a screen can SAY
 * the number ("Best: 2000 pixels or more…") without loading the compressor.
 */
export const IMAGE_MAX_EDGE = 2000;
