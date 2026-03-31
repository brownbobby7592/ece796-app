# AI Q&A Summary
This document lists the main AI questions and answers that influenced the implementation decisions for the smartphone app. It is intentionally concise and formatted for easy copy/paste into Word.

## 1. What navigation structure should the app use?
**Answer:** Use a 4-tab layout with **Scan**, **Live**, **Plots**, and **Files** so the user flow matches the prototype and keeps major tasks separated.
**Implementation impact:** The app uses Expo Router tabs in `app/(tabs)/_layout.tsx` and maps each tab to a dedicated screen.

## 2. Should BLE logic live inside each screen?
**Answer:** No. BLE state and actions should be centralized so all screens stay synchronized.
**Implementation impact:** Shared state was placed in `context/AppContext.tsx`, and screens consume it through `useApp()`.

## 3. How should the app manage BLE scanning, connection, and streaming?
**Answer:** Use a dedicated BLE service layer instead of mixing transport code with UI code.
**Implementation impact:** BLE transport was encapsulated in `services/ble/BleClient.ts`, which handles permissions, scanning, connecting, subscriptions, fallback reads, and stream control.

## 4. How should BLE UUIDs and protocol settings be stored?
**Answer:** Keep them in runtime configuration so the app can be retargeted without rewriting code.
**Implementation impact:** UUIDs, packet mode, and scaling factors were externalized through `app.json` and read by `services/ble/config.ts`.

## 5. How should incoming sensor packets be represented in the app?
**Answer:** Decode all packet formats into one normalized telemetry model.
**Implementation impact:** The app uses the `IMUData` structure in `services/ble/protocol.ts` so the UI always receives the same shape of data.

## 6. What should the Scan screen show to help users choose a device?
**Answer:** Show connection state, scan controls, device identity, RSSI, and a simple signal-strength indicator.
**Implementation impact:** `app/(tabs)/index.tsx` includes a status banner, start/stop scan controls, device cards, and `getSignalBars()`.

## 7. What is the best layout for live telemetry?
**Answer:** Show current values in grouped cards and keep recording controls on the same screen.
**Implementation impact:** `app/(tabs)/explore.tsx` displays acceleration, gyroscope, and Euler angles using reusable `SensorSection()` cards, plus recording controls.

## 8. Should recording be a separate screen or part of the Live screen?
**Answer:** Put recording on the Live screen because users usually start recording while monitoring incoming data.
**Implementation impact:** Start/stop recording actions were integrated directly into `app/(tabs)/explore.tsx`.

## 9. How should plots be implemented on mobile?
**Answer:** Use native-friendly SVG plotting instead of browser chart libraries.
**Implementation impact:** `app/(tabs)/plots.tsx` uses custom plotting helpers such as `LinePlot()`, `movingAverage()`, and `toPolylinePoints()`.

## 10. What plotting controls are most useful for sensor data?
**Answer:** Include time range selection, pause/resume, smoothing, and fixed/auto scaling.
**Implementation impact:** Those controls were added to `app/(tabs)/plots.tsx` to support both quick viewing and more careful signal inspection.

## 11. How should the app connect orientation data to something visually intuitive?
**Answer:** Add a simple orientation preview based on Euler angles.
**Implementation impact:** `OrientationPreview()` was added to `app/(tabs)/plots.tsx`.

## 12. How should recorded sessions be managed?
**Answer:** Store them as session objects with metadata and provide export and delete actions in a dedicated Files screen.
**Implementation impact:** Session management was handled in `context/AppContext.tsx`, and the UI for storage, export, and delete was implemented in `app/(tabs)/files.tsx`.

## 13. What export format should be used?
**Answer:** Use CSV because it is easy to open in Excel, MATLAB, and Python workflows.
**Implementation impact:** CSV generation and sharing were implemented in `services/export/csv.ts`.

## 14. How should the app handle BLE issues on a real phone?
**Answer:** Provide clear recovery paths for permissions and Bluetooth state problems.
**Implementation impact:** The Scan screen includes error handling plus **Open Settings** and **Bluetooth Settings** actions in `app/(tabs)/index.tsx`.

## 15. Should the prototype dashboard be copied directly?
**Answer:** No. The prototype should guide the visual design, but the final app should be adapted for mobile runtime needs and real BLE behavior.
**Implementation impact:** The `figma-export` prototype informed the structure and styling, but the final implementation was rebuilt natively across `app/(tabs)`, `context`, and `services`.

## Short summary
The main AI guidance influenced five major decisions: use a 4-tab navigation structure, centralize app state, isolate BLE transport in a service layer, normalize all telemetry into a common data model, and use native-friendly plotting/export workflows instead of web-specific approaches.