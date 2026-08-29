// t/s/m, sin/cos/tan, noise(value, type = perlin | white, seed = 0), + - * / % ^.
// Compiles to a plain closure; parse errors surface at edit time.
// `uses` records which audio inputs the expression reads, so capture can
// stay off until an expression actually needs it.

export interface Env {
  t: number;
  s: number;
  m: number;
}

export type AudioVar = "s" | "m";

type Fn = (env: Env) => number;

export type Compiled = Fn & { uses: ReadonlySet<AudioVar> };

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
  const uses = new Set<AudioVar>();
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

  function expr(): Fn {
    let left = term();
    for (let op; (op = takeOp("+", "-"));) {
      const l = left;
      const r = term();
      left = op === "+" ? (e) => l(e) + r(e) : (e) => l(e) - r(e);
    }
    return left;
  }

  function term(): Fn {
    let left = factor();
    for (let op; (op = takeOp("*", "/", "%"));) {
      const l = left;
      const r = factor();
      left =
        op === "*"
          ? (e) => l(e) * r(e)
          : op === "/"
            ? (e) => l(e) / r(e)
            : (e) => l(e) % r(e);
    }
    return left;
  }

  function factor(): Fn {
    if (takeOp("-")) {
      const operand = factor();
      return (e) => -operand(e);
    }
    const base = primary();
    if (takeOp("^")) {
      const exp = factor();
      return (e) => Math.pow(base(e), exp(e));
    }
    return base;
  }

  function primary(): Fn {
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
      if (tk.text === "t") return (e) => e.t;
      if (tk.text === "s" || tk.text === "m") {
        const name = tk.text;
        uses.add(name);
        return (e) => e[name];
      }
      const fn = FUNCS[tk.text];
      if (fn) {
        expectOp("(");
        const arg = expr();
        expectOp(")");
        return (e) => fn(arg(e));
      }
      if (tk.text === "noise") {
        expectOp("(");
        const value = expr();
        let kind = NOISE.perlin;
        let seed: Fn = () => 0;
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
        return (e) => kind(seed(e), value(e));
      }
      throw new Error(`unknown name "${tk.text}"`);
    }
    throw new Error(`unexpected "${tk.text}"`);
  }

  const compiled = expr();
  if (pos < tokens.length) {
    throw new Error(`unexpected "${tokens[pos].text}"`);
  }
  return Object.assign(compiled, { uses });
}
