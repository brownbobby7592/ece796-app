import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  mac: string;
}

export interface IMUData {
  timestamp: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  euler: { roll: number; pitch: number; yaw: number };
}

export interface RecordedSession {
  id: string;
  timestamp: string;
  duration: number;
  sampleRate: number;
  fileSize: number;
  samples: number;
}

interface AppContextType {
  connectionStatus: "disconnected" | "connecting" | "connected";
  connectedDevice: BLEDevice | null;
  currentIMUData: IMUData;
  imuHistory: IMUData[];
  isRecording: boolean;
  sampleRate: number;
  sessions: RecordedSession[];
  connectToDevice: (device: BLEDevice) => void;
  disconnect: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  deleteSession: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);
  const [currentIMUData, setCurrentIMUData] = useState<IMUData>({
    timestamp: Date.now(),
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    euler: { roll: 0, pitch: 0, yaw: 0 },
  });
  const [imuHistory, setImuHistory] = useState<IMUData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleRate, setSampleRate] = useState(0);
  const [sessions, setSessions] = useState<RecordedSession[]>([
    {
      id: "1",
      timestamp: "2026-03-02 14:23:45",
      duration: 125,
      sampleRate: 50,
      fileSize: 2.4,
      samples: 6250,
    },
    {
      id: "2",
      timestamp: "2026-03-02 10:15:22",
      duration: 58,
      sampleRate: 50,
      fileSize: 1.1,
      samples: 2900,
    },
  ]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  const connectToDevice = (device: BLEDevice) => {
    setConnectionStatus("connecting");
    setConnectedDevice(device);
    
    setTimeout(() => {
      setConnectionStatus("connected");
    }, 1500);
  };

  const disconnect = () => {
    setConnectionStatus("disconnected");
    setConnectedDevice(null);
    setIsRecording(false);
    setImuHistory([]);
    setSampleRate(0);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingStartTime(Date.now());
  };

  const stopRecording = () => {
    if (recordingStartTime) {
      const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
      const samples = imuHistory.length;
      const fileSize = +(samples * 0.0004).toFixed(1); // Approximate size in MB
      
      const newSession: RecordedSession = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString('en-US', { 
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2'),
        duration,
        sampleRate,
        fileSize,
        samples,
      };
      
      setSessions((prev) => [newSession, ...prev]);
    }
    
    setIsRecording(false);
    setRecordingStartTime(null);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // Simulate IMU data streaming when connected
  useEffect(() => {
    if (connectionStatus !== "connected") {
      setSampleRate(0);
      return;
    }

    setSampleRate(50); // 50 Hz
    const interval = setInterval(() => {
      const now = Date.now();
      const newData: IMUData = {
        timestamp: now,
        accel: {
          x: +(Math.sin(now / 1000) * 2 + Math.random() * 0.5).toFixed(3),
          y: +(Math.cos(now / 1000) * 1.5 + Math.random() * 0.5).toFixed(3),
          z: +(9.81 + Math.random() * 0.3).toFixed(3),
        },
        gyro: {
          x: +(Math.sin(now / 500) * 50 + Math.random() * 10).toFixed(2),
          y: +(Math.cos(now / 500) * 50 + Math.random() * 10).toFixed(2),
          z: +(Math.sin(now / 700) * 30 + Math.random() * 8).toFixed(2),
        },
        euler: {
          roll: +(Math.sin(now / 2000) * 45).toFixed(1),
          pitch: +(Math.cos(now / 2000) * 30).toFixed(1),
          yaw: +((now / 100) % 360).toFixed(1),
        },
      };

      setCurrentIMUData(newData);
      setImuHistory((prev) => {
        const updated = [...prev, newData];
        // Keep last 3000 samples (60 seconds at 50Hz)
        return updated.slice(-3000);
      });
    }, 20); // 50 Hz = 20ms

    return () => clearInterval(interval);
  }, [connectionStatus]);

  return (
    <AppContext.Provider
      value={{
        connectionStatus,
        connectedDevice,
        currentIMUData,
        imuHistory,
        isRecording,
        sampleRate,
        sessions,
        connectToDevice,
        disconnect,
        startRecording,
        stopRecording,
        deleteSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
