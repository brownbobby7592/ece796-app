import { encode as encodeBase64 } from 'base-64';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Device, Subscription } from 'react-native-ble-plx';

import { getBleConfig, getBleProtocolConfig } from '@/services/ble/config';
import { decodeImuPayload, type IMUData } from '@/services/ble/protocol';

export interface BLEDevice {
  id: string;
  name: string;
  mac: string;
  rssi: number;
}

type DeviceCallback = (device: BLEDevice) => void;
type ImuDataCallback = (sample: IMUData) => void;
type DisconnectCallback = (error: BleError | null) => void;
type ScanErrorCallback = (message: string) => void;

export interface PermissionRequestResult {
  granted: boolean;
  message?: string;
}

export class BleClient {
  // Native BLE manager instance. Created lazily to avoid startup failures when
  // running in unsupported runtimes.
  private manager: BleManager | null = null;
  // Active data monitor subscription (notification/indication path).
  private dataSubscription: Subscription | null = null;
  // Device disconnect listener used to synchronize app state on link loss.
  private disconnectSubscription: Subscription | null = null;
  // Connected BLE peripheral handle from react-native-ble-plx.
  private connectedDevice: Device | null = null;
  // Optional text commands written to control characteristic for stream start/stop.
  private commandStart = 'START';
  private commandStop = 'STOP';
  // Guard used to ignore callbacks after teardown.
  private isDestroyed = false;
  // Byte reassembly buffer for fragmented Lab2 33-byte frames.
  private lab2RxBuffer: number[] = [];
  // Safety polling path if notifications stall after connection.
  private readPollTimer: ReturnType<typeof setInterval> | null = null;
  // Timestamp of last successfully decoded sample.
  private lastSampleAtMs = 0;
  // Runtime-resolved service/characteristic UUIDs that actually carry data.
  private activeServiceUuid: string | null = null;
  private activeDataCharacteristicUuid: string | null = null;

  private normalizeUuid(uuid: string): string {
    return uuid.trim().toLowerCase();
  }

  private reverseUuid128(uuid: string): string | null {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(hex)) {
      return null;
    }

    const bytes: string[] = [];
    for (let index = 0; index < 32; index += 2) {
      bytes.push(hex.slice(index, index + 2));
    }

    const reversed = bytes.reverse().join('');
    return `${reversed.slice(0, 8)}-${reversed.slice(8, 12)}-${reversed.slice(12, 16)}-${reversed.slice(16, 20)}-${reversed.slice(20, 32)}`;
  }

  private uuidCandidates(uuid: string): string[] {
    const normalized = this.normalizeUuid(uuid);
    const reversed = this.reverseUuid128(uuid);
    if (!reversed) {
      return [normalized];
    }

    const reversedNormalized = this.normalizeUuid(reversed);
    return reversedNormalized === normalized
      ? [normalized]
      : [normalized, reversedNormalized];
  }

  /**
   * Resolve the live data service/characteristic on the connected device.
   *
   * Workflow:
   * 1) Try exact configured UUIDs (plus reversed 128-bit byte-order variant).
   * 2) If not found, fall back to the first notifiable/indicatable characteristic
   *    on the matched service.
   *
   * This makes the client robust to firmware UUID formatting differences and
   * byte-order quirks observed on some BLE stacks.
   */
  private async resolveDataPath(
    manager: BleManager,
    deviceId: string,
    configuredServiceUuid: string,
    configuredDataUuid: string,
  ): Promise<{ serviceUuid: string; characteristicUuid: string }> {
    const serviceCandidates = this.uuidCandidates(configuredServiceUuid);
    const characteristicCandidates = this.uuidCandidates(configuredDataUuid);
    const services = await manager.servicesForDevice(deviceId);

    for (const service of services) {
      const serviceUuid = service.uuid;
      const normalizedServiceUuid = this.normalizeUuid(serviceUuid);
      if (!serviceCandidates.includes(normalizedServiceUuid)) {
        continue;
      }

      const characteristics = await manager.characteristicsForDevice(deviceId, serviceUuid);
      for (const characteristic of characteristics) {
        const normalizedCharacteristicUuid = this.normalizeUuid(characteristic.uuid);
        if (characteristicCandidates.includes(normalizedCharacteristicUuid)) {
          return {
            serviceUuid,
            characteristicUuid: characteristic.uuid,
          };
        }
      }
    }

    for (const service of services) {
      const serviceUuid = service.uuid;
      const normalizedServiceUuid = this.normalizeUuid(serviceUuid);
      if (!serviceCandidates.includes(normalizedServiceUuid)) {
        continue;
      }

      const characteristics = await manager.characteristicsForDevice(deviceId, serviceUuid);
      const notifiable = characteristics.find(
        (characteristic) => characteristic.isNotifiable || characteristic.isIndicatable,
      );

      if (notifiable) {
        return {
          serviceUuid,
          characteristicUuid: notifiable.uuid,
        };
      }
    }

    throw new Error(
      'Could not resolve BLE data characteristic on connected device. Verify service/data UUIDs from firmware.',
    );
  }

  // Convert raw binary string payload to byte array (0..255 per char code).
  private bytesFromBinaryString(payload: string): Uint8Array {
    const bytes = new Uint8Array(payload.length);
    for (let index = 0; index < payload.length; index += 1) {
      bytes[index] = payload.charCodeAt(index) & 0xff;
    }

    return bytes;
  }

  // Convert byte array back to binary string for protocol decoder input.
  private binaryStringFromBytes(bytes: Uint8Array): string {
    let result = '';
    for (let index = 0; index < bytes.length; index += 1) {
      result += String.fromCharCode(bytes[index]);
    }

    return result;
  }

  /**
   * Decode Base64 characteristic payload to bytes.
   *
   * The BLE library exposes characteristic values as Base64 strings; this decoder
   * preserves raw binary payload bytes (no UTF-8 text interpretation).
   */
  private decodeBase64ToBytes(input: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // Strip noise/newlines from transport payload before decoding.
    const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');

    if (clean.length === 0) {
      return new Uint8Array(0);
    }

    const output: number[] = [];
    for (let index = 0; index < clean.length; index += 4) {
      // Decode each 4-char Base64 quantum into up to 3 raw bytes.
      const c1 = clean[index] ?? 'A';
      const c2 = clean[index + 1] ?? 'A';
      const c3 = clean[index + 2] ?? '=';
      const c4 = clean[index + 3] ?? '=';

      const v1 = alphabet.indexOf(c1);
      const v2 = alphabet.indexOf(c2);
      const v3 = c3 === '=' ? 0 : alphabet.indexOf(c3);
      const v4 = c4 === '=' ? 0 : alphabet.indexOf(c4);

      if (v1 < 0 || v2 < 0 || (c3 !== '=' && v3 < 0) || (c4 !== '=' && v4 < 0)) {
        continue;
      }

      const bits = (v1 << 18) | (v2 << 12) | (v3 << 6) | v4;
      output.push((bits >> 16) & 0xff);
      if (c3 !== '=') {
        output.push((bits >> 8) & 0xff);
      }

      if (c4 !== '=') {
        output.push(bits & 0xff);
      }
    }

    return new Uint8Array(output);
  }

  // Append newly received chunk into Lab2 reassembly buffer.
  private appendLab2Chunk(chunk: string): void {
    const bytes = this.bytesFromBinaryString(chunk);
    for (let index = 0; index < bytes.length; index += 1) {
      this.lab2RxBuffer.push(bytes[index]);
    }

    if (this.lab2RxBuffer.length > 4096) {
      this.lab2RxBuffer = this.lab2RxBuffer.slice(-1024);
    }
  }

  /**
   * Consume complete Lab2 frames from the rolling RX buffer.
   *
   * Frames are fixed-length (33 bytes) and start with header AA AA AA.
   * This parser tolerates BLE packet fragmentation by buffering and only decoding
   * when a full frame is available.
   */
  private consumeLab2Frames(
    timestamp: number,
    protocol: ReturnType<typeof getBleProtocolConfig>,
    onImuData: ImuDataCallback,
  ): void {
    const header = [0xaa, 0xaa, 0xaa];
    const frameLength = 33;

    while (this.lab2RxBuffer.length >= frameLength) {
      let headerIndex = -1;
      for (let index = 0; index <= this.lab2RxBuffer.length - header.length; index += 1) {
        if (
          this.lab2RxBuffer[index] === header[0] &&
          this.lab2RxBuffer[index + 1] === header[1] &&
          this.lab2RxBuffer[index + 2] === header[2]
        ) {
          headerIndex = index;
          break;
        }
      }

      if (headerIndex < 0) {
        this.lab2RxBuffer = this.lab2RxBuffer.slice(-2);
        return;
      }

      if (headerIndex > 0) {
        this.lab2RxBuffer = this.lab2RxBuffer.slice(headerIndex);
      }

      if (this.lab2RxBuffer.length < frameLength) {
        return;
      }

      const frame = new Uint8Array(this.lab2RxBuffer.slice(0, frameLength));
      const sample = decodeImuPayload(
        this.binaryStringFromBytes(frame),
        timestamp,
        protocol,
      );

      this.lab2RxBuffer = this.lab2RxBuffer.slice(frameLength);

      if (sample) {
        this.lastSampleAtMs = Date.now();
        onImuData(sample);
      }
    }
  }

  /**
   * Route incoming decoded characteristic payload to the active protocol parser.
   *
   * - `lab2-33`: buffered binary frame reassembly
   * - `binary-int16`: direct binary frame decode
   * - text modes: delimiter split + per-chunk decode with fallback
   */
  private handleIncomingPayload(
    decoded: string,
    protocol: ReturnType<typeof getBleProtocolConfig>,
    onImuData: ImuDataCallback,
  ): void {
    const now = Date.now();

    if (protocol.packetMode === 'lab2-33') {
      this.appendLab2Chunk(decoded);
      this.consumeLab2Frames(now, protocol, onImuData);
      return;
    }

    if (protocol.packetMode === 'binary-int16') {
      const sample = decodeImuPayload(decoded, now, protocol);
      if (sample) {
        this.lastSampleAtMs = Date.now();
        onImuData(sample);
      }
      return;
    }

    const chunks = decoded
      .replace(/\0/g, '')
      .split(protocol.textDelimiter)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (chunks.length === 0) {
      const fallback = decodeImuPayload(decoded, now, protocol);
      if (fallback) {
        this.lastSampleAtMs = Date.now();
        onImuData(fallback);
      }
      return;
    }

    for (const chunk of chunks) {
      const sample = decodeImuPayload(chunk, Date.now(), protocol);
      if (sample) {
        this.lastSampleAtMs = Date.now();
        onImuData(sample);
      }
    }
  }

  /**
   * Start read polling as a fallback when notifications are quiet.
   *
   * Purpose:
   * - Some devices/firmware combinations connect successfully but do not deliver
   *   notifications immediately.
   * - This periodic read keeps data flowing until notifications stabilize.
   */
  private startReadPollFallback(
    manager: BleManager,
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    protocol: ReturnType<typeof getBleProtocolConfig>,
    onImuData: ImuDataCallback,
  ): void {
    if (this.readPollTimer) {
      clearInterval(this.readPollTimer);
      this.readPollTimer = null;
    }

    this.readPollTimer = setInterval(() => {
      if (this.isDestroyed || this.manager !== manager || !this.connectedDevice) {
        return;
      }

      if (Date.now() - this.lastSampleAtMs < 1200) {
        return;
      }

      void manager
        .readCharacteristicForDevice(deviceId, serviceUuid, characteristicUuid)
        .then((characteristic) => {
          if (this.isDestroyed || this.manager !== manager || !characteristic?.value) {
            return;
          }

          const decoded = this.binaryStringFromBytes(this.decodeBase64ToBytes(characteristic.value));
          this.handleIncomingPayload(decoded, protocol, onImuData);
        })
        .catch(() => {
          // Keep polling; read may transiently fail while connection stabilizes.
        });
    }, 350);
  }

  // Ensure BLE manager exists and throw a targeted runtime guidance message if not.
  private ensureManager(): BleManager {
    this.isDestroyed = false;

    if (this.manager) {
      return this.manager;
    }

    try {
      this.manager = new BleManager();
      return this.manager;
    } catch {
      throw new Error(
        'Bluetooth native module is unavailable. Use an Android/iOS development build (not Expo Go) and reinstall after native dependency changes.',
      );
    }
  }

  /**
   * Request runtime BLE permissions.
   *
   * Android 12+ requires Nearby Devices permissions (`BLUETOOTH_SCAN` and
   * `BLUETOOTH_CONNECT`). Older Android versions require location permission for
   * scanning. iOS returns granted here because platform prompts are handled by
   * system + Info.plist entries.
   */
  async requestPermissions(): Promise<PermissionRequestResult> {
    if (Platform.OS !== 'android') {
      return { granted: true };
    }

    if (Platform.Version >= 31) {
      const mandatoryPermissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      const labelForPermission = (permission: string) => {
        if (permission === PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
          return 'BLUETOOTH_SCAN';
        }

        if (permission === PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
          return 'BLUETOOTH_CONNECT';
        }

        return permission;
      };

      const initiallyMissing: string[] = [];
      for (const permission of mandatoryPermissions) {
        const alreadyGranted = await PermissionsAndroid.check(permission);
        if (!alreadyGranted) {
          initiallyMissing.push(permission);
        }
      }

      if (initiallyMissing.length === 0) {
        return { granted: true };
      }

      const denied: string[] = [];
      const neverAskAgain: string[] = [];

      for (const permission of initiallyMissing) {
        const result = await PermissionsAndroid.request(permission);
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          continue;
        }

        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          neverAskAgain.push(permission);
          continue;
        }

        denied.push(permission);
      }

      if (neverAskAgain.length > 0) {
        const labels = neverAskAgain.map(labelForPermission);
        return {
          granted: false,
          message: `Bluetooth permission(s) blocked with "Don't ask again": ${labels.join(', ')}. Open Android Settings > Apps > ece796-app > Permissions > Nearby devices and allow access.`,
        };
      }

      if (denied.length > 0) {
        const labels = denied.map(labelForPermission);
        return {
          granted: false,
          message: `Missing required Bluetooth permission(s): ${labels.join(', ')}. Allow Nearby devices when prompted, then try scan again.`,
        };
      }

      const stillMissing: string[] = [];
      for (const permission of mandatoryPermissions) {
        const grantedNow = await PermissionsAndroid.check(permission);
        if (!grantedNow) {
          stillMissing.push(permission);
        }
      }

      if (stillMissing.length > 0) {
        const labels = stillMissing.map(labelForPermission);
        return {
          granted: false,
          message: `Bluetooth permission(s) still missing: ${labels.join(', ')}. Open Android Settings > Apps > ece796-app > Permissions > Nearby devices and allow access.`,
        };
      }

      return { granted: true };
    }

    const location = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (location !== PermissionsAndroid.RESULTS.GRANTED) {
      return {
        granted: false,
        message:
          'Location permission is required for BLE scanning on this Android version. Please allow Location permission for ece796-app.',
      };
    }

    return { granted: true };
  }

  // Fail fast with actionable errors when Bluetooth adapter is not ready.
  private async assertBluetoothPoweredOn(): Promise<void> {
    const manager = this.ensureManager();
    const state = await manager.state();

    if (state === 'PoweredOn') {
      return;
    }

    if (state === 'PoweredOff') {
      throw new Error(
        'Bluetooth is turned off on your phone. Turn it on in Quick Settings or Settings > Connections > Bluetooth, then try scanning again.',
      );
    }

    if (state === 'Unauthorized') {
      throw new Error(
        'Bluetooth is not authorized by Android. Check Nearby devices permission for ece796-app in system settings.',
      );
    }

    if (state === 'Unsupported') {
      throw new Error('Bluetooth LE is not supported on this device.');
    }

    if (state === 'Resetting') {
      throw new Error('Bluetooth is resetting. Wait a moment and try scanning again.');
    }

    throw new Error(`Bluetooth is not ready (${state}).`);
  }

  /**
   * Begin scanning for nearby peripherals.
   *
   * This method is scan-only: it reports discovered devices through callback and
   * leaves selection/connection decisions to app state (`AppContext`).
   */
  async startScan(onDevice: DeviceCallback, onScanError?: ScanErrorCallback): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    await this.assertBluetoothPoweredOn();

    const manager = this.ensureManager();
    manager.stopDeviceScan();

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (this.isDestroyed || this.manager !== manager) {
        return;
      }

      if (error) {
        onScanError?.(error.message ?? 'Failed to scan for BLE devices.');
        return;
      }

      if (!device) {
        return;
      }

      onDevice({
        id: device.id,
        name: device.name ?? device.localName ?? 'Unknown IMU Device',
        mac: device.id,
        rssi: device.rssi ?? -100,
      });
    });
  }

  // Stop active BLE scan if running.
  stopScan(): void {
    if (this.isDestroyed) {
      return;
    }

    this.manager?.stopDeviceScan();
  }

  /**
   * Connect to selected device and start telemetry intake.
   *
   * End-to-end workflow:
   * 1) Reset previous connection state/subscriptions.
   * 2) Connect + discover services/characteristics.
   * 3) Request larger MTU on Android (best effort).
   * 4) Resolve data path UUIDs.
   * 5) Start monitor callback for notifications.
   * 6) Start read-poll fallback if no samples arrive.
   */
  async connect(
    deviceId: string,
    onImuData: ImuDataCallback,
    onDisconnect: DisconnectCallback,
  ): Promise<BLEDevice> {
    const config = getBleConfig();
    const protocol = getBleProtocolConfig();
    this.commandStart = config.commandStart ?? 'START';
    this.commandStop = config.commandStop ?? 'STOP';

    this.stopScan();
    this.lab2RxBuffer = [];
    this.lastSampleAtMs = 0;
    if (this.readPollTimer) {
      clearInterval(this.readPollTimer);
      this.readPollTimer = null;
    }
    this.activeServiceUuid = null;
    this.activeDataCharacteristicUuid = null;
    this.dataSubscription?.remove();
    this.dataSubscription = null;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;

    const manager = this.ensureManager();

    const device = await manager.connectToDevice(deviceId, { autoConnect: false });
    let discoveredDevice = await device.discoverAllServicesAndCharacteristics();

    if (Platform.OS === 'android') {
      try {
        discoveredDevice = await manager.requestMTUForDevice(discoveredDevice.id, 185);
      } catch {
        // Keep operating with default MTU if negotiation fails.
      }
    }

    const rssiDevice = await discoveredDevice.readRSSI();
    this.connectedDevice = rssiDevice;

    const resolvedDataPath = await this.resolveDataPath(
      manager,
      discoveredDevice.id,
      config.serviceUuid,
      config.dataCharacteristicUuid,
    );
    this.activeServiceUuid = resolvedDataPath.serviceUuid;
    this.activeDataCharacteristicUuid = resolvedDataPath.characteristicUuid;

    this.disconnectSubscription = manager.onDeviceDisconnected(discoveredDevice.id, (error) => {
      if (this.isDestroyed || this.manager !== manager) {
        return;
      }

      onDisconnect(error);
    });

    this.dataSubscription = manager.monitorCharacteristicForDevice(
      discoveredDevice.id,
      resolvedDataPath.serviceUuid,
      resolvedDataPath.characteristicUuid,
      (error, characteristic) => {
        if (error || !characteristic?.value) {
          return;
        }

        const decoded = this.binaryStringFromBytes(this.decodeBase64ToBytes(characteristic.value));
        this.handleIncomingPayload(decoded, protocol, onImuData);
      },
    );

    this.startReadPollFallback(
      manager,
      discoveredDevice.id,
      resolvedDataPath.serviceUuid,
      resolvedDataPath.characteristicUuid,
      protocol,
      onImuData,
    );

    return {
      id: discoveredDevice.id,
      name: discoveredDevice.name ?? discoveredDevice.localName ?? 'Unknown IMU Device',
      mac: discoveredDevice.id,
      rssi: rssiDevice.rssi ?? -100,
    };
  }

  /**
   * Disconnect current device and clear all stream resources.
   *
   * This guarantees timers, subscriptions, and frame buffers are reset so the
   * next connection starts from a clean state.
   */
  async disconnect(): Promise<void> {
    this.lab2RxBuffer = [];
    this.lastSampleAtMs = 0;
    if (this.readPollTimer) {
      clearInterval(this.readPollTimer);
      this.readPollTimer = null;
    }
    this.activeServiceUuid = null;
    this.activeDataCharacteristicUuid = null;
    this.dataSubscription?.remove();
    this.dataSubscription = null;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;

    const manager = this.manager;
    const deviceId = this.connectedDevice?.id;
    if (manager && deviceId) {
      try {
        await manager.cancelDeviceConnection(deviceId);
      } catch {
        // Connection may already be closed or manager may be tearing down.
      }
    }

    this.connectedDevice = null;
  }

  // Send configured start command to optional control characteristic.
  async startStreaming(): Promise<void> {
    await this.sendControlCommand(this.commandStart);
  }

  // Send configured stop command to optional control characteristic.
  async stopStreaming(): Promise<void> {
    await this.sendControlCommand(this.commandStop);
  }

  /**
   * Write command payload to control characteristic when configured.
   *
   * If no control characteristic is provided, streaming control is treated as
   * no-op (useful when firmware streams continuously after connection).
   */
  private async sendControlCommand(command: string): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }

    const config = getBleConfig();
    if (!config.controlCharacteristicUuid) {
      return;
    }

    const manager = this.ensureManager();

    await manager.writeCharacteristicWithResponseForDevice(
      this.connectedDevice.id,
      config.serviceUuid,
      config.controlCharacteristicUuid,
      encodeBase64(command),
    );
  }

  /**
   * Final teardown: stop timers/subscriptions, clear references, destroy manager.
   *
   * Called when app context unmounts to prevent stale callbacks and native leaks.
   */
  destroy(): void {
    this.isDestroyed = true;
    this.lab2RxBuffer = [];
    this.lastSampleAtMs = 0;
    if (this.readPollTimer) {
      clearInterval(this.readPollTimer);
      this.readPollTimer = null;
    }
    this.activeServiceUuid = null;
    this.activeDataCharacteristicUuid = null;
    this.dataSubscription?.remove();
    this.disconnectSubscription?.remove();
    this.dataSubscription = null;
    this.disconnectSubscription = null;
    this.manager?.destroy();
    this.manager = null;
    this.connectedDevice = null;
  }
}
