// Color spaces for the expression editor. The lamp itself is always RGBW;
// a space maps its three color channels to a CSS color string, and the
// browser's CSS engine converts that to sRGB (see cssToRgb in lamp.ts) —
// so any CSS-native space works without hand-written transforms. CSS also
// handles clamping and hue wrapping. White is a separate pass-through
// hardware channel. URL keys for channels must be unique across spaces,
// since only the active space's keys are kept in the URL.

// Every space keeps its expression channels in 0..1: hues are turns
// (wrapping), Lab-style a/b axes are centered on 0.5, and the css()
// template scales to the space's native range.

import {
  HSLW_PRESETS,
  HWB_PRESETS,
  LAB_PRESETS,
  LCH_PRESETS,
  OKLAB_PRESETS,
  OKLCH_PRESETS,
  PRESETS,
  type Preset,
} from "./presets";

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
  hwb: {
    label: "HWB",
    presets: HWB_PRESETS,
    css: ([h, wh, bl]) => `hwb(${h}turn ${wh * 100}% ${bl * 100}%)`,
  },
  oklch: {
    label: "OKLCH",
    presets: OKLCH_PRESETS,
    css: ([l, c, h]) => `oklch(${l} ${c * 0.4} ${h}turn)`,
  },
  oklab: {
    label: "OKLab",
    presets: OKLAB_PRESETS,
    css: ([l, a, b]) => `oklab(${l} ${(a - 0.5) * 0.8} ${(b - 0.5) * 0.8})`,
  },
  lch: {
    label: "LCH",
    presets: LCH_PRESETS,
    css: ([l, c, h]) => `lch(${l * 100} ${c * 150} ${h}turn)`,
  },
  lab: {
    label: "Lab",
    presets: LAB_PRESETS,
    css: ([l, a, b]) => `lab(${l * 100} ${(a - 0.5) * 250} ${(b - 0.5) * 250})`,
  },
} satisfies Record<string, Space>;

export type SpaceId = keyof typeof SPACES;
