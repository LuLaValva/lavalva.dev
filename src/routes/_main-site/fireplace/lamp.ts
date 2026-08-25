/// <reference types="web-bluetooth" />
import type { Compiled } from "./expr";

// The "Fake Fire" lamp: UUIDs are fixed in firmware, the 20-byte state
// packet and its quirks are documented in PROTOCOL.md. Its built-in modes
// are ignored — programs stream as solid-color (mode 0) writes to color
// slot 1, and mode 3/4 is the power toggle.
const SERVICE = "8d96a001-0002-64c2-0001-9acc4838521c";
const STATE_CHAR = "8d96b002-0002-64c2-0001-9acc4838521c";
const STATE_LEN = 20;

export const SEND_MS = 40;

export const supported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth;

// Everything both event loops touch lives in this module-scope singleton,
// outside any framework state, so a re-render can never reset a running
// program.
export const rt = {
  fns: [null, null, null, null] as (Compiled | null)[],
  on: true,
  err: "",
  char: null as BluetoothRemoteGATTCharacteristic | null,
  bytes: [] as number[],
  clock: { t: 0, last: 0, sent: 0 },
  inFlight: { busy: false, again: false },
};

// GATT rejects overlapping operations, so writes queue latest-wins: at most
// one in flight, and edits made meanwhile collapse into a single follow-up.
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

// One interpreter step. `t` counts frames (one per SEND_MS) from wall-clock
// deltas, clamped so a gap between steps can't fast-forward the program;
// channels evaluate in 0-1 and map to bytes here.
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
  // -5ms margin so metronome ticks spaced exactly SEND_MS apart don't lose
  // every other frame to jitter.
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

// The one event loop, visible or not: rAF stops and page timers throttle
// to ~1/minute in a hidden tab, but timers in a dedicated worker don't.
// Bluetooth isn't exposed in workers, so the worker is a bare metronome
// ticking the main thread. Returns a stop.
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

// The lamp allows one central at a time and drops connections freely, so
// hold it like a regular paired device: reattach with backoff until
// disconnect() is called. onChange reports the connected device or null.
export async function connect(
  onChange: (device: BluetoothDevice | null) => void,
) {
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERVICE],
  });
  device.addEventListener("gattserverdisconnected", async () => {
    onChange(null);
    rt.char = null;
    for (let tries = 0; wanted && tries < 5; tries++) {
      try {
        await attach(device);
        rt.err = "";
        onChange(device);
        return;
      } catch (e: unknown) {
        rt.err = `reconnecting… (${String(e)})`;
        await new Promise((r) => setTimeout(r, 1000 * (tries + 1)));
      }
    }
    wanted = false;
  });
  await attach(device);
  wanted = true;
  rt.err = "";
  onChange(device);
}

export function disconnect(device: BluetoothDevice) {
  wanted = false;
  rt.char = null;
  device.gatt?.disconnect();
}
