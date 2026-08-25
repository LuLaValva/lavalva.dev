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
      "0.1 + 0.1 * noise(t/6)",
    ],
  },
  {
    name: "Embers",
    channels: ["0.2 + 0.6 * noise(t/40)^2", "0.03 * noise(t/40)", "0", "0"],
  },
  {
    name: "Ocean",
    channels: ["0", "noise(t/30) / 3", "0.4 + 0.5 * sin(t/60)", "0"],
  },
  {
    name: "Aurora",
    channels: [
      "0",
      "0.3 + 0.4 * noise(t/50)",
      "0.2 + 0.4 * noise(t/50, perlin, 2)",
      "0",
    ],
  },
  {
    name: "Storm",
    channels: ["0", "0", "0.12", "noise(t/6, white, 3)^9"],
  },
  {
    name: "Lava Lamp",
    channels: [
      "0.5 + 0.5 * sin(t/90 + noise(t/70) * 2)",
      "0",
      "0.3 + 0.3 * sin(t/70 + 3)",
      "0",
    ],
  },
  {
    name: "Heartbeat",
    channels: [
      "(0.5 + 0.5 * sin(t/8))^12 + (0.5 + 0.5 * sin(t/8 - 0.9))^12 / 2",
      "0",
      "0",
      "0",
    ],
  },
  {
    name: "Sunset",
    channels: [
      "0.8 + 0.2 * sin(t/120)",
      "0.25 + 0.15 * sin(t/120 + 1)",
      "0.1 + 0.1 * sin(t/120 + 2)",
      "0.05",
    ],
  },
  {
    name: "Moonlight",
    channels: ["0.05", "0.1", "0.35 + 0.1 * noise(t/40)", "0.08"],
  },
  {
    name: "Neon",
    channels: ["0.5 + 0.5 * sin(t/25)", "0.2", "0.5 + 0.5 * cos(t/25)", "0"],
  },
  {
    name: "Police",
    channels: ["(0.5 + 0.5 * sin(t/6))^3", "0", "(0.5 + 0.5 * cos(t/6))^3", "0"],
  },
  {
    name: "TV Static",
    channels: [
      "0.2 * noise(t/2, white, 1)",
      "0.25 * noise(t/2, white, 1)",
      "0.3 + 0.4 * noise(t/2, white, 2)",
      "0.1 * noise(t/2, white, 4)",
    ],
  },
  {
    name: "Candy",
    channels: [
      "0.7 + 0.3 * sin(t/20)",
      "0.1 + 0.1 * sin(t/35)",
      "0.5 + 0.4 * sin(t/15)",
      "0",
    ],
  },
  {
    name: "Forest",
    channels: [
      "0.1 + 0.15 * noise(t/20, perlin, 4)",
      "0.3 + 0.3 * noise(t/30)",
      "0.05",
      "noise(t/8, white, 5)^7 / 3",
    ],
  },
  {
    name: "Golden Hour",
    channels: ["1", "0.55 + 0.1 * noise(t/30)", "0.08", "0.3"],
  },
  {
    name: "Glitch",
    channels: [
      "tan(t/50) % 1",
      "tan(t/50 + 1) % 1",
      "tan(t/50 + 2) % 1",
      "0",
    ],
  },
];
