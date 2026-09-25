import styles from "./icons.module.css";

interface Tile {
  char: string;
  lie: number;
  /** Nudge off the grid, as a fraction of one tile. */
  dx?: number;
  dy?: number;
}

interface Art {
  /** Tile edge, as a fraction of the canvas. */
  tile: number;
  /** Space between tiles, as a fraction of one tile. */
  gap?: number;
  rows: Tile[][];
}

const ART: Record<string, Art> = {
  reduce: {
    tile: 0.72,
    rows: [[{ char: "r", lie: -5 }]],
  },
  "444dle": {
    tile: 0.37,
    gap: 0.2,
    rows: [
      [
        { char: "4", lie: -6, dx: -0.02 },
        { char: "4", lie: 0, dx: 0.06, dy: 0.14 },
      ],
      [{ char: "4", lie: 4, dx: -0.15, dy: 0.02 }],
    ],
  },
};

const parameters = new URLSearchParams(location.search);
const name = parameters.get("art")!;
const art = ART[name];
if (!art) throw new Error(`No icon art named ${JSON.stringify(name)}`);

const canvas = document.createElement("div");
canvas.className = styles.canvas;
canvas.style.setProperty("--tile-size", `${art.tile * 100}vmin`);
canvas.style.setProperty("--gap", `calc(var(--tile-size) * ${art.gap ?? 0})`);
canvas.style.setProperty(
  "--background",
  parameters.get("background") ?? "transparent",
);

for (const tiles of art.rows) {
  const row = document.createElement("div");
  row.className = styles.row;
  for (const { char, lie, dx, dy } of tiles) {
    const tile = document.createElement("div");
    tile.className = styles.tile;
    tile.style.setProperty("--lie", `${lie}deg`);
    tile.style.translate = `${(dx ?? 0) * 100}% ${(dy ?? 0) * 100}%`;
    tile.textContent = char;
    row.append(tile);
  }
  canvas.append(row);
}

document.body.append(canvas);
