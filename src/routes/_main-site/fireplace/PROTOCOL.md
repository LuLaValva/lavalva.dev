# "Fake Fire" lamp BLE protocol

Reverse-engineered 2026-07-18 from a BLE RGBW lamp advertising as **Fake Fire**,
normally controlled by the ~2016 **ColorfulLight** app. No auth or pairing; any
central can connect and write. Only one central at a time — disconnect the app
before connecting from the browser.

## GATT layout

One custom primary service:

| UUID                                   | Role                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `8d96a001-0002-64c2-0001-9acc4838521c` | lamp service                                                                             |
| `8d96b001-0002-64c2-0001-9acc4838521c` | unknown — writing a single `88` turned the lamp on, then the lamp dropped the connection |
| `8d96b002-0002-64c2-0001-9acc4838521c` | **state** — the whole lamp state as one 20-byte read/write packet                        |
| `8d96b003-0002-64c2-0001-9acc4838521c` | unknown                                                                                  |
| `8d96b004-0002-64c2-0001-9acc4838521c` | unknown                                                                                  |

All four characteristics are `read write`.

## State packet (`…b002`, 20 bytes)

```
offset:  0     1  2  3  4    5  6  7  8    9 10 11 12   13…19
        [ms] [rr gg bb ww] [rr gg bb ww] [rr gg bb ww] [?? … ??]
         │└ speed (low nibble)
         └─ mode (high nibble)
```

- **Byte 0, high nibble — mode**
  - `0` solid (shows color slot 1)
  - `1` gradient cycle through the three color slots
  - `2` flash cycle through the three color slots
  - `3` off — the rest of the state is untouched
  - `4` on — resumes whatever mode was active before the `3`; the app uses
    the `3`/`4` pair as its power toggle
  - `5`–`F` strobe
- **Byte 0, low nibble — speed** for modes `1` and `2`; no visible effect otherwise.
- **Bytes 1–12 — three color slots** of 4 bytes each: `rr gg bb ww`. `ww` is a
  dedicated white channel much brighter than the RGB LEDs — above ~`40` it
  drowns them out.
- **Bytes 13–19 — unknown.** The app sets the low nibble of byte 17 to `1`;
  changing it has no visible effect.

Writing the packet applies immediately. Reading it back returns the last
written state, so state survives round-trips.

## Open questions

- The app's **"random" mode changes none of these 20 bytes** — it must go
  through another channel, presumably `b001`, `b003`, or `b004`.
- What `b001` really is (power? trigger commands?) — the one probe so far
  (single byte `88`) turned the lamp on but killed the connection, which
  suggests it expects a longer packet.
- Meaning of trailing bytes 13–19 and the byte-17 nibble the app sets.
