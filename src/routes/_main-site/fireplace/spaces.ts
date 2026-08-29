// Color spaces for the expression editor. The lamp itself is always RGBW;
// a space maps its three color channels to a CSS color string, and the
// browser's CSS engine converts that to sRGB (see cssToRgb in lamp.ts) —
// so any CSS-native space works without hand-written transforms. CSS also
// handles clamping and hue wrapping. White is a separate pass-through
// hardware channel. URL keys for channels must be unique across spaces,
// since only the active space's keys are kept in the URL.

import { HSLW_PRESETS, PRESETS, type Preset } from "./presets";

export interface Space {
  label: string;
  presets: Preset[];
  css(values: [number, number, number]): string;
}

export const SPACES = {
  rgbw: {
    label: "RGB",
    presets: PRESETS,
    css: ([r, g, b]) => `rgb(${r * 255} ${g * 255} ${b * 255})`,
  },
  hslw: {
    label: "HSL",
    presets: HSLW_PRESETS,
    // hue in turns (wrapping), saturation and lightness 0..1
    css: ([h, s, l]) => `hsl(${h}turn ${s * 100}% ${l * 100}%)`,
  },
} satisfies Record<string, Space>;

export type SpaceId = keyof typeof SPACES;
