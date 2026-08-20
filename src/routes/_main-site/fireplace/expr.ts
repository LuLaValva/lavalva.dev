// The fireplace expression language: each lamp channel (r, g, b, w) is one
// arithmetic expression evaluated every frame to a 0–255 value.
//
//   variables   t                      current frame (25 per second)
//   functions   sin(x) cos(x) tan(x)   radians
//               noise(value, type = perlin, seed = 0)
//                 perlin — smooth wandering noise in [0, 1] over `value`
//                 white  — a random-looking constant in [0, 1] per whole
//                          step of `value`; quantized, good for strobes
//   operators   + - * / % ^ ( )        ^ is exponentiation, right-assoc
//
// Expressions compile to plain closures once per edit — no eval, and a
// parse error surfaces immediately instead of at frame time.

export type Compiled = (t: number) => number;

function hash(n: number, seed: number) {
  const s = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function perlin(seed: number, v: number) {
  const smooth = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
  };
  return 0.65 * smooth(v) + 0.35 * smooth(v * 2.7 + 31);
}

const NOISE: Record<string, (seed: number, v: number) => number> = {
  perlin,
  white: (seed, v) => hash(Math.floor(v), seed),
};

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

interface Token {
  kind: "num" | "ident" | "op";
  text: string;
  at: number;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([a-zA-Z_]\w*)|([-+*/%^(),]))/y;
  let last = 0;
  for (let m; (m = re.exec(src)); last = re.lastIndex) {
    tokens.push({
      kind: m[1] ? "num" : m[2] ? "ident" : "op",
      text: m[1] ?? m[2] ?? m[3],
      at: m.index,
    });
  }
  if (src.slice(last).trim()) {
    throw new Error(`unexpected character "${src.slice(last).trim()[0]}"`);
  }
  return tokens;
}

export function compile(src: string): Compiled {
  if (!src.trim()) throw new Error("empty expression");
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const takeOp = (...ops: string[]) => {
    const tk = tokens[pos];
    if (tk?.kind === "op" && ops.includes(tk.text)) {
      pos++;
      return tk.text;
    }
    return null;
  };
  const expectOp = (op: string) => {
    if (!takeOp(op)) {
      throw new Error(
        `expected "${op}"${peek() ? ` before "${peek().text}"` : ""}`,
      );
    }
  };

  function expr(): Compiled {
    let left = term();
    for (let op; (op = takeOp("+", "-")); ) {
      const l = left;
      const r = term();
      left = op === "+" ? (t) => l(t) + r(t) : (t) => l(t) - r(t);
    }
    return left;
  }

  function term(): Compiled {
    let left = factor();
    for (let op; (op = takeOp("*", "/", "%")); ) {
      const l = left;
      const r = factor();
      left =
        op === "*"
          ? (t) => l(t) * r(t)
          : op === "/"
            ? (t) => l(t) / r(t)
            : (t) => l(t) % r(t);
    }
    return left;
  }

  function factor(): Compiled {
    if (takeOp("-")) {
      const operand = factor();
      return (t) => -operand(t);
    }
    const base = primary();
    if (takeOp("^")) {
      const exp = factor();
      return (t) => Math.pow(base(t), exp(t));
    }
    return base;
  }

  function primary(): Compiled {
    const tk = tokens[pos];
    if (!tk) throw new Error("unexpected end of expression");
    if (tk.kind === "num") {
      pos++;
      const n = parseFloat(tk.text);
      return () => n;
    }
    if (tk.kind === "op" && tk.text === "(") {
      pos++;
      const inner = expr();
      expectOp(")");
      return inner;
    }
    if (tk.kind === "ident") {
      pos++;
      if (tk.text === "t") return (t) => t;
      const fn = FUNCS[tk.text];
      if (fn) {
        expectOp("(");
        const arg = expr();
        expectOp(")");
        return (t) => fn(arg(t));
      }
      if (tk.text === "noise") {
        expectOp("(");
        const value = expr();
        let kind = NOISE.perlin;
        let seed: Compiled = () => 0;
        if (takeOp(",")) {
          const name = tokens[pos];
          if (name?.kind !== "ident" || !NOISE[name.text]) {
            throw new Error(
              `noise type must be ${Object.keys(NOISE).join(" or ")}`,
            );
          }
          pos++;
          kind = NOISE[name.text];
          if (takeOp(",")) seed = expr();
        }
        expectOp(")");
        return (t) => kind(seed(t), value(t));
      }
      throw new Error(`unknown name "${tk.text}"`);
    }
    throw new Error(`unexpected "${tk.text}"`);
  }

  const compiled = expr();
  if (pos < tokens.length) {
    throw new Error(`unexpected "${tokens[pos].text}"`);
  }
  return compiled;
}
