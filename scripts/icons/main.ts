import styles from "./icons.module.css";

interface Tile {
  char: string;
  lie: number;
}

interface Art {
  /** Tile edge as a fraction of the canvas. */
  tile: number;
  rows: Tile[][];
}

const ART: Record<string, Art> = {
  reduce: {
    tile: 0.72,
    rows: [[{ char: "r", lie: -5 }]],
  },
  "444dle": {
    tile: 0.4,
    rows: [
      [
        { char: "4", lie: -7 },
        { char: "4", lie: 4 },
      ],
      [{ char: "4", lie: -2 }],
    ],
  },
};

const name = new URLSearchParams(location.search).get("art")!;
const art = ART[name];
if (!art) throw new Error(`No icon art named ${JSON.stringify(name)}`);

const canvas = document.createElement("div");
canvas.className = styles.canvas;
canvas.style.setProperty("--tile-size", `${art.tile * 100}vmin`);

for (const tiles of art.rows) {
  const row = document.createElement("div");
  row.className = styles.row;
  for (const { char, lie } of tiles) {
    const tile = document.createElement("div");
    tile.className = styles.tile;
    tile.style.setProperty("--lie", `${lie}deg`);
    tile.textContent = char;
    row.append(tile);
  }
  canvas.append(row);
}

document.body.append(canvas);
