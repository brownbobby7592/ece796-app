# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## BLE Configuration Notes

This app uses Bluetooth Low Energy (BLE) in **Central** mode on the phone side.

- **GAP roles**
   - Phone app: Central
   - ESP32 sensor: Peripheral
- **GATT service UUID**
   - `f0debc9a-7856-3412-f0de-bc9a78563412`
- **GATT data characteristic UUID**
   - `f3debc9a-7856-3412-f3de-bc9a78563412`
- **Control characteristic UUID**
   - currently empty (`""`), so command writes are effectively disabled unless a control UUID is configured

### ATT data path used by the app

1. Connect to peripheral and discover services/characteristics.
2. Subscribe to data characteristic notifications/indications.
3. If notifications stall, fallback polling reads are performed.
4. Decode custom Lab2 packet frames (`AA AA AA`, fixed 33 bytes).

### Packet conversion summary

- Raw accel and gyro are parsed as `int16` and converted using scale factors in `expo.extra.ble.protocol`.
- Quaternion components (`qx/qy/qz`) are parsed as float16, then converted to Euler angles (degrees).
- Timestamp from packet is treated as microseconds and normalized to milliseconds for app timelines.

All BLE runtime configuration lives in `app.json` under `expo.extra.ble`.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
