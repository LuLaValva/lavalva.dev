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

function draw({ char, lie, dx = 0, dy = 0 }: Tile) {
  const tile = document.createElement("div");
  tile.className = styles.tile;
  tile.style.setProperty("--lie", `${lie}deg`);
  tile.style.translate = `${dx * 100}% ${dy * 100}%`;
  tile.textContent = char;
  return tile;
}

const rows = art.rows.map((row) => row.map(draw));

const canvas = document.createElement("div");
canvas.className = styles.canvas;
canvas.style.setProperty("--tile-size", `${art.tile * 100}vmin`);
canvas.style.setProperty("--gap", `calc(var(--tile-size) * ${art.gap ?? 0})`);
canvas.append(
  ...rows.map((row) => {
    const line = document.createElement("div");
    line.className = styles.row;
    line.append(...row);
    return line;
  }),
);

document.body.style.setProperty(
  "--background",
  parameters.get("background") ?? "transparent",
);
document.body.append(canvas);

const tiles = rows.flat();

const safeZone = Number(parameters.get("safe"));

if (parameters.has("hug") || safeZone) {
  // Measured rather than declared, so the art can move without the margin it
  // leaves behind having to be worked out again by hand.
  const boxes = tiles.map((tile) => tile.getBoundingClientRect());
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.right));
  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  // A launcher masks to any shape inside its safe circle, so the mark clears
  // it once the furthest tile does. Tiles are all one size, and every corner
  // of a square sits on the same circle whatever the tile's angle.
  const reach =
    Math.max(
      ...boxes.map((box) =>
        Math.hypot(
          (box.left + box.right) / 2 - midX,
          (box.top + box.bottom) / 2 - midY,
        ),
      ),
    ) +
    tiles[0].offsetWidth * Math.SQRT1_2;
  const scale = safeZone
    ? (safeZone * Math.min(innerWidth, innerHeight)) / 2 / reach
    : Math.min(innerWidth / (right - left), innerHeight / (bottom - top));
  canvas.style.transformOrigin = "0 0";
  canvas.style.transform =
    `translate(${innerWidth / 2 - scale * midX}px, ` +
    `${innerHeight / 2 - scale * midY}px) scale(${scale})`;
}
