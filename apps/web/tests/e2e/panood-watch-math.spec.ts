import { test, expect } from '@playwright/test';
import {
  parseYouTubeVideoId,
  normalizeYouTubeWatchUrl,
  youTubeEmbedUrl,
  isYouTubeVideoId,
} from '../../lib/panood-watch';

/**
 * Pure-logic spec for the Panood watch-URL parser (no page/server — same
 * pattern as spatial-backdrop-math.spec.ts). This value renders inside an
 * iframe on the PUBLIC wedding page, so normalize-or-reject is the injection
 * barrier — the reject cases here are the security contract.
 */

const ID = 'dQw4w9WgXcQ';

test.describe('panood watch-url parsing', () => {
  test('accepts every common YouTube URL shape', () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=share-junk`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube.com/live/${ID}?feature=share`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `youtube.com/watch?v=${ID}`,
      `youtu.be/${ID}`,
      `http://www.youtube.com/watch?v=${ID}`,
    ]) {
      expect(parseYouTubeVideoId(url), url).toBe(ID);
    }
  });

  test('rejects non-YouTube and malformed input', () => {
    for (const url of [
      '',
      '   ',
      'not a url at all',
      'https://vimeo.com/12345678',
      'https://evil.com/watch?v=' + ID,
      `https://youtube.com.evil.com/watch?v=${ID}`,
      'https://www.youtube.com/watch?v=tooshort',
      'https://www.youtube.com/watch?v=waytoolongid12345',
      'https://www.youtube.com/playlist?list=PL123456',
      'https://www.youtube.com/@somechannel',
      `javascript:alert(1)//watch?v=${ID}`,
      `ftp://youtube.com/watch?v=${ID}`,
    ]) {
      expect(parseYouTubeVideoId(url), url).toBeNull();
    }
  });

  test('normalize produces the canonical https watch URL or null', () => {
    expect(normalizeYouTubeWatchUrl(`youtu.be/${ID}?si=x`)).toBe(
      `https://www.youtube.com/watch?v=${ID}`,
    );
    expect(normalizeYouTubeWatchUrl('https://vimeo.com/123')).toBeNull();
  });

  test('embed URL is the nocookie host and only accepts a valid id', () => {
    expect(youTubeEmbedUrl(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    );
    expect(() => youTubeEmbedUrl('"><script>' as string)).toThrow();
    expect(isYouTubeVideoId(ID)).toBe(true);
    expect(isYouTubeVideoId('nope')).toBe(false);
  });
});
