import type { Graph } from "./flow";

// Preloaded programs. Author new ones in the editor, then "copy JSON" and
// paste the graph here. `params` line up with each node type's inputs in
// DEFS; a param is only read while its input has no wire.

export const PRESETS: { name: string; graph: Graph }[] = [
  {
    name: "Hearth",
    graph: {
      nodes: [
        { id: 1, type: "noise", x: 30, y: 60, params: [3, 0] },
        { id: 2, type: "mul", x: 210, y: 30, params: [1, 0.09] },
        { id: 3, type: "mix", x: 210, y: 170, params: [0.35, 1, 0.5] },
        { id: 4, type: "hsv", x: 390, y: 80, params: [0, 1, 1] },
        { id: 5, type: "lamp", x: 570, y: 80, params: [0, 0, 0, 0.04] },
      ],
      edges: [
        { from: [1, 0], to: [2, 0] },
        { from: [1, 0], to: [3, 2] },
        { from: [2, 0], to: [4, 0] },
        { from: [3, 0], to: [4, 2] },
        { from: [4, 0], to: [5, 0] },
        { from: [4, 1], to: [5, 1] },
        { from: [4, 2], to: [5, 2] },
      ],
    },
  },
  {
    name: "Breathe",
    graph: {
      nodes: [
        { id: 1, type: "sine", x: 30, y: 90, params: [0.12] },
        { id: 2, type: "mix", x: 210, y: 90, params: [0.12, 1, 0.5] },
        { id: 3, type: "hsv", x: 390, y: 80, params: [0.62, 0.85, 1] },
        { id: 4, type: "lamp", x: 570, y: 80, params: [0, 0, 0, 0] },
      ],
      edges: [
        { from: [1, 0], to: [2, 2] },
        { from: [2, 0], to: [3, 2] },
        { from: [3, 0], to: [4, 0] },
        { from: [3, 1], to: [4, 1] },
        { from: [3, 2], to: [4, 2] },
      ],
    },
  },
  {
    name: "Disco",
    graph: {
      nodes: [
        { id: 1, type: "noise", x: 30, y: 30, params: [20, 4] },
        { id: 2, type: "pulse", x: 30, y: 170, params: [1.5, 0.5] },
        { id: 3, type: "hold", x: 210, y: 90, params: [0, 0] },
        { id: 4, type: "hsv", x: 390, y: 80, params: [0, 1, 1] },
        { id: 5, type: "lamp", x: 570, y: 80, params: [0, 0, 0, 0] },
      ],
      edges: [
        { from: [1, 0], to: [3, 0] },
        { from: [2, 0], to: [3, 1] },
        { from: [3, 0], to: [4, 0] },
        { from: [4, 0], to: [5, 0] },
        { from: [4, 1], to: [5, 1] },
        { from: [4, 2], to: [5, 2] },
      ],
    },
  },
  {
    // The feedback showpiece: `mix` chases the noise slowly because its own
    // output is wired back into `a` — a one-node low-pass filter.
    name: "Lava (feedback)",
    graph: {
      nodes: [
        { id: 1, type: "noise", x: 30, y: 60, params: [0.8, 2] },
        { id: 2, type: "mix", x: 210, y: 60, params: [0, 1, 0.03] },
        { id: 3, type: "fold", x: 390, y: 40, params: [0] },
        { id: 4, type: "hsv", x: 540, y: 80, params: [0, 0.9, 0.8] },
        { id: 5, type: "lamp", x: 710, y: 80, params: [0, 0, 0, 0] },
      ],
      edges: [
        { from: [1, 0], to: [2, 1] },
        { from: [2, 0], to: [2, 0] },
        { from: [2, 0], to: [3, 0] },
        { from: [3, 0], to: [4, 0] },
        { from: [4, 0], to: [5, 0] },
        { from: [4, 1], to: [5, 1] },
        { from: [4, 2], to: [5, 2] },
      ],
    },
  },
];
