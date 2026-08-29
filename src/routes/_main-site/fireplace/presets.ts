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
  {
    name: "Candle",
    channels: [
      "0.9 + 0.1 * noise(t/4)",
      "0.3 + 0.1 * noise(t/4)",
      "0",
      "0.1 * noise(t/6)",
    ],
  },
  {
    name: "Embers",
    channels: ["0.2 + 0.6 * noise(t/40)^2", "0.03 * noise(t/40)", "0", "0"],
  },
  {
    name: "Neon",
    channels: ["0.5 + 0.5 * sin(t/25)", "0.2", "0.5 + 0.5 * cos(t/25)", "0"],
  },
  {
    name: "Police",
    channels: [
      "(0.5 + 0.5 * sin(t/6))^3",
      "0",
      "(0.5 - 0.5 * sin(t/6))^3",
      "0",
    ],
  },
  {
    name: "Loud Fire",
    channels: ["1", "0.2", "0", "noise(t/13) * s + s^2"],
  },
  {
    name: "Music Pulse",
    channels: ["m^2", "0.05 * m", "m^4", "0"],
  },
  {
    name: "Glitch",
    channels: ["tan(t/50) % 1", "tan(t/50 + 1) % 1", "tan(t/50 + 2) % 1", "0"],
  },
];
