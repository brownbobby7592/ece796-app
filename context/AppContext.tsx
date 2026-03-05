import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BleClient, BLEDevice } from '@/services/ble/BleClient';
import { getBleConfig, hasConfiguredBleUuids } from '@/services/ble/config';
import type { IMUData } from '@/services/ble/protocol';
import { exportSessionCsv, type RecordedSession } from '@/services/export/csv';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface AppContextType {
  connectionStatus: ConnectionStatus;
  connectedDevice: BLEDevice | null;
  scannedDevices: BLEDevice[];
  isScanning: boolean;
  currentIMUData: IMUData;
  imuHistory: IMUData[];
  isRecording: boolean;
  sampleRate: number;
  sessions: RecordedSession[];
  bleReady: boolean;
  errorMessage: string | null;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectToDevice: (device: BLEDevice) => Promise<void>;
  disconnect: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  deleteSession: (id: string) => void;
  exportSession: (id: string) => Promise<string>;
}

const initialImuData: IMUData = {
  timestamp: Date.now(),
  accel: { x: 0, y: 0, z: 0 },
  gyro: { x: 0, y: 0, z: 0 },
  euler: { roll: 0, pitch: 0, yaw: 0 },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // BLE transport wrapper (single instance for app lifetime).
  const bleRef = useRef(new BleClient());
  // Temporary in-memory sample buffer used during active recording.
  const recordingBufferRef = useRef<IMUData[]>([]);
  // Wall-clock start marker for duration estimation.
  const recordingStartRef = useRef<number | null>(null);
  // Mutable mirror of recording state for callback-safe reads.
  const isRecordingRef = useRef(false);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);
  const [scannedDevices, setScannedDevices] = useState<BLEDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [currentIMUData, setCurrentIMUData] = useState<IMUData>(initialImuData);
  const [imuHistory, setImuHistory] = useState<IMUData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleRate, setSampleRate] = useState(0);
  const [sessions, setSessions] = useState<RecordedSession[]>([]);
  const [bleReady, setBleReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rolling timestamps used to estimate incoming sample rate (Hz).
  const sampleTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    // Ensure native BLE resources are released when provider unmounts.
    return () => {
      bleRef.current.destroy();
    };
  }, []);

  /**
   * Scan workflow:
   * 1) Reset prior scan state/errors
   * 2) Request permissions
   * 3) Start BLE scan and incrementally update sorted device list by RSSI
   */
  const startScan = async () => {
    setErrorMessage(null);
    setScannedDevices([]);

    const permissionResult = await bleRef.current.requestPermissions();
    if (!permissionResult.granted) {
      setErrorMessage(
        permissionResult.message ?? 'Bluetooth permissions are required to scan for devices.',
      );
      return;
    }

    setBleReady(true);
    setIsScanning(true);

    const seen = new Set<string>();
    try {
      await bleRef.current.startScan(
        (device) => {
          setScannedDevices((previous) => {
            if (seen.has(device.id)) {
              return previous.map((entry) => (entry.id === device.id ? device : entry));
            }

            seen.add(device.id);
            return [...previous, device].sort((a, b) => b.rssi - a.rssi);
          });
        },
        (message) => {
          setErrorMessage(message);
          setIsScanning(false);
        },
      );
    } catch (error) {
      setIsScanning(false);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start BLE scan.');
    }
  };

  // Stop active scan session.
  const stopScan = () => {
    bleRef.current.stopScan();
    setIsScanning(false);
  };

  /**
   * Connection + sample ingestion workflow:
   * 1) Validate configured BLE UUIDs
   * 2) Connect through BleClient
   * 3) On each sample: update latest value, history, sample-rate estimate
   * 4) If recording is active, append sample into recording buffer
   */
  const connectToDevice = async (device: BLEDevice) => {
    setErrorMessage(null);
    const config = getBleConfig();
    if (!hasConfiguredBleUuids(config)) {
      setErrorMessage('BLE UUIDs are not configured in app.json extra.ble.');
      return;
    }

    setConnectionStatus('connecting');
    setConnectedDevice(device);
    stopScan();

    try {
      const connected = await bleRef.current.connect(
        device.id,
        (sample) => {
          setCurrentIMUData(sample);
          setImuHistory((previous) => [...previous.slice(-2999), sample]);

          sampleTimestampsRef.current = [...sampleTimestampsRef.current.slice(-80), sample.timestamp];
          const samples = sampleTimestampsRef.current;
          if (samples.length > 1) {
            const elapsed = samples[samples.length - 1] - samples[0];
            const hz = elapsed > 0 ? Math.round(((samples.length - 1) * 1000) / elapsed) : 0;
            setSampleRate(hz);
          }

          if (isRecordingRef.current) {
            recordingBufferRef.current = [...recordingBufferRef.current, sample];
          }
        },
        () => {
          setConnectionStatus('disconnected');
          setConnectedDevice(null);
          setSampleRate(0);
          isRecordingRef.current = false;
          setIsRecording(false);
        },
      );

      setConnectedDevice(connected);
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
      setConnectedDevice(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to device');
    }
  };

  // Explicit user disconnect; also clears recording/session runtime state.
  const disconnect = async () => {
    setErrorMessage(null);

    try {
      await bleRef.current.disconnect();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to disconnect device');
    }

    setConnectionStatus('disconnected');
    setConnectedDevice(null);
    isRecordingRef.current = false;
    setIsRecording(false);
    setSampleRate(0);
  };

  /**
   * Start recording session.
   *
   * Records are captured in memory from live decoded sample callbacks until
   * `stopRecording` is called.
   */
  const startRecording = async () => {
    setErrorMessage(null);

    const config = getBleConfig();
    if (!hasConfiguredBleUuids(config)) {
      setErrorMessage('BLE UUIDs are not configured in app.json extra.ble.');
      return;
    }

    try {
      await bleRef.current.startStreaming();
      recordingBufferRef.current = [];
      recordingStartRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start recording');
    }
  };

  /**
   * Stop recording and materialize a session entry for Files tab + CSV export.
   */
  const stopRecording = async () => {
    setErrorMessage(null);

    try {
      await bleRef.current.stopStreaming();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to stop recording cleanly');
    }

    const startedAt = recordingStartRef.current;
    const records = recordingBufferRef.current;

    if (startedAt && records.length > 0) {
      const duration = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      const estimatedSize = Number((records.length * 0.0004).toFixed(1));
      const newSession: RecordedSession = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        duration,
        sampleRate,
        fileSize: estimatedSize,
        samples: records.length,
        records: [...records],
      };
      setSessions((previous) => [newSession, ...previous]);
    }

    recordingStartRef.current = null;
    recordingBufferRef.current = [];
    isRecordingRef.current = false;
    setIsRecording(false);
  };

  // Remove a session from in-memory list.
  const deleteSession = (id: string) => {
    setSessions((previous) => previous.filter((entry) => entry.id !== id));
  };

  // Export selected session to CSV file and open share sheet if available.
  const exportSession = async (id: string) => {
    const session = sessions.find((entry) => entry.id === id);
    if (!session) {
      throw new Error('Session not found');
    }

    return exportSessionCsv(session);
  };

  const value = useMemo(
    () => ({
      connectionStatus,
      connectedDevice,
      scannedDevices,
      isScanning,
      currentIMUData,
      imuHistory,
      isRecording,
      sampleRate,
      sessions,
      bleReady,
      errorMessage,
      startScan,
      stopScan,
      connectToDevice,
      disconnect,
      startRecording,
      stopRecording,
      deleteSession,
      exportSession,
    }),
    [
      connectionStatus,
      connectedDevice,
      scannedDevices,
      isScanning,
      currentIMUData,
      imuHistory,
      isRecording,
      sampleRate,
      sessions,
      bleReady,
      errorMessage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
}
