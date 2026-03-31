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

### Quick code map (clickable)

- BLE runtime config source: [app.json](app.json#L65-L83)
- BLE config reader/helpers: [services/ble/config.ts](services/ble/config.ts)
- BLE transport (scan/connect/monitor/fallbacks): [services/ble/BleClient.ts](services/ble/BleClient.ts)
- Packet decode/parsers (`lab2-33`, `binary-int16`, text modes): [services/ble/protocol.ts](services/ble/protocol.ts)
- Global app state + actions (`startScan`, `connectToDevice`, recording/session logic): [context/AppContext.tsx](context/AppContext.tsx)
- App provider wiring: [app/_layout.tsx](app/_layout.tsx#L17-L25)
- Tab panel setup (Scan/Live/Plots/Files): [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx)
- Scan panel UI/actions: [app/(tabs)/index.tsx](app/(tabs)/index.tsx)
- Live panel UI/actions: [app/(tabs)/explore.tsx](app/(tabs)/explore.tsx)
- Plots panel + chart/orientation rendering: [app/(tabs)/plots.tsx](app/(tabs)/plots.tsx)
- Files panel (sessions/export/delete): [app/(tabs)/files.tsx](app/(tabs)/files.tsx)
- CSV export implementation: [services/export/csv.ts](services/export/csv.ts)

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

What these mean (quick explain):

- **UUID reverse-order fallback**: some firmware/toolchains expose 128-bit UUIDs with byte-order differences. The app tries both the configured UUID and a reversed-byte-order candidate so it can still find the correct service/characteristic.
- **Lab2 frame reassembly buffer**: BLE notifications are not guaranteed to align to one full IMU frame. The app appends incoming chunks into a rolling buffer, searches for the `AA AA AA` header, and only decodes once a full 33-byte frame is present.
- **Read-poll fallback**: if notifications are connected but quiet/stalled, the app periodically performs a direct characteristic read to keep data flowing until notifications recover.
- **Lifecycle guards on teardown**: on disconnect/unmount/destroy, the app clears timers, removes subscriptions, resets buffers, and ignores stale callbacks so old async events cannot corrupt state.

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

How frequency is determined in this app:

- Every decoded sample carries a timestamp, and the app keeps a short rolling list of recent sample timestamps.
- It computes elapsed time between the oldest and newest timestamp in that window.
- If there are `N` timestamps, there are `N-1` sample intervals, so rate is intervals per second using the formula above.
- The displayed Hz is rounded to an integer and updates continuously, which smooths short jitter better than using only two consecutive samples.
- If elapsed time is `0` (or not valid yet), it safely reports `0 Hz`.

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

---

## 12) End-to-end data flow + workflow (sequence diagram)

```mermaid
sequenceDiagram
	autonumber
	participant User
	participant ScanTab as Scan Tab
	participant LiveTab as Live Tab
	participant PlotsTab as Plots Tab
	participant FilesTab as Files Tab
	participant AppCtx as AppContext
	participant Ble as BleClient
	participant RNBle as react-native-ble-plx
	participant Device as IMU Sensor (Firmware)
	participant Decoder as protocol.ts
	participant CSV as csv.ts
	participant FS as Cache/Share Sheet

	Note over User,FS: App boot and wiring
	User->>AppCtx: Launch app
	AppCtx->>Ble: Create BleClient instance
	Note over AppCtx: Holds single source of truth for connection, current sample, history, sessions

	Note over User,FS: 1) Permission + scan workflow
	User->>ScanTab: Tap Start Scan
	ScanTab->>AppCtx: startScan()
	AppCtx->>Ble: requestPermissions()
	Ble->>RNBle: Check/request Android BLE permissions
	RNBle-->>Ble: granted/denied
	alt denied
		Ble-->>AppCtx: permission error message
		AppCtx-->>ScanTab: errorMessage
		ScanTab-->>User: Show Open Settings/Bluetooth Settings options
	else granted
		AppCtx->>Ble: startScan(onDevice, onScanError)
		Ble->>RNBle: assert Bluetooth PoweredOn
		Ble->>RNBle: startDeviceScan()
		RNBle-->>Ble: Discovered device(s)
		Ble-->>AppCtx: onDevice(device)
		AppCtx-->>ScanTab: scannedDevices[] sorted by RSSI
		ScanTab-->>User: Device list with signal strength
	end

	Note over User,FS: 2) Connect + data path resolution
	User->>ScanTab: Tap Connect on target device
	ScanTab->>AppCtx: connectToDevice(device)
	AppCtx->>Ble: connect(deviceId, onImuData, onDisconnect)
	Ble->>RNBle: connectToDevice + discoverAllServicesAndCharacteristics
	opt Android
		Ble->>RNBle: requestMTUForDevice(185)
	end
	Ble->>RNBle: servicesForDevice + characteristicsForDevice
	Note over Ble: Resolve service/data UUID with normal + reversed-byte-order candidates
	alt exact UUID match found
		Ble->>Ble: set active service/characteristic UUID
	else exact not found
		Ble->>Ble: fallback to first notifiable/indicatable characteristic on matched service
	end
	Ble->>RNBle: monitorCharacteristicForDevice(active data char)
	Ble->>Ble: startReadPollFallback(interval)
	Ble-->>AppCtx: connected device info
	AppCtx-->>ScanTab: connectionStatus=connected

	Note over User,FS: 3) Streaming ingest and packet decoding
	par Notification path (primary)
		Device-->>RNBle: GATT notifications (Base64 value)
		RNBle-->>Ble: monitor callback(characteristic.value)
		Ble->>Ble: Base64 -> raw bytes -> binary string
		Ble->>Ble: handleIncomingPayload(decoded)
	and Read-poll path (fallback)
		loop Every poll interval when no recent samples
			Ble->>RNBle: readCharacteristicForDevice(active data char)
			RNBle-->>Ble: characteristic.value
			Ble->>Ble: Base64 -> raw bytes
			Ble->>Ble: handleIncomingPayload(decoded)
		end
	end

	alt packetMode = lab2-33
		Ble->>Ble: appendLab2Chunk()
		Ble->>Ble: consumeLab2Frames() search AA AA AA + 33-byte frame
		Ble->>Decoder: decodeImuPayload(frame)
		Decoder->>Decoder: decodeLab2Packet()
		Decoder->>Decoder: Parse timestamp(us), accel int16, gyro int16, quaternion float16
		Decoder->>Decoder: quaternion -> Euler, apply accel/gyro/euler scale
		Decoder-->>Ble: IMUData sample
	else other modes (binary-int16/csv/json/kv/auto)
		Ble->>Decoder: decodeImuPayload(payload)
		Decoder-->>Ble: IMUData sample or null
	end

	Ble-->>AppCtx: onImuData(sample)
	AppCtx->>AppCtx: set currentIMUData
	AppCtx->>AppCtx: append to imuHistory (rolling window)
	AppCtx->>AppCtx: update sampleRate from timestamps
	opt recording active
		AppCtx->>AppCtx: append sample to recordingBuffer
	end

	Note over User,FS: 4) Tab consumption (UI implementation)
	LiveTab->>AppCtx: useApp() read currentIMUData + sampleRate + isRecording
	AppCtx-->>LiveTab: latest accel/gyro/euler + Hz + record actions
	LiveTab-->>User: Live metrics + Start/Stop Recording control

	PlotsTab->>AppCtx: useApp() read imuHistory/currentIMUData
	AppCtx-->>PlotsTab: rolling history + latest orientation
	PlotsTab-->>User: Time-window plots, smoothing, scale modes, orientation preview

	FilesTab->>AppCtx: useApp() read sessions + export/delete actions
	AppCtx-->>FilesTab: session metadata and actions
	FilesTab-->>User: Recorded sessions list

	Note over User,FS: 5) Recording and export workflow
	User->>LiveTab: Tap Start Recording
	LiveTab->>AppCtx: startRecording()
	AppCtx->>Ble: startStreaming()
	opt controlCharacteristic configured
		Ble->>RNBle: writeCharacteristicWithResponse(commandStart)
		RNBle->>Device: Start stream command
	end
	AppCtx->>AppCtx: clear recordingBuffer; isRecording=true

	loop While recording and samples arrive
		Ble-->>AppCtx: decoded sample callbacks
		AppCtx->>AppCtx: push sample into recordingBuffer
	end

	User->>LiveTab: Tap Stop Recording
	LiveTab->>AppCtx: stopRecording()
	AppCtx->>Ble: stopStreaming()
	opt controlCharacteristic configured
		Ble->>RNBle: writeCharacteristicWithResponse(commandStop)
		RNBle->>Device: Stop stream command
	end
	AppCtx->>AppCtx: materialize RecordedSession with duration/rate/samples/records
	AppCtx-->>FilesTab: sessions[] updated

	User->>FilesTab: Tap Export CSV
	FilesTab->>AppCtx: exportSession(id)
	AppCtx->>CSV: exportSessionCsv(session)
	CSV->>FS: Write CSV to cache
	FS-->>User: Native share sheet

	Note over User,FS: 6) Disconnect and teardown safeguards
	User->>ScanTab: Tap Disconnect (or device drops)
	ScanTab->>AppCtx: disconnect()
	AppCtx->>Ble: disconnect()
	Ble->>RNBle: cancelDeviceConnection
	Ble->>Ble: clear read-poll timer, remove subscriptions, clear frame buffer
	RNBle-->>Ble: disconnected callback
	Ble-->>AppCtx: onDisconnect
	AppCtx->>AppCtx: connectionStatus=disconnected; reset recording flags/sampleRate

	User->>AppCtx: Close app / unmount provider
	AppCtx->>Ble: destroy()
	Ble->>Ble: lifecycle guard isDestroyed=true
	Ble->>RNBle: manager.destroy()
	Note over Ble: Prevents stale callbacks after teardown
```
