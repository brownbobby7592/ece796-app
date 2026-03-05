# ECE796 App Study Sheet

## 1) One-minute summary

This app is a BLE IMU client built with Expo + React Native. It scans and connects to a sensor, decodes binary packets into accel/gyro/euler data, visualizes live values and plots, records sessions in memory, and exports sessions to CSV via file cache + share sheet.

---

## 2) Core architecture (memorize this)

1. UI tabs: Scan, Live, Plots, Files
2. App state: `AppContext` (single source of truth)
3. BLE transport: `BleClient`
4. Protocol decode: `protocol.ts`
5. Export: `csv.ts`
6. Runtime config: `app.json` (`expo.extra.ble`)

If asked "why this architecture": separation of concerns + easier debugging + reusable state/actions across screens.

---

## 3) BLE flow (end-to-end)

1. Request permissions
2. Verify Bluetooth powered on
3. Scan devices
4. Connect + discover services/chars
5. Resolve data characteristic UUID
6. Subscribe to notifications
7. Decode incoming payloads
8. Update live state/history/recording buffer
9. Fallback polling reads if notifications stall

Key robustness features:

- UUID reverse-order fallback
- Lab2 frame reassembly buffer
- Read-poll fallback
- Lifecycle guards on teardown

---

## 4) Packet decode quick facts

Active mode: `lab2-33`

- Header: `AA AA AA`
- Frame length: 33 bytes
- Timestamp: uint64 microseconds -> converted to milliseconds
- Accel/Gyro: int16 values scaled by config
- Quaternion (`qx,qy,qz` float16) -> Euler degrees

Why scaling matters: raw sensor counts are not physical units until multiplied by `accelScale` / `gyroScale`.

---

## 5) Important formulas

Sample rate estimate:

$$
Hz = \frac{(N-1)\cdot 1000}{t_{last}-t_{first}}
$$

Quaternion to Euler: app computes roll/pitch/yaw from reconstructed unit quaternion and converts rad -> deg.

---

## 6) Screen behavior cheat sheet

- Scan: start/stop scan, RSSI list, connect/disconnect, settings shortcuts for errors
- Live: current accel/gyro/euler + sample rate + record controls
- Plots: time window, raw/smoothed, auto/fixed scale, axis labels, gyro observed min/max
- Files: session list + duration/rate/samples + export/delete

---

## 7) Recording + export

Recording:

- Start: clear buffer and set recording active
- During stream: append each decoded sample
- Stop: create session metadata + store records in memory

CSV export columns:

`timestamp,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,roll,pitch,yaw`

Export writes to cache directory and opens native share sheet when available.

---

## 8) Common issues and fastest diagnosis

No data but connected:

- check UUIDs, packet mode, header, endianness, permissions, Bluetooth state

Values look too large/small:

- scale constants mismatch firmware full-scale settings

Plot "clips" unexpectedly:

- fixed domain too small or true values exceed range

Invalid number formatting / NaN errors:

- non-finite values reached transforms/labels; sanitize numeric render path

---

## 9) How to explain "why it works"

Use this structure:

1. "Transport is resilient" (permissions + state checks + notification/read fallback)
2. "Decode is deterministic" (fixed frame format, byte offsets, endianness, scaling)
3. "State is centralized" (single context powering all tabs)
4. "Views are thin" (UI reflects state; logic mostly outside screen components)
5. "Export is reproducible" (structured session records -> deterministic CSV)

---

## 10) Fast extension playbook

Add new field (example temp):

1. Extend `IMUData`
2. Parse field in decoder
3. Surface in context/UI
4. Include in CSV
5. Validate units/scales

Add new packet type:

1. Add parser function
2. Add packet mode enum
3. Route in decode entrypoint
4. Configure via `app.json`

---

## 11) 30-second expert pitch

"This is a layered BLE telemetry app: React Context centralizes connection and sensor state, a BLE transport service manages scan/connect/monitor with runtime fallbacks, a protocol decoder converts framed binary packets into scaled physical signals, and tab screens provide scan/live/plot/export workflows. The design is robust because transport, decode, and UI are decoupled, making it easy to retarget firmware profiles, diagnose failures, and extend features safely." 
