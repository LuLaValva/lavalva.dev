// Preloaded programs: one expression per channel, mapped from 0–1.
// See expr.ts for the language. `t` advances 25 per second.

export interface Preset {
  name: string;
  channels: [r: string, g: string, b: string, w: string];
}

export const PRESETS: Preset[] = [
  {
    name: "Hearth",
    channels: [
      "0.63 + 0.35 * noise(t/6)",
      "0.08 + 0.24 * noise(t/6)^2",
      "0",
      "0.02 + 0.06 * noise(t/6)",
    ],
  },
  {
    name: "Breathe",
    channels: ["0", "0.16 + 0.14 * sin(t/40)", "0.51 + 0.47 * sin(t/40)", "0"],
  },
  {
    name: "Disco",
    channels: [
      "noise(t/12, white, 1)",
      "noise(t/12, white, 2)",
      "noise(t/12, white, 3)",
      "0",
    ],
  },
  {
    name: "Plasma",
    channels: [
      "0.59 + 0.39 * sin(t/50 + noise(t/60, perlin, 4) * 3)",
      "0.24 + 0.24 * sin(t/50 + 2)",
      "0.35 + 0.31 * sin(t/33)",
      "0",
    ],
  },
];
