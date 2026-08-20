// Color patterns computed in the browser and streamed to the lamp as rapid
// solid-color writes (mode 0, color slot 1 — see PROTOCOL.md). The firmware's
// built-in gradient/flash/strobe modes exist but aren't expressive enough,
// so they're deliberately unused.

export type RGBW = [r: number, g: number, b: number, w: number];

export interface Pattern {
  name: string;
  // t is seconds since the pattern started, already scaled by the user's
  // speed setting. Must be pure in t so pausing/reconnecting can't drift.
  at(t: number): RGBW;
}

// Deterministic smooth value noise in [0, 1] — patterns need organic flicker
// but staying a pure function of t keeps them scrubbable and testable.
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(t: number, seed = 0) {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash(i + seed * 1000) * (1 - u) + hash(i + 1 + seed * 1000) * u;
}
// Two octaves reads as flame; one octave reads as a slow lava lamp.
function flicker(t: number, seed = 0) {
  return 0.65 * noise(t * 4, seed) + 0.35 * noise(t * 11, seed + 7);
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const rgbw = (r: number, g: number, b: number, w: number): RGBW => [
  clamp255(r),
  clamp255(g),
  clamp255(b),
  clamp255(w),
];

// The white channel overpowers the RGB LEDs above ~0x40 (PROTOCOL.md), so
// patterns treat it as a gentle warm floor, never a full channel.
export const PATTERNS: Pattern[] = [
  {
    name: "Fireplace",
    at(t) {
      const f = flicker(t);
      return rgbw(160 + 95 * f, 25 + 65 * f * f, 0, 6 + 14 * f);
    },
  },
  {
    name: "Candle",
    at(t) {
      const f = 0.7 + 0.3 * flicker(t * 0.6, 3);
      return rgbw(140 * f, 60 * f, 4, 30 * f);
    },
  },
  {
    name: "Embers",
    at(t) {
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.8));
      const f = 0.8 + 0.2 * noise(t * 3, 5);
      return rgbw(180 * pulse * f, 18 * pulse * pulse, 0, 0);
    },
  },
  {
    name: "Ocean",
    at(t) {
      const swell = 0.5 + 0.5 * Math.sin(t * 0.5);
      const g = 40 + 90 * noise(t * 1.5, 9);
      return rgbw(0, g * swell, 120 + 135 * swell, 0);
    },
  },
  {
    name: "Rainbow",
    at(t) {
      const h = (t / 12) % 1;
      const seg = (o: number) => {
        const x = Math.abs(((h + o) % 1) * 6 - 3) - 1;
        return 255 * Math.max(0, Math.min(1, x));
      };
      return rgbw(seg(0), seg(2 / 3), seg(1 / 3), 0);
    },
  },
];
