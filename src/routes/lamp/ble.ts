// Web Bluetooth client for generic BLE RGB lamps (the kind the "Colorful Light"
// app talks to). These cheap bulbs/strips ship with no pairing or auth, so once
// you know the GATT service + characteristic + byte format you can drive them
// straight from the browser.
//
// "Colorful Light" is a generic front-end for several different firmwares, so
// there is no single protocol. This module ships presets for the most common
// ones and an inspector so you can figure out which your lamp speaks.

// --- Minimal Web Bluetooth typings -----------------------------------------
// (avoids a dependency on @types/web-bluetooth just for these few surfaces)
type BtUUID = number | string;

interface BtCharacteristic {
  uuid: string;
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    read: boolean;
    notify: boolean;
    indicate: boolean;
  };
  writeValueWithoutResponse(value: Uint8Array): Promise<void>;
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  writeValue(value: Uint8Array): Promise<void>;
  readValue(): Promise<DataView>;
}

interface BtService {
  uuid: string;
  getCharacteristics(): Promise<BtCharacteristic[]>;
  getCharacteristic(uuid: BtUUID): Promise<BtCharacteristic>;
}

interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BtService[]>;
  getPrimaryService(uuid: BtUUID): Promise<BtService>;
}

interface BtDevice {
  id: string;
  name?: string;
  gatt?: BtServer;
  addEventListener(type: "gattserverdisconnected", cb: () => void): void;
  removeEventListener(type: "gattserverdisconnected", cb: () => void): void;
}

interface BtNavigator {
  bluetooth?: {
    requestDevice(options: {
      filters?: unknown[];
      optionalServices?: BtUUID[];
      acceptAllDevices?: boolean;
    }): Promise<BtDevice>;
    getAvailability?(): Promise<boolean>;
  };
}

// --- Protocol presets -------------------------------------------------------

export interface LampProtocol {
  id: string;
  name: string;
  note: string;
  /** 16-bit or full UUID of the service that holds the write characteristic. */
  service: BtUUID;
  /** 16-bit or full UUID of the writable characteristic. */
  characteristic: BtUUID;
  /** null when the protocol has no dedicated power command (use rgb 0,0,0 instead). */
  power(on: boolean): number[] | null;
  rgb(r: number, g: number, b: number): number[];
  /** Optional dedicated warm/cool-white channel. */
  white?(level: number): number[];
}

export const PROTOCOLS: LampProtocol[] = [
  {
    id: "triones",
    name: "Triones / Magic Blue (0xFFE5 · 0xFFE9)",
    note: "Most common. Header 0x56, trailer 0x00 0xF0 0xAA. Try this first.",
    service: 0xffe5,
    characteristic: 0xffe9,
    power: (on) => (on ? [0xcc, 0x23, 0x33] : [0xcc, 0x24, 0x33]),
    rgb: (r, g, b) => [0x56, r, g, b, 0x00, 0xf0, 0xaa],
    white: (w) => [0x56, 0x00, 0x00, 0x00, w, 0x0f, 0xaa],
  },
  {
    id: "elk-bledom",
    name: "ELK-BLEDOM strip (0xFFF0 · 0xFFF3)",
    note: "Common LED-strip firmware. Header 0x7E, trailer 0xEF.",
    service: 0xfff0,
    characteristic: 0xfff3,
    power: (on) =>
      on
        ? [0x7e, 0x00, 0x04, 0xf0, 0x00, 0x01, 0xff, 0x00, 0xef]
        : [0x7e, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0x00, 0xef],
    rgb: (r, g, b) => [0x7e, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xef],
  },
  {
    id: "bgrw",
    name: "Raw BGRW (0xFFB0 · 0xFFB2)",
    note: "4 raw bytes: blue, green, red, white. No power command — 0,0,0 = off.",
    service: 0xffb0,
    characteristic: 0xffb2,
    power: () => null,
    rgb: (r, g, b) => [b, g, r, 0x00],
    white: (w) => [0x00, 0x00, 0x00, w],
  },
];

// Service UUIDs the browser must be told about up front — Web Bluetooth blocks
// access to any service not listed in the filter or optionalServices.
export const OPTIONAL_SERVICES: BtUUID[] = [
  ...PROTOCOLS.map((p) => p.service),
  // A few more that these generic bulbs are known to expose, so the inspector
  // can enumerate them even when they aren't the active protocol.
  0xffe0, 0xfff0, 0xffb0, 0xff00, 0xffd0,
  "0000fff0-0000-1000-8000-00805f9b34fb",
];

// --- Discovery / inspection -------------------------------------------------

export interface CharInfo {
  uuid: string;
  props: string[];
}
export interface ServiceInfo {
  uuid: string;
  characteristics: CharInfo[];
}

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as BtNavigator).bluetooth;
}

function propList(c: BtCharacteristic): string[] {
  const p = c.properties;
  const out: string[] = [];
  if (p.read) out.push("read");
  if (p.write) out.push("write");
  if (p.writeWithoutResponse) out.push("writeNR");
  if (p.notify) out.push("notify");
  if (p.indicate) out.push("indicate");
  return out;
}

function toHexBytes(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes.map((b) => b & 0xff));
}

export function parseHex(input: string): number[] {
  const cleaned = input.trim().replace(/0x/gi, "").replace(/[,\s]+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned.split(" ").map((tok) => {
    const n = parseInt(tok, 16);
    if (Number.isNaN(n) || n < 0 || n > 0xff) {
      throw new Error(`"${tok}" is not a byte (00–FF)`);
    }
    return n;
  });
}

/** Accepts "0xffe9", "ffe9", or a full 128-bit UUID string. */
export function parseUuid(input: string): BtUUID {
  const s = input.trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(s)) return parseInt(s, 16);
  if (/^[0-9a-f]{1,4}$/.test(s)) return parseInt(s, 16);
  return s; // assume a full UUID
}

export function uuidLabel(u: BtUUID): string {
  return typeof u === "number" ? "0x" + u.toString(16) : u;
}

export function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

/**
 * A live connection to a lamp. Holds the GATT server and resolves the write
 * characteristic lazily per protocol so you can switch presets without
 * reconnecting.
 */
export class Lamp {
  device: BtDevice;
  server: BtServer;
  private charCache = new Map<string, BtCharacteristic>();

  private constructor(device: BtDevice, server: BtServer) {
    this.device = device;
    this.server = server;
  }

  get name(): string {
    return this.device.name || this.device.id || "unknown device";
  }

  static async connect(): Promise<Lamp> {
    const bt = (navigator as BtNavigator).bluetooth;
    if (!bt) throw new Error("Web Bluetooth is not available in this browser.");
    const device = await bt.requestDevice({
      // acceptAllDevices so the chooser shows the lamp regardless of how it
      // advertises; optionalServices unlocks the GATT services we may use.
      acceptAllDevices: true,
      optionalServices: OPTIONAL_SERVICES,
    });
    if (!device.gatt) throw new Error("Selected device has no GATT server.");
    const server = await device.gatt.connect();
    return new Lamp(device, server);
  }

  onDisconnect(cb: () => void): void {
    this.device.addEventListener("gattserverdisconnected", cb);
  }

  disconnect(): void {
    this.charCache.clear();
    if (this.server.connected) this.server.disconnect();
  }

  /** Enumerate every service and characteristic — use this to identify the lamp. */
  async inspect(): Promise<ServiceInfo[]> {
    const services = await this.server.getPrimaryServices();
    const out: ServiceInfo[] = [];
    for (const svc of services) {
      let chars: CharInfo[] = [];
      try {
        const cs = await svc.getCharacteristics();
        chars = cs.map((c) => ({ uuid: c.uuid, props: propList(c) }));
      } catch {
        // some services refuse enumeration; still report the service
      }
      out.push({ uuid: svc.uuid, characteristics: chars });
    }
    return out;
  }

  private async characteristic(
    service: BtUUID,
    characteristic: BtUUID,
  ): Promise<BtCharacteristic> {
    const key = `${service}/${characteristic}`;
    const cached = this.charCache.get(key);
    if (cached) return cached;
    const svc = await this.server.getPrimaryService(service);
    const chr = await svc.getCharacteristic(characteristic);
    this.charCache.set(key, chr);
    return chr;
  }

  private async write(chr: BtCharacteristic, bytes: number[]): Promise<void> {
    const value = toHexBytes(bytes);
    if (chr.properties.writeWithoutResponse) {
      await chr.writeValueWithoutResponse(value);
    } else {
      await chr.writeValue(value);
    }
  }

  async send(proto: LampProtocol, bytes: number[]): Promise<void> {
    const chr = await this.characteristic(proto.service, proto.characteristic);
    await this.write(chr, bytes);
  }

  /** Write arbitrary bytes to an explicit service/characteristic (raw console). */
  async sendRaw(service: BtUUID, characteristic: BtUUID, bytes: number[]): Promise<void> {
    const chr = await this.characteristic(service, characteristic);
    await this.write(chr, bytes);
  }

  setColor(proto: LampProtocol, r: number, g: number, b: number): Promise<void> {
    return this.send(proto, proto.rgb(r, g, b));
  }

  async setPower(proto: LampProtocol, on: boolean): Promise<void> {
    const cmd = proto.power(on);
    if (cmd) return this.send(proto, cmd);
    // No power command: emulate "off" with black. Caller handles "on".
    if (!on) return this.setColor(proto, 0, 0, 0);
  }
}

/** "#rrggbb" -> [r, g, b] scaled by brightness (0–100). */
export function hexColorToRgb(hex: string, brightness = 100): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const scale = Math.max(0, Math.min(100, brightness)) / 100;
  return [
    Math.round(parseInt(m[1], 16) * scale),
    Math.round(parseInt(m[2], 16) * scale),
    Math.round(parseInt(m[3], 16) * scale),
  ];
}
