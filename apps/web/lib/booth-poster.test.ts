import { describe, expect, it } from 'vitest';
import {
  POSTER_ASPECT_TOLERANCE,
  POSTER_MASTER_H,
  POSTER_MASTER_W,
  POSTER_MIN_W,
  posterAspectError,
  posterSizeError,
} from './booth-poster';

describe('posterAspectError', () => {
  it('accepts the exact master size', () => {
    expect(posterAspectError(POSTER_MASTER_W, POSTER_MASTER_H)).toBeNull();
  });

  it('accepts common 2:3 exports at other resolutions', () => {
    expect(posterAspectError(1000, 1500)).toBeNull();
    expect(posterAspectError(1080, 1620)).toBeNull();
    expect(posterAspectError(2048, 3072)).toBeNull();
  });

  it('accepts drift inside the tolerance band', () => {
    // 1% narrow — a rounding-scale export, not a different shape.
    const h = 1500;
    const w = Math.round(h * (2 / 3) * (1 + POSTER_ASPECT_TOLERANCE / 2));
    expect(posterAspectError(w, h)).toBeNull();
  });

  it('rejects landscape, square and 4:3', () => {
    expect(posterAspectError(1536, 1024)).not.toBeNull();
    expect(posterAspectError(1024, 1024)).not.toBeNull();
    expect(posterAspectError(1024, 768)).not.toBeNull();
  });

  it('rejects a too-tall portrait (pull-up banner 1:2)', () => {
    expect(posterAspectError(1024, 2048)).not.toBeNull();
  });

  it('names the actual dimensions so the vendor can fix the artwork', () => {
    expect(posterAspectError(1024, 1024)).toContain('1024x1024');
  });

  it('fails OPEN on unreadable dimensions — a validator must never brick upload', () => {
    expect(posterAspectError(0, 0)).toBeNull();
    expect(posterAspectError(Number.NaN, 1500)).toBeNull();
    expect(posterAspectError(-1, -1)).toBeNull();
  });
});

describe('posterSizeError', () => {
  it('accepts the master size and larger', () => {
    expect(posterSizeError(POSTER_MASTER_W, POSTER_MASTER_H)).toBeNull();
    expect(posterSizeError(2048, 3072)).toBeNull();
  });

  it('accepts exactly the floor', () => {
    expect(posterSizeError(POSTER_MIN_W, POSTER_MIN_W * 1.5)).toBeNull();
  });

  it('rejects below the floor', () => {
    expect(posterSizeError(POSTER_MIN_W - 1, (POSTER_MIN_W - 1) * 1.5)).not.toBeNull();
  });

  it('fails open on unreadable width', () => {
    expect(posterSizeError(0, 0)).toBeNull();
    expect(posterSizeError(Number.NaN, 1500)).toBeNull();
  });
});
