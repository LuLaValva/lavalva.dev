export interface Preset {
  name: string;
  channels: [r: string, g: string, b: string, w: string];
}

export const PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: ["1", "0", "0", "noise(t/13) + noise(t/2) / 10 + 0.05"],
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
