// The fireplace esolang: a signal-flow graph sampled once per frame. Every
// wire carries a plain number (colors are just three of them), and the one
// `lamp` node is the program's output. Two deliberate oddities give it its
// flavor:
//
// - **Feedback is legal.** A cycle isn't an error — a wire that closes a loop
//   reads the value its source produced *last frame* (0 on the first frame).
//   Slews, decays, and lava-lamp drift fall out of one `mix` node wired to
//   itself.
// - **Unconnected inputs are knobs.** Every input has a live literal behind
//   it, so partial programs always run.
//
// Inventing new vocabulary = adding an entry to DEFS. The editor renders
// whatever is registered; nothing else needs to change.

export interface NodeDef {
  label: string;
  // doc shows in the editor's add-node picker and node tooltips.
  doc: string;
  inputs: { name: string; def: number }[];
  outputs: string[];
  // Stateful nodes (oscillator phase, sample-and-hold…) scribble on `state`,
  // which persists across frames per node instance.
  eval(
    ins: number[],
    ctx: { t: number; dt: number },
    state: Record<string, number>,
  ): number[];
}

export interface GraphNode {
  id: number;
  type: string;
  x: number;
  y: number;
  // Literal per input, used while that input has no wire.
  params: number[];
}

export interface Edge {
  from: [node: number, output: number];
  to: [node: number, input: number];
}

export interface Graph {
  nodes: GraphNode[];
  edges: Edge[];
}

const TAU = Math.PI * 2;

// Deterministic smooth value noise in [0, 1].
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(t: number, seed: number) {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash(i + seed * 1000) * (1 - u) + hash(i + 1 + seed * 1000) * u;
}

// Advance a phase accumulator so frequency changes never jump the phase.
function phase(state: Record<string, number>, dt: number, freq: number) {
  return (state.ph = ((state.ph ?? 0) + dt * freq) % 1e6);
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + ((h % 1) + 1) * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export const DEFS: Record<string, NodeDef> = {
  time: {
    label: "time",
    doc: "seconds since the program started",
    inputs: [],
    outputs: ["t"],
    eval: (_, c) => [c.t],
  },
  knob: {
    label: "knob",
    doc: "a named constant — the identity node",
    inputs: [{ name: "value", def: 0.5 }],
    outputs: ["out"],
    eval: (i) => [i[0]],
  },
  sine: {
    label: "sine",
    doc: "0–1 sine oscillator",
    inputs: [{ name: "freq", def: 0.2 }],
    outputs: ["out"],
    eval: (i, c, s) => [0.5 + 0.5 * Math.sin(TAU * phase(s, c.dt, i[0]))],
  },
  pulse: {
    label: "pulse",
    doc: "square wave; duty sets the on fraction",
    inputs: [
      { name: "freq", def: 1 },
      { name: "duty", def: 0.5 },
    ],
    outputs: ["out"],
    eval: (i, c, s) => [phase(s, c.dt, i[0]) % 1 < i[1] ? 1 : 0],
  },
  noise: {
    label: "noise",
    doc: "smooth wandering value, flame-shaped at freq ≈ 3",
    inputs: [
      { name: "freq", def: 3 },
      { name: "seed", def: 0 },
    ],
    outputs: ["out"],
    eval: (i, c, s) => {
      const p = phase(s, c.dt, i[0]);
      return [0.65 * noise(p, i[1]) + 0.35 * noise(p * 2.7, i[1] + 7)];
    },
  },
  add: {
    label: "＋",
    doc: "a + b",
    inputs: [
      { name: "a", def: 0 },
      { name: "b", def: 0 },
    ],
    outputs: ["out"],
    eval: (i) => [i[0] + i[1]],
  },
  mul: {
    label: "×",
    doc: "a × b",
    inputs: [
      { name: "a", def: 1 },
      { name: "b", def: 1 },
    ],
    outputs: ["out"],
    eval: (i) => [i[0] * i[1]],
  },
  fold: {
    label: "fold",
    doc: "wrap any number back into 0–1 as a triangle",
    inputs: [{ name: "in", def: 0 }],
    outputs: ["out"],
    eval: (i) => {
      const x = Math.abs(i[0]) % 2;
      return [x > 1 ? 2 - x : x];
    },
  },
  step: {
    label: "step",
    doc: "0 below the threshold, 1 at or above",
    inputs: [
      { name: "in", def: 0 },
      { name: "at", def: 0.5 },
    ],
    outputs: ["out"],
    eval: (i) => [i[0] >= i[1] ? 1 : 0],
  },
  mix: {
    label: "mix",
    doc: "blend a→b by t; wire out back into a for feedback",
    inputs: [
      { name: "a", def: 0 },
      { name: "b", def: 1 },
      { name: "t", def: 0.5 },
    ],
    outputs: ["out"],
    eval: (i) => [i[0] + (i[1] - i[0]) * i[2]],
  },
  hold: {
    label: "hold",
    doc: "sample-and-hold: captures `in` when `trig` rises past 0.5",
    inputs: [
      { name: "in", def: 0 },
      { name: "trig", def: 0 },
    ],
    outputs: ["out"],
    eval: (i, _, s) => {
      if (i[1] >= 0.5 && (s.last ?? 0) < 0.5) s.held = i[0];
      s.last = i[1];
      return [s.held ?? i[0]];
    },
  },
  hsv: {
    label: "hsv",
    doc: "hue/sat/val → red/green/blue (hue wraps)",
    inputs: [
      { name: "h", def: 0 },
      { name: "s", def: 1 },
      { name: "v", def: 1 },
    ],
    outputs: ["r", "g", "b"],
    eval: (i) => hsv(i[0], i[1], i[2]),
  },
  lamp: {
    label: "lamp",
    doc: "the program's output — 0–1 per channel; w is the bright white LED",
    inputs: [
      { name: "r", def: 0 },
      { name: "g", def: 0 },
      { name: "b", def: 0 },
      { name: "w", def: 0 },
    ],
    outputs: [],
    eval: (i) => i,
  },
};

// Cross-frame evaluation memory: `prev` feeds feedback loops, `state` is the
// per-node scratch space. Keep one per running program.
export interface Memory {
  prev: Map<string, number>;
  state: Map<number, Record<string, number>>;
}
export const freshMemory = (): Memory => ({
  prev: new Map(),
  state: new Map(),
});

// One frame: returns the lamp node's four inputs as 0–1 RGBW.
export function evalGraph(
  graph: Graph,
  ctx: { t: number; dt: number },
  mem: Memory,
): [number, number, number, number] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const wireTo = new Map<string, Edge["from"]>();
  for (const e of graph.edges) wireTo.set(e.to.join(":"), e.from);

  const cur = new Map<string, number>();
  const visiting = new Set<number>();

  function readPort(from: Edge["from"]): number {
    const key = from.join(":");
    if (!cur.has(key)) {
      const node = byId.get(from[0]);
      // A dangling edge or a cycle both fall back to last frame's value.
      if (!node || visiting.has(from[0])) return mem.prev.get(key) ?? 0;
      evalNode(node);
    }
    return cur.get(key) ?? 0;
  }

  function readInput(node: GraphNode, input: number): number {
    const wire = wireTo.get(`${node.id}:${input}`);
    if (wire) return readPort(wire);
    return node.params[input] ?? DEFS[node.type].inputs[input].def;
  }

  function evalNode(node: GraphNode) {
    visiting.add(node.id);
    const def = DEFS[node.type];
    const ins = def.inputs.map((_, i) => readInput(node, i));
    let state = mem.state.get(node.id);
    if (!state) mem.state.set(node.id, (state = {}));
    const outs = def.eval(ins, ctx, state);
    outs.forEach((v, i) => cur.set(`${node.id}:${i}`, v));
    visiting.delete(node.id);
  }

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n || 0));
  const lamp = graph.nodes.find((n) => n.type === "lamp");
  const rgbw = lamp
    ? ([0, 1, 2, 3].map((i) => clamp01(readInput(lamp, i))) as [
        number,
        number,
        number,
        number,
      ])
    : ([0, 0, 0, 0] as [number, number, number, number]);
  mem.prev = cur;
  return rgbw;
}

export const nextId = (graph: Graph) =>
  graph.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
