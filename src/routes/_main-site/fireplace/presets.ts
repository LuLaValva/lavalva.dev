export interface Preset {
  name: string;
  // three color channels in the space's own terms, then the white channel
  channels: [string, string, string, w: string];
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

export const HSLW_PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: [
      "0.02 + 0.04 * noise(t/13)",
      "1",
      "0.15 + 0.2 * noise(t/13) + 0.05 * noise(t/2)",
      "noise(t/13) / 10 + 0.05",
    ],
  },
  {
    name: "Rainbow",
    channels: ["t/150", "1", "0.35", "0"],
  },
  {
    name: "Ocean",
    channels: [
      "0.55 + 0.05 * sin(t/40)",
      "0.8",
      "0.25 + 0.15 * noise(t/25)",
      "0",
    ],
  },
  {
    name: "Music Hue",
    channels: ["m / 2", "1", "0.5 * m^2", "0"],
  },
];

export const HWB_PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: [
      "0.02 + 0.04 * noise(t/13)",
      "0.05",
      "0.3 - 0.25 * noise(t/13)",
      "noise(t/13) / 10 + 0.05",
    ],
  },
  {
    name: "Rainbow",
    channels: ["t/150", "0", "0", "0"],
  },
  {
    name: "Music Flash",
    channels: ["m / 2", "0.2 * m", "1 - m", "0"],
  },
];

export const OKLCH_PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: [
      "0.4 + 0.25 * noise(t/13)",
      "0.55",
      "0.09 + 0.02 * noise(t/13)",
      "noise(t/13) / 10 + 0.05",
    ],
  },
  {
    name: "Rainbow",
    channels: ["0.7", "0.8", "t/150", "0"],
  },
  {
    name: "Breathe",
    channels: ["0.45 + 0.25 * sin(t/60)", "0.4", "0.65", "0"],
  },
  {
    name: "Music Glow",
    channels: ["0.75 * m", "1", "0.9 + m / 4", "0"],
  },
];

export const OKLAB_PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: [
      "0.4 + 0.25 * noise(t/13)",
      "0.85",
      "0.8",
      "noise(t/13) / 10 + 0.05",
    ],
  },
  {
    name: "Drift",
    channels: ["0.6", "0.5 + 0.45 * sin(t/45)", "0.5 + 0.45 * cos(t/45)", "0"],
  },
  {
    name: "Music Pulse",
    channels: ["0.7 * m^2", "0.5 + m / 2", "0.6", "0"],
  },
];

export const LCH_PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: [
      "0.35 + 0.2 * noise(t/13)",
      "0.7",
      "0.12 + 0.02 * noise(t/13)",
      "noise(t/13) / 10 + 0.05",
    ],
  },
  {
    name: "Rainbow",
    channels: ["0.65", "0.9", "t/150", "0"],
  },
];

export const LAB_PRESETS: Preset[] = [
  {
    name: "Fire",
    channels: [
      "0.35 + 0.2 * noise(t/13)",
      "0.75",
      "0.78",
      "noise(t/13) / 10 + 0.05",
    ],
  },
  {
    name: "Drift",
    channels: ["0.55", "0.5 + 0.45 * sin(t/45)", "0.5 + 0.45 * cos(t/45)", "0"],
  },
];
