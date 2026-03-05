# ECE796 App Technical Guide

## Audience and purpose

This document is written for developers who need a full mental model of how the app works so they can:

- explain the system to an expert,
- debug runtime issues quickly,
- safely implement new features,
- and reason about why current design choices are valid.

The app is an Expo + React Native BLE telemetry client for an IMU peripheral. It scans, connects, ingests packets, decodes physical signals, visualizes live and historical data, and exports recorded sessions to CSV.

---

## 1) System overview

### 1.1 Core architecture

The app uses a layered structure:

1. UI layer (tabs/screens)
   - Scan, Live, Plots, Files.
2. Application state layer
   - `context/AppContext.tsx` is the single source of truth for connection state, live samples, history, recording state, and recorded sessions.
3. Transport layer
   - `services/ble/BleClient.ts` manages permissions, scan, connect, subscribe/read, and lifecycle cleanup.
4. Protocol layer
   - `services/ble/protocol.ts` converts payload bytes/text into structured IMU data.
5. Export layer
   - `services/export/csv.ts` serializes session records and invokes OS sharing.
6. Runtime config layer
   - `app.json` under `expo.extra.ble` controls UUIDs, protocol mode, and scaling factors.

### 1.2 Navigation and composition

- Root layout in `app/_layout.tsx` wraps the app in `AppProvider`, then mounts Expo Router stack.
- Tabs are defined in `app/(tabs)/_layout.tsx`.
- All tabs consume state/actions through `useApp()`.

This gives centralized data ownership and thin view components.

---

## 2) Runtime configuration model

BLE runtime values are provided in `app.json`:

- service UUID,
- data characteristic UUID,
- optional control characteristic UUID,
- start/stop commands,
- protocol parse mode and binary shape,
- scaling constants (accel, gyro, euler).

`services/ble/config.ts` reads these values through `expo-constants` at runtime, applies fallbacks, and validates whether placeholder UUIDs are still present.

### Why this matters

- You can retarget a different firmware profile by changing config instead of rewriting decode logic.
- Protocol constants are centrally visible and versionable.

---

## 3) BLE stack and connection lifecycle

### 3.1 BLE role and transport mode

- Phone role: BLE Central.
- Peripheral role: IMU sensor board.
- Data delivery path: characteristic notifications/indications with periodic read fallback.

`react-native-ble-plx` is the transport engine.

### 3.2 Permissions and platform gating

`BleClient.requestPermissions()`:

- Android 12+ requests `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`.
- Older Android requests location permission for scanning.
- iOS path returns granted from this method (OS prompt is Info.plist/plugin driven).

`BleClient.assertBluetoothPoweredOn()` checks adapter state and emits actionable errors.

### 3.3 Scan flow

From `AppContext.startScan()`:

1. clear UI errors and previous scan list,
2. request permissions,
3. start scan via `BleClient.startScan()`,
4. de-duplicate by device ID and sort by RSSI.

### 3.4 Connect flow

`BleClient.connect()` sequence:

1. reset old subscriptions/timers/buffers,
2. connect and discover services/characteristics,
3. request larger MTU on Android (best effort),
4. resolve data path UUIDs with fallback strategy,
5. subscribe with `monitorCharacteristicForDevice`,
6. start read polling fallback if samples stop.

### 3.5 UUID resolution strategy

`resolveDataPath()` is robust against firmware/stack quirks:

- tries configured UUID and reversed-byte-order UUID form,
- if exact characteristic not found, uses first notifiable/indicatable characteristic on matching service.

This prevents hard failure on common UUID representation mismatches.

### 3.6 Disconnect and teardown

- `disconnect()` clears all runtime resources and cancels active connection.
- `destroy()` additionally tears down the native manager and blocks stale callbacks.

---

## 4) Packet ingress and decode pipeline

### 4.1 Data representation entering decode

BLE characteristic values arrive as Base64. `BleClient` decodes Base64 to raw bytes and passes a binary string into protocol decode helpers.

### 4.2 Active production mode

Current config uses:

- `packetMode = lab2-33`
- header `AA AA AA`
- frame size 33 bytes
- little-endian decode

### 4.3 Frame reassembly

BLE notifications may fragment packets. `BleClient` accumulates bytes in `lab2RxBuffer` and extracts complete 33-byte frames by searching header markers.

This is critical: decode happens on complete frame boundaries, not notification boundaries.

### 4.4 Lab2 packet format

In `decodeLab2Packet()`:

- `[0..2]` header
- `[3..6]` counter (currently not surfaced)
- `[7..14]` timestamp uint64 in microseconds
- `[15..20]` accel int16 x/y/z
- `[21..26]` gyro int16 x/y/z
- `[27..32]` qx/qy/qz float16

Quaternion conversion reconstructs `qw` and produces Euler degrees.

### 4.5 Scaling to physical units

Final values are scaled by config constants:

- accel scale: converts counts to m/s²
- gyro scale: converts counts to °/s
- euler scale: typically 1 in this profile

### 4.6 Sample-rate estimation

`AppContext` keeps a rolling timestamp window and computes:

$$
\text{Hz} = \frac{(N-1)\cdot 1000}{t_{last} - t_{first}}
$$

where timestamps are milliseconds.

---

## 5) State model and data ownership

`AppContext` owns:

- connection state (`disconnected`, `connecting`, `connected`),
- scanned device list,
- latest sample,
- history buffer (`imuHistory`, capped at last ~3000),
- recording flags and buffer,
- sessions list,
- sample rate,
- BLE readiness and error messaging.

### Why this design works

- screens remain mostly presentational,
- BLE lifecycle is not duplicated across tabs,
- recording/export can be triggered from any screen using shared state.

---

## 6) Screen-by-screen behavior

### 6.1 Scan tab

File: `app/(tabs)/index.tsx`

Features:

- Start/stop scan.
- RSSI-based signal visualization.
- Connect/disconnect controls.
- Contextual error actions (open app settings, open Bluetooth settings).

### 6.2 Live tab

File: `app/(tabs)/explore.tsx`

Features:

- live accel/gyro/euler values,
- live sample-rate display,
- recording start/stop controls.

### 6.3 Plots tab

File: `app/(tabs)/plots.tsx`

Features:

- time-window selection (10/30/60 s),
- pause/resume timeline,
- raw vs smoothed plotting mode,
- fixed vs auto scale mode,
- axis labels + min/max labels,
- gyro live extrema + suggested range text when overflow detected,
- 3D orientation preview using Euler angles (pitch/roll/yaw transforms).

### 6.4 Files tab

File: `app/(tabs)/files.tsx`

Features:

- session list and summary stats,
- export CSV action,
- delete session action.

---

## 7) Plotting internals and stability choices

### 7.1 Smoothing

A moving average reduces jitter. It is visual-only and does not alter raw stored samples.

### 7.2 Scale modes

- Fixed scale: stable visual context, useful for comparing runs and avoiding zoom jitter.
- Auto scale: adapts to current data envelope.

### 7.3 Domain clipping and padding

Polyline mapping clamps to domain and uses vertical padding to avoid perceived clipping at bounds.

### 7.4 Numeric safety

Recent hardening prevents NaN values from entering transform strings and formatting calls by sanitizing non-finite numbers before plotting or rendering labels.

---

## 8) Recording and CSV export workflow

### 8.1 Recording

`startRecording()`:

- issues optional start command,
- clears buffer,
- flips recording flag.

Incoming decoded samples are appended while recording is active.

`stopRecording()`:

- issues optional stop command,
- computes duration and metadata,
- creates `RecordedSession` and stores in memory.

### 8.2 CSV export

`exportSessionCsv()`:

1. build rows with header:
   - timestamp, accel x/y/z, gyro x/y/z, roll/pitch/yaw
2. write UTF-8 CSV to cache directory,
3. open share sheet if available,
4. return file URI always.

---

## 9) Why this architecture is robust

1. Separation of concerns
   - transport, decode, state, and UI are clearly split.
2. Real-world BLE resilience
   - permissions, adapter-state checks, UUID fallback, and read polling fallback are integrated.
3. Protocol flexibility
   - decoder supports multiple text/binary packet modes.
4. Runtime safety
   - lifecycle guards and teardown paths reduce stale callback issues.
5. UX resilience
   - explicit user-facing error messages and settings shortcuts reduce field-debug friction.

---

## 10) Implementation playbooks (how to add features safely)

### 10.1 Add a new sensor metric (example: temperature)

1. Extend data model
   - update `IMUData` in `services/ble/protocol.ts`.
2. Decode pipeline
   - parse new field in `decodeLab2Packet()` (or other packet mode).
3. State propagation
   - ensure sample callback in `AppContext` receives updated shape.
4. UI
   - add rendering in Live/Plots, and include field in CSV export.
5. Validation
   - confirm no NaN in visualization path.

### 10.2 Support a different firmware packet

1. Add parser function in `protocol.ts`.
2. Add a new packet mode flag to decode options/type.
3. Wire mode selection in `decodeImuPayload()`.
4. Update `app.json` protocol configuration.
5. Test with raw payload captures (including fragmented notifications).

### 10.3 Add persistent session storage

Current sessions are in-memory. To persist:

1. introduce a persistence layer (SQLite or file-based JSON/CSV index),
2. load sessions at app startup in `AppProvider`,
3. persist on create/delete,
4. preserve `exportSessionCsv()` as the sharing path.

### 10.4 Add additional plot controls

Controls should be local UI state in `plots.tsx`, while data source remains `imuHistory` from context. Keep transformations pure and memoized.

---

## 11) Debugging guide

### 11.1 Connects but no data

Check:

- UUID configuration in `app.json`,
- notification capability of characteristic,
- parser mode/header/endianness,
- whether fallback polling path is active,
- whether decoded samples are null due to malformed frames.

### 11.2 Unreasonable values

Likely scaling mismatch. Verify `accelScale` and `gyroScale` against firmware full-scale settings.

### 11.3 Plot crashes or Invalid number formatting errors

Symptoms usually indicate non-finite values reaching transforms or text formatting. Ensure all render-path numeric values are sanitized.

### 11.4 Android permission confusion

Use app-provided settings shortcuts and verify Nearby Devices permissions are granted and Bluetooth adapter is powered on.

---

## 12) Performance considerations

1. History cap
   - limits memory growth and render cost.
2. Memoized plot computations
   - smoothing/polyline points are memoized.
3. Scoped updates
   - central state updates can still trigger tab rerenders; future optimization could split contexts by concern (connection vs telemetry vs sessions).

---

## 13) Security and operational notes

- BLE commands are plain text and not authenticated at app layer.
- Session data is stored in memory and temporary cache; sensitive deployments may require encrypted storage.
- Error strings are user-facing and intentionally actionable.

---

## 14) Quick expert-level explanation template

Use this in technical interviews/reviews:

"The app is a layered BLE telemetry client. A centralized React Context owns connection, stream, history, and recording state. BLE transport is encapsulated in a service that handles platform permissions, adapter readiness, UUID resolution, notification subscription, and read-poll fallback. Incoming Base64 characteristic payloads are decoded to bytes, reassembled into fixed-length Lab2 frames, then parsed into typed IMU samples with endian-safe int16 and float16 handling plus quaternion-to-Euler conversion. UI tabs are intentionally thin: Scan orchestrates discovery/connect, Live renders current sample and recording controls, Plots renders memoized transformed history with fixed/auto scales and smoothing, and Files exports typed sessions to CSV through file-system plus share sheet. Configuration is externalized in app.json so protocol and UUID retargeting can happen without deep code rewrites." 

---

## 15) Recommended next improvements

1. Persist sessions across restarts.
2. Add parser-level diagnostics counters (frames seen, decode failures, dropped payloads).
3. Add firmware profile presets for scale/UUID/packet layout.
4. Add optional unit/integration tests for protocol decode edge cases.
5. Add range presets in Plots for gyro full-scale switching.
