// Preloaded programs: one expression per channel, byte range 0–255.
// See expr.ts for the language. `t` advances 25 per second.

export interface Preset {
  name: string;
  channels: [r: string, g: string, b: string, w: string];
}

export const PRESETS: Preset[] = [
  {
    name: "Hearth",
    channels: [
      "160 + 90 * noise(t/6)",
      "20 + 60 * noise(t/6)^2",
      "0",
      "5 + 15 * noise(t/6)",
    ],
  },
  {
    name: "Breathe",
    channels: ["0", "40 + 35 * sin(t/40)", "130 + 120 * sin(t/40)", "0"],
  },
  {
    name: "Disco",
    channels: [
      "255 * noise(t/12, white, 1)",
      "255 * noise(t/12, white, 2)",
      "255 * noise(t/12, white, 3)",
      "0",
    ],
  },
  {
    name: "Plasma",
    channels: [
      "150 + 100 * sin(t/50 + noise(t/60, perlin, 4) * 3)",
      "60 + 60 * sin(t/50 + 2)",
      "90 + 80 * sin(t/33)",
      "0",
    ],
  },
];
