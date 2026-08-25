export interface Preset {
  name: string;
  channels: [r: string, g: string, b: string, w: string];
}

export const PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: ["1", "0.2", "0", "noise(t/13) + noise(t/2) / 10 + 0.05"],
  },
  {
    name: "Color Fire",
    channels: [
      "noise(t/13) + noise(t/2) / 5 + 0.1",
      "noise(t/13) / 5 + noise(t/2, perlin, 1) / 5 + 0.05",
      "0",
      "0",
    ],
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
