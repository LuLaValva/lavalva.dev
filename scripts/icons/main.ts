import styles from "./icons.module.css";

interface Tile {
  char: string;
  /** Degrees clockwise. */
  tilt: number;
  /** Offset from the centre of the canvas, as a fraction of one tile. */
  x: number;
  y: number;
}

interface Art {
  /** Tile edge, as a fraction of the canvas. */
  tile: number;
  tiles: Tile[];
}

const ART: Record<string, Art> = {
  reduce: {
    tile: 0.72,
    tiles: [{ char: "r", tilt: -5, x: 0, y: 0 }],
  },
  "444dle": {
    tile: 0.37,
    tiles: [
      { char: "4", tilt: -6, x: -0.62, y: -0.6 },
      { char: "4", tilt: 0, x: 0.66, y: -0.46 },
      { char: "4", tilt: 4, x: -0.15, y: 0.62 },
    ],
  },
};

const parameters = new URLSearchParams(location.search);
const name = parameters.get("art")!;
const art = ART[name];
if (!art) throw new Error(`No icon art named ${JSON.stringify(name)}`);

const tiles = art.tiles.map(({ char, tilt, x, y }) => {
  const tile = document.createElement("div");
  tile.className = styles.tile;
  tile.style.setProperty("--tilt", `${tilt}deg`);
  tile.style.setProperty("--x", `${x}`);
  tile.style.setProperty("--y", `${y}`);
  tile.textContent = char;
  return tile;
});

const canvas = document.createElement("div");
canvas.className = styles.canvas;
canvas.style.setProperty("--tile-size", `${art.tile * 100}vmin`);
canvas.append(...tiles);
document.body.append(canvas);

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
