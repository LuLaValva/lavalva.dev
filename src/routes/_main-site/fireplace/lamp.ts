/// <reference types="web-bluetooth" />
import type { Compiled } from "./expr";

// The "Fake Fire" BLE lamp. Byte format and quirks: PROTOCOL.md.
const NAME = "Fake Fire";
const SERVICE = "8d96a001-0002-64c2-0001-9acc4838521c";
const STATE_CHAR = "8d96b002-0002-64c2-0001-9acc4838521c";
const STATE_LEN = 20;

export const SEND_MS = 40;

export const supported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth;

// Runtime singleton, outside framework state so re-renders can't reset it.
export const rt = {
  fns: [null, null, null, null] as (Compiled | null)[],
  on: true,
  err: "",
  char: null as BluetoothRemoteGATTCharacteristic | null,
  bytes: [] as number[],
  clock: { t: 0, last: 0, sent: 0 },
  inFlight: { busy: false, again: false },
};

// GATT rejects overlapping operations; writes queue latest-wins.
function send() {
  const char = rt.char;
  if (!char || rt.bytes.length !== STATE_LEN) return;
  if (rt.inFlight.busy) {
    rt.inFlight.again = true;
    return;
  }
  rt.inFlight.busy = true;
  (async () => {
    do {
      rt.inFlight.again = false;
      const buf = Uint8Array.from(rt.bytes).buffer as ArrayBuffer;
      try {
        await (char.properties.writeWithoutResponse
          ? char.writeValueWithoutResponse(buf)
          : char.writeValueWithResponse(buf));
        rt.err = "";
      } catch (e: unknown) {
        rt.err = String(e);
      }
    } while (rt.inFlight.again);
    rt.inFlight.busy = false;
  })();
}

export function setBytes(edits: [number, number][]) {
  for (const [i, v] of edits) rt.bytes[i] = v;
  send();
}

export function tick(): number[] {
  const now = performance.now();
  const dt = Math.min(100, now - rt.clock.last);
  rt.clock.last = now;
  rt.clock.t += dt / SEND_MS;
  const rgbw = rt.fns.map((f) => {
    const v = f ? f(rt.clock.t) : 0;
    return Number.isFinite(v)
      ? Math.round(Math.max(0, Math.min(1, v)) * 255)
      : 0;
  });
  // -5ms so ticks spaced exactly SEND_MS apart survive jitter
  if (rt.char && rt.on && now - rt.clock.sent >= SEND_MS - 5) {
    rt.clock.sent = now;
    const [r, g, b, w] = rgbw;
    setBytes([
      [0, 0],
      [1, r],
      [2, g],
      [3, b],
      [4, w],
    ]);
  }
  return rgbw;
}

// Worker timers keep firing in hidden tabs; rAF and page timers don't.
export function metronome(onTick: (rgbw: number[]) => void) {
  const worker = new Worker(
    URL.createObjectURL(
      new Blob([`setInterval(() => postMessage(0), ${SEND_MS})`], {
        type: "text/javascript",
      }),
    ),
  );
  worker.onmessage = () => onTick(tick());
  return () => worker.terminate();
}

let wanted = false;

async function attach(device: BluetoothDevice) {
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(SERVICE);
  const char = await service.getCharacteristic(STATE_CHAR);
  const state = await char.readValue();
  rt.bytes = [
    ...new Uint8Array(state.buffer, state.byteOffset, state.byteLength),
  ];
  rt.char = char;
}

type OnChange = (device: BluetoothDevice | null) => void;

// The lamp drops connections freely; reattach until disconnect().
function hold(device: BluetoothDevice, onChange: OnChange) {
  device.addEventListener(
    "gattserverdisconnected",
    async () => {
      onChange(null);
      rt.char = null;
      for (let tries = 0; wanted && tries < 5; tries++) {
        try {
          await attach(device);
          hold(device, onChange);
          return;
        } catch (e: unknown) {
          rt.err = `reconnecting… (${String(e)})`;
          await new Promise((r) => setTimeout(r, 1000 * (tries + 1)));
        }
      }
      wanted = false;
    },
    { once: true },
  );
  wanted = true;
  rt.err = "";
  onChange(device);
}

// Chooser-free reattach to an already-granted lamp; needs no gesture.
export async function reconnect(onChange: OnChange) {
  try {
    const known = (await navigator.bluetooth.getDevices?.()) ?? [];
    const device = known.find((d) => d.name === NAME);
    if (!device) return false;
    await Promise.race([
      attach(device),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 4000),
      ),
    ]).catch((e) => {
      device.gatt?.disconnect();
      throw e;
    });
    hold(device, onChange);
    return true;
  } catch {
    return false;
  }
}

export async function connect(onChange: OnChange) {
  if (await reconnect(onChange)) return;
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: NAME }, { services: [SERVICE] }],
    optionalServices: [SERVICE],
  });
  await attach(device);
  hold(device, onChange);
}

export function disconnect(device: BluetoothDevice) {
  wanted = false;
  rt.char = null;
  device.gatt?.disconnect();
}
