// Color spaces for the expression editor. The lamp itself is always RGBW;
// a space defines what the three color channels mean and how to convert
// them (plus the pass-through white channel) to rgbw, all values 0..1.
// URL keys for channels must be unique across spaces, since only the
// active space's keys are kept in the URL.

import { HSLW_PRESETS, PRESETS, type Preset } from "./presets";

export interface Space {
  label: string;
  presets: Preset[];
  toRGBW(values: number[]): [number, number, number, number];
}

const wrap = (x: number) => ((x % 1) + 1) % 1;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export const SPACES = {
  rgbw: {
    label: "RGB",
    presets: PRESETS,
    toRGBW: ([r, g, b, w]) => [r, g, b, w],
  },
  hslw: {
    label: "HSL",
    presets: HSLW_PRESETS,
    // hue in turns (0..1, wrapping), saturation and lightness clamped
    toRGBW: ([h, s, l, w]) => {
      const hue = wrap(h) * 12;
      const sat = clamp(s);
      const li = clamp(l);
      const a = sat * Math.min(li, 1 - li);
      const f = (n: number) => {
        const k = (n + hue) % 12;
        return li - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      };
      return [f(0), f(8), f(4), w];
    },
  },
} satisfies Record<string, Space>;

export type SpaceId = keyof typeof SPACES;
