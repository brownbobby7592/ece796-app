# Smartphone App Design Implementation
This document explains how the smartphone app design was implemented and maps the final mobile UI to the source code.

## 1. Design approach
The smartphone app was implemented as a native Expo + React Native application. The design direction came from the prototype in the `figma-export` folder, but the final phone app was rewritten using React Native components so it could run as a real BLE-enabled mobile application.
The design keeps the same main information architecture as the prototype: **Scan**, **Live**, **Plots**, and **Files**.
This 4-tab structure appears in `figma-export/src/app/components/BottomNav.tsx` and was implemented natively in `app/(tabs)/_layout.tsx`.
In the mobile app, Expo Router is used to create the bottom tab navigation, and each tab corresponds to one screen.

## 2. App shell and navigation
The root app layout is defined in `app/_layout.tsx`.
This file does three important things: (1) wraps the app in `AppProvider`, (2) applies the app theme using `ThemeProvider`, and (3) mounts the Expo Router navigation stack.
This means the design is not just a set of screens; it is organized as a full application shell with shared state and navigation.
The bottom tab structure is implemented in `app/(tabs)/_layout.tsx`.
This file defines the four tabs and assigns each one a title and icon: `index` → **Scan**, `explore` → **Live**, `plots` → **Plots**, and `files` → **Files**.
This directly matches the intended smartphone navigation design.

## 3. Shared state and app logic
Instead of letting every screen manage its own data separately, the implementation uses one centralized application state in `context/AppContext.tsx`.
This file is the core of the app design because it stores and exposes BLE connection state, scanned devices, current IMU data, IMU history, recording state, sample rate, saved sessions, and export actions.
The custom hook `useApp()` allows each screen to access the same shared data. This design choice keeps the UI consistent and ensures that all screens update together when the BLE state changes.
For example, the **Scan** screen reads scanned devices and connection status, the **Live** screen reads the latest IMU values, the **Plots** screen reads the historical buffer, and the **Files** screen reads recorded sessions.
So the visual design is backed by one coherent data model rather than isolated UI mockups.

## 4. Scan screen implementation
The Scan screen is implemented in `app/(tabs)/index.tsx`.
This screen corresponds to the prototype concept in `figma-export/src/app/components/ScanScreen.tsx`.
Design features implemented:
- **Status banner:** the top of the screen shows whether the app is connected, connecting, or disconnected. This is implemented using `statusText` and `statusColor` logic in `ScanScreen()`.
- **Scan controls:** the main action area contains a **Start Scan** button and a **Stop** button while scanning.
- **Device cards:** each discovered device is rendered as a card showing device name, MAC address, RSSI value, signal-strength bars, and a connect button.
- **Signal bars:** the visual signal indicator is computed by `getSignalBars(rssi: number)`.
- **Mobile-specific improvements:** the final app adds **Open Settings** and **Bluetooth Settings** actions when errors indicate permission or Bluetooth configuration problems.
So the final implementation keeps the original design idea but also makes it usable on a real smartphone.

## 5. Live screen implementation
The Live screen is implemented in `app/(tabs)/explore.tsx`.
This corresponds to the prototype idea in `figma-export/src/app/components/LiveScreen.tsx`.
Design features implemented:
- **Header information:** the top section shows the screen title, connected device name, and current sample rate in Hz.
- **Sensor data cards:** the screen displays three sensor groups: **Acceleration**, **Gyroscope**, and **Euler Angles**.
- **Reusable layout:** the repeated card layout is implemented using `SensorSection()`, which receives a title, accent color, axis labels, and formatted values.
- **Recording controls:** the Live screen contains **Start Recording**, **Stop Recording**, and a `REC` indicator when active.
This is an important design choice because recording is closely related to live viewing. The user does not need to leave the live telemetry screen to start a session.

## 6. Plots screen implementation
The Plots screen is implemented in `app/(tabs)/plots.tsx`.
This corresponds to the prototype screen in `figma-export/src/app/components/PlotsScreen.tsx`.
The main difference is that the production phone app does not rely on browser chart libraries. Instead, it renders plots directly with React Native and SVG.
Design features implemented:
- **Time-range controls:** the user can select 10 s, 30 s, or 60 s.
- **Pause and resume:** the user can freeze the chart for inspection.
- **Raw vs smoothed mode:** the screen offers **Raw** and **Smoothed** modes. Smoothing is implemented by `movingAverage(values, windowSize)`.
- **Auto scale vs fixed scale:** the screen offers **Auto Scale** and **Fixed Scale** for different analysis needs.
- **Orientation preview:** the plots screen includes an orientation visualization using Euler angles through `OrientationPreview()`.
- **Custom line plotting:** plot rendering uses `LinePlot()` and `toPolylinePoints()` to convert sampled IMU data into SVG polyline coordinates.
This is a major implementation detail because it replaces web charting dependencies with a native-friendly solution while preserving the intended design.

## 7. Files screen implementation
The Files screen is implemented in `app/(tabs)/files.tsx`.
This corresponds to the prototype in `figma-export/src/app/components/FilesScreen.tsx`.
Design features implemented:
- **Session summary header:** the top of the screen shows total used storage, a progress bar, number of sessions, and total sample count.
- **Session cards:** each recording session is displayed in a card showing session ID, timestamp, duration, sample rate, sample count, and estimated file size.
- **Export and delete actions:** each session card includes **Export CSV** and **Delete**.
- **Duration formatting:** `formatDuration(seconds: number)` displays session lengths in compact `M:SS` format.
This keeps data management simple and accessible on a mobile screen.

## 8. BLE functionality behind the design
The smartphone app design is not static. It is backed by real BLE functionality implemented in `services/ble/BleClient.ts`.
This class handles permission requests, BLE scanning, connection setup, service and characteristic discovery, UUID resolution, notification monitoring, polling fallback reads, stream start/stop control, and disconnect cleanup.
This is what makes the design operational on an actual phone.
The app was designed for an IMU sensor device, so the BLE layer had to be robust. For example, `resolveDataPath()` helps find the correct characteristic even if firmware UUID formatting differs slightly. This improves reliability without changing the UI.

## 9. Protocol decoding and telemetry model
Once data is received over BLE, it is decoded in `services/ble/protocol.ts`.
This file defines the common telemetry type `IMUData`, which contains acceleration, gyroscope, Euler angles, and timestamp.
The decoder supports multiple payload formats, including the Lab2 33-byte packet format.
This is important for the design because every screen relies on the same normalized data structure. The UI does not need to know whether the source packet was CSV, JSON, or binary. It always receives structured `IMUData`.

## 10. CSV export implementation
The export feature used by the Files screen is implemented in `services/export/csv.ts`.
This file defines `RecordedSession`, `buildSessionCsv()`, and `exportSessionCsv()`.
The implementation converts recorded IMU samples into CSV rows and writes them to storage using Expo file APIs. If sharing is available, it then opens the system share sheet.
This is how the smartphone design supports actual workflow beyond visualization: the user can record, save, and export sensor data directly from the app.

## 11. How the prototype was adapted for the phone app
The `figma-export` folder contains a web-style prototype of the application. The final smartphone app did not copy that code directly. Instead, the design was translated into native mobile implementation.
Main adaptations:
1. Web navigation → Expo Router tabs
2. HTML/CSS layout → React Native `View`, `Text`, `ScrollView`, `Pressable`
3. Browser chart library → custom SVG plotting
4. Mock sensor state → real BLE-driven shared state
5. Web download flow → Expo file system and sharing
This means the prototype guided the visual layout and screen structure, but the final app was engineered specifically for smartphone runtime requirements.

## 12. Overall implementation summary
In summary, the smartphone app design was implemented by combining a native tabbed mobile UI, a centralized React Context state model, a BLE communication layer, a protocol decoding layer, and a CSV export workflow.
The final result preserves the intended design structure from the prototype while making it fully functional on a real smartphone.
Main source files referenced:
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/explore.tsx`
- `app/(tabs)/plots.tsx`
- `app/(tabs)/files.tsx`
- `context/AppContext.tsx`
- `services/ble/BleClient.ts`
- `services/ble/config.ts`
- `services/ble/protocol.ts`
- `services/export/csv.ts`
- `figma-export/src/app/components/BottomNav.tsx`
- `figma-export/src/app/components/ScanScreen.tsx`
- `figma-export/src/app/components/LiveScreen.tsx`
- `figma-export/src/app/components/PlotsScreen.tsx`
- `figma-export/src/app/components/FilesScreen.tsx`

## 13. Short conclusion
The app design was implemented by taking the original 4-screen prototype idea and rebuilding it as a real mobile telemetry app. The UI screens match the intended user flow, while the underlying code adds real BLE communication, live sensor decoding, plotting, recording, and file export features.
So the final smartphone design is both visually aligned with the prototype and technically functional as a production-style mobile application.
