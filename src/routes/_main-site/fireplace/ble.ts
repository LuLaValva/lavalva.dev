/// <reference types="web-bluetooth" />

// The one lamp this page exists to control ("Fake Fire", a ColorfulLight-app
// lamp). GATT UUIDs are fixed in firmware, so hardcoding is safe. Byte format
// and everything else we've reverse-engineered: see PROTOCOL.md.
export const LAMP_SERVICE = "8d96a001-0002-64c2-0001-9acc4838521c";
export const STATE_CHAR = "8d96b002-0002-64c2-0001-9acc4838521c";
export const STATE_LEN = 20;

export const supported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth;

export async function connectLamp() {
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [LAMP_SERVICE],
  });
  return { device, char: await attach(device) };
}

// GATT children are invalidated on every disconnect, so reconnecting to an
// already-permitted device means re-walking service → characteristic.
export async function attach(device: BluetoothDevice) {
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(LAMP_SERVICE);
  return service.getCharacteristic(STATE_CHAR);
}

export async function readState(
  char: BluetoothRemoteGATTCharacteristic,
): Promise<number[]> {
  const dv = await char.readValue();
  return [...new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)];
}

export function writeState(
  char: BluetoothRemoteGATTCharacteristic,
  bytes: number[],
) {
  const buf = Uint8Array.from(bytes).buffer as ArrayBuffer;
  return char.properties.writeWithoutResponse
    ? char.writeValueWithoutResponse(buf)
    : char.writeValueWithResponse(buf);
}
