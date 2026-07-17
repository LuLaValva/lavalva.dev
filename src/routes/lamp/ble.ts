/// <reference types="web-bluetooth" />

// Generic BLE RGB lamps — the kind the "Colorful Light" app drives — ship with
// no auth, so once you know the write characteristic and byte format you can
// control them from the browser. The color/power buttons use the Triones /
// Magic Blue protocol (service 0xFFE5, characteristic 0xFFE9), by far the most
// common. For any other firmware, find the write characteristic with Inspect
// and drive it from the raw console.

export const SERVICE = 0xffe5;
export const CHARACTERISTIC = 0xffe9;

// Web Bluetooth blocks access to any service not requested up front; list the
// ones these generic lamps are known to expose so Inspect can enumerate them.
export const OPTIONAL_SERVICES = [0xffe5, 0xffe0, 0xfff0, 0xffb0, 0xffd0];

export const rgbCommand = (r: number, g: number, b: number) => [0x56, r, g, b, 0x00, 0xf0, 0xaa];
export const powerCommand = (on: boolean) => (on ? [0xcc, 0x23, 0x33] : [0xcc, 0x24, 0x33]);

export const supported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth;

export function parseHex(input: string): number[] {
  return input
    .trim()
    .replace(/0x/gi, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((tok) => {
      const n = parseInt(tok, 16);
      if (Number.isNaN(n) || n < 0 || n > 255) throw new Error(`"${tok}" isn't a hex byte`);
      return n;
    });
}

export const toHex = (bytes: number[]) =>
  bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

export const parseUuid = (s: string): number | string => {
  const t = s.trim().toLowerCase();
  return /^(0x)?[0-9a-f]{1,4}$/.test(t) ? parseInt(t, 16) : t;
};

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

export interface ServiceInfo {
  uuid: string;
  chars: { uuid: string; write: boolean }[];
}

/** A live GATT connection to a lamp. */
export class Lamp {
  private constructor(
    private device: BluetoothDevice,
    private server: BluetoothRemoteGATTServer,
  ) {}

  get name() {
    return this.device.name || this.device.id;
  }

  static async connect(): Promise<Lamp> {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth isn't available here.");
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: OPTIONAL_SERVICES,
    });
    const server = await device.gatt!.connect();
    return new Lamp(device, server);
  }

  onDisconnect(cb: () => void) {
    this.device.addEventListener("gattserverdisconnected", cb);
  }

  disconnect() {
    if (this.server.connected) this.server.disconnect();
  }

  /** Enumerate every service and characteristic — use this to find the write target. */
  async inspect(): Promise<ServiceInfo[]> {
    const services = await this.server.getPrimaryServices();
    return Promise.all(
      services.map(async (s) => ({
        uuid: s.uuid,
        chars: (await s.getCharacteristics().catch(() => [])).map((c) => ({
          uuid: c.uuid,
          write: c.properties.write || c.properties.writeWithoutResponse,
        })),
      })),
    );
  }

  async write(service: number | string, characteristic: number | string, bytes: number[]) {
    const svc = await this.server.getPrimaryService(service);
    const chr = await svc.getCharacteristic(characteristic);
    await chr.writeValue(Uint8Array.from(bytes).buffer as ArrayBuffer);
  }
}
